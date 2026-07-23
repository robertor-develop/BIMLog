import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MailService } from "@sendgrid/mail";
import {
  configureSendGridTransport,
  SENDGRID_TRANSPORT_LIMITS,
  type ConfigurableSendGridMailService,
} from "../src/lib/sendgrid-transport";

type FixtureMode = "success" | "redirect" | "oversized" | "slow" | "error";
type CapturedRequest = {
  url: string;
  authorization: string;
  contentType: string;
  body: string;
};

const TEST_API_KEY = ["SG", "fixture-only-key"].join(".");
const MAX_CAPTURE_BYTES = SENDGRID_TRANSPORT_LIMITS.maxRequestBytes + 4096;
const results: string[] = [];

function check(name: string, condition: unknown): void {
  assert.ok(condition, name);
  results.push(name);
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Fixture did not expose a bounded loopback port."));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

async function expectRejected(run: () => Promise<unknown>, name: string): Promise<void> {
  let rejected = false;
  try {
    await run();
  } catch {
    rejected = true;
  }
  check(name, rejected);
}

const captured: CapturedRequest[] = [];
let mode: FixtureMode = "success";
let fixtureOrigin = "";

const provider = http.createServer((request, response) => {
  const chunks: Buffer[] = [];
  let bytes = 0;
  request.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes <= MAX_CAPTURE_BYTES) chunks.push(Buffer.from(chunk));
  });
  request.on("end", () => {
    captured.push({
      url: request.url ?? "",
      authorization: String(request.headers.authorization ?? ""),
      contentType: String(request.headers["content-type"] ?? ""),
      body: Buffer.concat(chunks).toString("utf8"),
    });

    if (mode === "redirect") {
      response.statusCode = 302;
      response.setHeader("location", `${fixtureOrigin}/redirected`);
      response.end();
      return;
    }
    if (mode === "oversized") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end("x".repeat(SENDGRID_TRANSPORT_LIMITS.maxResponseBytes + 1));
      return;
    }
    if (mode === "slow") {
      setTimeout(() => {
        if (!response.writableEnded) {
          response.statusCode = 202;
          response.end();
        }
      }, 200);
      return;
    }
    if (mode === "error") {
      response.statusCode = 422;
      response.setHeader("content-type", "application/json");
      response.end('{"errors":[{"message":"fixture rejection"}]}');
      return;
    }
    response.statusCode = 202;
    response.end();
  });
});

let proxyRequests = 0;
const proxy = http.createServer((_request, response) => {
  proxyRequests += 1;
  response.statusCode = 502;
  response.end();
});

const providerPort = await listen(provider);
const proxyPort = await listen(proxy);
fixtureOrigin = `http://127.0.0.1:${providerPort}`;

const mail = new MailService() as unknown as ConfigurableSendGridMailService & {
  setApiKey(key: string): void;
  send(data: Record<string, unknown>): Promise<unknown>;
  client: ConfigurableSendGridMailService["client"] & {
    defaultRequest: Record<string, unknown>;
  };
};

