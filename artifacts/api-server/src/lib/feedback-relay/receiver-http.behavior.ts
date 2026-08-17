import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { randomUUID, X509Certificate, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  FeedbackReceiverCustodyService,
  type ReceiverNonceAuthority,
} from "./receiver-service.js";
import { createReceiverHttpsHandler } from "./receiver-http.js";
import { NativeHttpsRelayTransport } from "./transport.js";
import {
  sha256,
  signRequest,
  verifyReceipt,
  type RelayKeyRing,
  type RequestContract,
} from "./protocol.js";
const proofRoot = process.env.BIMLOG_FEEDBACK_TLS_TEST_ROOT;
if (!proofRoot || !path.isAbsolute(proofRoot))
  throw new Error(
    "BIMLOG_FEEDBACK_TLS_TEST_ROOT must bind an absolute disposable test root",
  );
const disposable = path.join(proofRoot, randomUUID()),
  custody = path.join(disposable, "custody");
fs.mkdirSync(custody, { recursive: true });
const keyPath = path.join(disposable, "localhost.key"),
  certPath = path.join(disposable, "localhost.crt"),
  openssl = process.env.BIMLOG_TEST_OPENSSL || "openssl";
if (
  spawnSync(
    openssl,
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost",
    ],
    { stdio: "ignore" },
  ).status !== 0
)
  throw new Error("Disposable TLS generation failed");
const key = fs.readFileSync(keyPath),
  cert = fs.readFileSync(certPath),
  x509 = new X509Certificate(cert),
  pins = {
    leafSha256: createHash("sha256").update(x509.raw).digest("hex"),
    spkiSha256: `sha256-${createHash("sha256")
      .update(x509.publicKey.export({ type: "spki", format: "der" }))
      .digest("base64")}`,
  };
const now = new Date("2026-08-17T18:00:00.000Z"),
  ring = (id: string, value: string): RelayKeyRing => ({
    activeKeyId: id,
    keys: [
      {
        id,
        secret: Buffer.from(value),
        status: "active",
        notBefore: new Date("2026-01-01T00:00:00.000Z"),
        notAfter: new Date("2027-01-01T00:00:00.000Z"),
      },
    ],
  });
const sender = ring("sender-key", "sender-0123456789abcdef0123456789"),
  receiver = ring("receiver-key", "receiver-0123456789abcdef01234567"),
  seen = new Map<string, string>(),
  nonces: ReceiverNonceAuthority = {
    reserve: async (v) => {
      const known = seen.get(v.nonce);
      if (known)
        return known === v.requestSha256
          ? { token: `retry:${v.nonce}`, status: "identical-retry" }
          : null;
      return {
        token: `new:${v.nonce}:${v.requestSha256}`,
        status: "new",
      };
    },
    commit: async (token) => {
      if (token.startsWith("new:")) {
        const [, nonce, hash] = token.split(":");
        seen.set(nonce, hash);
      }
    },
    rollback: async () => undefined,
  };
let scannerCalls = 0;
const service = new FeedbackReceiverCustodyService(
    {
      canonicalRoot: custody,
      rootFingerprintSha256:
        FeedbackReceiverCustodyService.fingerprintRoot(custody),
      destinationId: "receiver-http",
    },
    sender,
    receiver,
    nonces,
    30_000,
  ),
  handler = createReceiverHttpsHandler({
    service,
    maxRequestBytes: 1024,
    now: () => now,
    scanner: async (stagedPath) => {
      scannerCalls++;
      const bytes = await fs.promises.readFile(stagedPath);
      return {
        verdict: "clean",
        scannerAdapter: "loopback-malware-scanner",
        inspectedAt: now.toISOString(),
        inspectedMediaType: "application/pdf",
        mediaKind: "document",
        byteCount: bytes.length,
        sha256: sha256(bytes),
      };
    },
  });
const server = https.createServer({ key, cert }, handler);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Missing loopback port");
const transport = new NativeHttpsRelayTransport(
    `https://localhost:${address.port}`,
    pins,
    "receiver-http",
    https.request,
    cert,
  ),
  bytes = Buffer.from("receiver https bytes"),
  request: RequestContract = {
    version: "1",
    method: "PUT",
    path: "/v1/objects/object-http",
    query: "",
    audience: "receiver-http",
    keyId: "sender-key",
    timestamp: now.toISOString(),
    nonce: "nonce-http",
    requestId: "request-http",
    companyId: "company-http",
    projectId: "project-http",
    feedbackId: "FB-HTTP",
    objectId: "object-http",
    byteCount: bytes.length,
    sha256: sha256(bytes),
    bodySha256: sha256(bytes),
  },
  envelope = Buffer.from(
    JSON.stringify(signRequest(request, sender, now)),
  ).toString("base64url");
let passed = 0;
const check = async (name: string, fn: () => unknown | Promise<unknown>) => {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
};
try {
  await check(
    "native HTTPS receiver binds protocol scanner custody and signed receipt",
    async () => {
      const response = await transport.request({
        method: "PUT",
        path: request.path,
        body: bytes,
        maxResponseBytes: 4096,
        headers: {
          "x-bimlog-signed-request": envelope,
          "content-type": "application/pdf",
          "x-bimlog-media-kind": "document",
        },
      });
      assert.equal(response.status, 201);
      assert.equal(
        verifyReceipt(JSON.parse(response.body.toString()), receiver, now)
          .requestId,
        request.requestId,
      );
    },
  );
  await check(
    "forged envelope is rejected before scanner or body custody",
    async () => {
      const before = scannerCalls;
      const forged = JSON.parse(Buffer.from(envelope, "base64url").toString());
      forged.signature = `${forged.signature.slice(0, -1)}0`;
      const response = await transport.request({
        method: "PUT",
        path: request.path,
        body: bytes,
        maxResponseBytes: 4096,
        headers: {
          "x-bimlog-signed-request": Buffer.from(
            JSON.stringify(forged),
          ).toString("base64url"),
          "content-type": "application/pdf",
          "x-bimlog-media-kind": "document",
        },
      });
      assert.equal(response.status, 409);
      assert.match(
        response.body.toString(),
        /SIGNATURE_INVALID|REQUEST_CONFLICT/,
      );
      assert.equal(scannerCalls, before);
    },
  );
  await check(
    "HTTP path mutation is rejected with zero alternate custody",
    async () => {
      const response = await transport.request({
        method: "PUT",
        path: "/v1/objects/other",
        body: bytes,
        maxResponseBytes: 4096,
        headers: {
          "x-bimlog-signed-request": envelope,
          "content-type": "application/pdf",
          "x-bimlog-media-kind": "document",
        },
      });
      assert.equal(response.status, 422);
      assert.match(response.body.toString(), /HTTP_BINDING_MISMATCH/);
    },
  );
  console.log(`feedback receiver native HTTPS behavior: ${passed}/${passed}`);
} finally {
  transport.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(disposable, { recursive: true, force: true });
}
