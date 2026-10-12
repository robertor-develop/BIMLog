import type { EmailDeliveryInput } from "./launch-configuration";
import net from "node:net";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

export type SmtpEndpoint = Readonly<{ host: string; port: number; username: string; sender: string; implicitTls: boolean }>;

export function inspectSmtpEndpoint(configuration: EmailDeliveryInput): SmtpEndpoint | null {
  const host = configuration.smtpHost?.trim(), username = configuration.smtpUsername?.trim(), sender = configuration.senderAddress?.trim().toLowerCase();
  const port = Number(configuration.smtpPort);
  if (!host || host.length > 253 || /[\s\\/]/.test(host) || !username || username.length > 254 || !sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return Object.freeze({ host, port, username, sender, implicitTls: port === 465 });
}

export function smtpAuthPlain(username: string, password: string) {
  return Buffer.from(`\0${username}\0${password}`, "utf8").toString("base64");
}

export function smtpDotStuff(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/(^|\r\n)\./g, "$1..");
}

export function smtpReplyComplete(value: string) {
  const lines = value.split("\r\n").filter(Boolean);
  const last = lines.at(-1);
  return Boolean(last && /^\d{3} /.test(last));
}

export function smtpReplyCode(value: string) {
  const match = value.match(/^(\d{3})[ -]/m);
  return match ? Number(match[1]) : 0;
}

type MailSocket = net.Socket | tls.TLSSocket;
const MAX_REPLY_BYTES = 32_768;

function readReply(socket: MailSocket, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); socket.off("close", onClose); clearTimeout(timer); };
    const finish = (error?: Error) => { cleanup(); error ? reject(error) : resolve(value); };
    const onError = (error: Error) => finish(error);
    const onClose = () => finish(new Error("smtp_connection_closed"));
    const onData = (chunk: Buffer) => { value += chunk.toString("utf8"); if (Buffer.byteLength(value) > MAX_REPLY_BYTES) finish(new Error("smtp_reply_too_large")); else if (smtpReplyComplete(value)) finish(); };
    const timer = setTimeout(() => finish(new Error("smtp_timeout")), timeoutMs);
    socket.on("data", onData); socket.once("error", onError); socket.once("close", onClose);
  });
}

async function command(socket: MailSocket, value: string, expected: readonly number[]) {
  socket.write(`${value}\r\n`);
  const reply = await readReply(socket), code = smtpReplyCode(reply);
  if (!expected.includes(code)) throw new Error(code === 535 || code === 534 ? "smtp_credentials_rejected" : `smtp_unexpected_${code}`);
  return reply;
}

async function connect(endpoint: SmtpEndpoint): Promise<MailSocket> {
  if (endpoint.implicitTls) return await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: endpoint.host, port: endpoint.port, servername: endpoint.host, minVersion: "TLSv1.2", rejectUnauthorized: true }, () => resolve(socket));
    socket.once("error", reject); socket.setTimeout(10_000, () => socket.destroy(new Error("smtp_timeout")));
  });
  return await new Promise((resolve, reject) => {
    const socket = net.connect({ host: endpoint.host, port: endpoint.port }, () => resolve(socket));
    socket.once("error", reject); socket.setTimeout(10_000, () => socket.destroy(new Error("smtp_timeout")));
  });
}

async function authenticate(configuration: EmailDeliveryInput, password: string): Promise<{ socket: MailSocket; endpoint: SmtpEndpoint }> {
  const endpoint = inspectSmtpEndpoint(configuration);
  if (!endpoint) throw new Error("smtp_configuration_invalid");
  let socket = await connect(endpoint);
  let greeting = await readReply(socket);
  if (smtpReplyCode(greeting) !== 220) throw new Error("smtp_greeting_rejected");
  let capabilities = await command(socket, `EHLO ${configuration.senderDomain?.trim() || "bimlog.app"}`, [250]);
  if (!endpoint.implicitTls) {
    if (!/(^|\r\n)250[ -]STARTTLS(\s|\r\n|$)/i.test(capabilities)) throw new Error("smtp_starttls_required");
    await command(socket, "STARTTLS", [220]);
    socket = await new Promise((resolve, reject) => {
      const secure = tls.connect({ socket, servername: endpoint.host, minVersion: "TLSv1.2", rejectUnauthorized: true }, () => resolve(secure));
      secure.once("error", reject); secure.setTimeout(10_000, () => secure.destroy(new Error("smtp_timeout")));
    });
    capabilities = await command(socket, `EHLO ${configuration.senderDomain?.trim() || "bimlog.app"}`, [250]);
  }
  if (!/(^|\r\n)250[ -]AUTH\b[^\r\n]*\bPLAIN\b/i.test(capabilities)) throw new Error("smtp_auth_plain_unavailable");
  await command(socket, `AUTH PLAIN ${smtpAuthPlain(endpoint.username, password)}`, [235]);
  return { socket, endpoint };
}

export const liveSmtpLaunchProbe = Object.freeze({
  async verify(configuration: EmailDeliveryInput, password: string): Promise<"verified" | "rejected" | "unavailable"> {
    let socket: MailSocket | undefined;
    try { ({ socket } = await authenticate(configuration, password)); await command(socket, "QUIT", [221]); return "verified"; }
    catch (error) { return error instanceof Error && error.message === "smtp_credentials_rejected" ? "rejected" : "unavailable"; }
    finally { socket?.destroy(); }
  },
  async send(configuration: EmailDeliveryInput, password: string, recipient: string): Promise<{ status: "sent" | "rejected" | "unavailable"; messageId?: string }> {
    let socket: MailSocket | undefined;
    try {
      const authenticated = await authenticate(configuration, password); socket = authenticated.socket;
      if (!/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(recipient)) return { status: "rejected" };
      const messageId = `<${randomUUID()}@${configuration.senderDomain?.trim().toLowerCase() || "bimlog.app"}>`;
      await command(socket, `MAIL FROM:<${authenticated.endpoint.sender}>`, [250]);
      await command(socket, `RCPT TO:<${recipient}>`, [250, 251]);
      await command(socket, "DATA", [354]);
      const body = [
        `From: BIMLog <${authenticated.endpoint.sender}>`,
        `To: <${recipient}>`,
        "Subject: BIMLog synthetic launch configuration test",
        `Message-ID: ${messageId}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        "Synthetic BIMLog configuration test. No customer transaction was created.",
      ].join("\r\n");
      await command(socket, `${smtpDotStuff(body)}\r\n.`, [250]);
      await command(socket, "QUIT", [221]);
      return { status: "sent", messageId };
    } catch (error) { return { status: error instanceof Error && error.message === "smtp_credentials_rejected" ? "rejected" : "unavailable" }; }
    finally { socket?.destroy(); }
  },
});