try {
  configureSendGridTransport(mail);
  mail.setApiKey(TEST_API_KEY);

  check(
    "Production configuration retains the official fixed SendGrid destination",
    mail.client.defaultRequest.baseUrl === "https://api.sendgrid.com/",
  );
  check(
    "Request timeout is finite",
    mail.client.defaultRequest.timeout === SENDGRID_TRANSPORT_LIMITS.timeoutMs,
  );
  check(
    "Request body limit is finite",
    mail.client.defaultRequest.maxBodyLength === SENDGRID_TRANSPORT_LIMITS.maxRequestBytes,
  );
  check(
    "Response body limit is finite",
    mail.client.defaultRequest.maxContentLength === SENDGRID_TRANSPORT_LIMITS.maxResponseBytes,
  );
  check(
    "Redirect following is disabled",
    mail.client.defaultRequest.maxRedirects === 0,
  );

  mail.client.setDefaultRequest("baseUrl", `${fixtureOrigin}/`);

  const savedProxyEnvironment = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    http_proxy: process.env.http_proxy,
    NO_PROXY: process.env.NO_PROXY,
    no_proxy: process.env.no_proxy,
  };
  process.env.HTTP_PROXY = `http://127.0.0.1:${proxyPort}`;
  process.env.http_proxy = process.env.HTTP_PROXY;
  process.env.NO_PROXY = "127.0.0.1";
  process.env.no_proxy = process.env.NO_PROXY;

  mode = "success";
  await mail.send({
    to: "recipient@example.test",
    from: "sender@example.test",
    subject: "Bounded transport",
    html: "<p>finite fixture</p>",
  });

  const accepted = captured.at(-1);
  check("Valid JSON request reaches only the loopback provider fixture", accepted?.url === "/v3/mail/send");
  check("Provider authorization header is confined to the transport", accepted?.authorization === `Bearer ${TEST_API_KEY}`);
  check("Provider credential is absent from the JSON body", !accepted?.body.includes(TEST_API_KEY));
  check("Multipart serialization is not used", accepted?.contentType.startsWith("application/json") && !accepted.contentType.includes("boundary="));
  check("Mail fields retain their accepted JSON semantics", JSON.parse(accepted?.body ?? "{}").subject === "Bounded transport");
  check("NO_PROXY bypasses the configured loopback proxy", proxyRequests === 0);

  Object.assign(process.env, savedProxyEnvironment);
  for (const key of Object.keys(savedProxyEnvironment) as Array<keyof typeof savedProxyEnvironment>) {
    if (savedProxyEnvironment[key] === undefined) delete process.env[key];
  }

  const beforeOversizedRequest = captured.length;
  await expectRejected(
    () => mail.send({
      to: "recipient@example.test",
      from: "sender@example.test",
      subject: "Bounded request",
      html: "x".repeat(SENDGRID_TRANSPORT_LIMITS.maxRequestBytes + 1),
    }),
    "Request just above the finite transport bound is rejected",
  );
  check("Oversized request is rejected before provider contact", captured.length === beforeOversizedRequest);

  mode = "oversized";
  await expectRejected(
    () => mail.send({
      to: "recipient@example.test",
      from: "sender@example.test",
      subject: "Bounded response",
      html: "<p>finite fixture</p>",
    }),
    "Response just above the finite transport bound is rejected",
  );

  mode = "redirect";
  const beforeRedirect = captured.length;
  await expectRejected(
    () => mail.send({
      to: "recipient@example.test",
      from: "sender@example.test",
      subject: "No redirects",
      html: "<p>finite fixture</p>",
    }),
    "Provider redirect is rejected",
  );
  check("Redirect target is not contacted", captured.length === beforeRedirect + 1);

  mode = "slow";
  mail.setTimeout(50);
  await expectRejected(
    () => mail.send({
      to: "recipient@example.test",
      from: "sender@example.test",
      subject: "Bounded timeout",
      html: "<p>finite fixture</p>",
    }),
    "Finite timeout produces a controlled rejection",
  );

  mode = "error";
  mail.setTimeout(SENDGRID_TRANSPORT_LIMITS.timeoutMs);
  await expectRejected(
    () => mail.send({
      to: "recipient@example.test",
      from: "sender@example.test",
      subject: "Provider error",
      html: "<p>finite fixture</p>",
    }),
    "Provider error produces a controlled rejection",
  );

  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceRoot = path.resolve(scriptDirectory, "../src");
  const expectedCallers = new Map([
    ["routes/auth.ts", 1],
    ["routes/files.ts", 2],
    ["routes/members.ts", 2],
    ["routes/project_directory.ts", 1],
    ["routes/submittals.ts", 3],
    ["routes/transmittals.ts", 1],
    ["lib/overdue-notifier.ts", 2],
  ]);

  for (const [relativePath, expectedCount] of expectedCallers) {
    const source = await readFile(path.join(sourceRoot, relativePath), "utf8");
    const actualCount = source.match(/\bsendEmail\s*\(\s*\{/g)?.length ?? 0;
    check(`${relativePath} retains ${expectedCount} inventoried mail call(s)`, actualCount === expectedCount);
  }

  const meetingSource = await readFile(path.join(sourceRoot, "routes/meeting_minutes.ts"), "utf8");
  check(
    "Meeting minutes remains an import-only non-consumer",
    meetingSource.includes('import { sendEmail } from "../lib/email"') &&
      !/\bsendEmail\s*\(\s*\{/.test(meetingSource),
  );

  console.log(JSON.stringify({
    passed: results.length,
    failed: 0,
    providerContacts: captured.length,
    proxyContacts: proxyRequests,
  }));
} finally {
  await Promise.all([close(provider), close(proxy)]);
}
