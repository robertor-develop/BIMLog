import type { EmailDeliveryInput } from "./launch-configuration";

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
