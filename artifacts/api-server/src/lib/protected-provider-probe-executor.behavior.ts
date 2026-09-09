import assert from "node:assert/strict";
import { ConnectorValidationUnavailableError } from "./coordination-hub-configuration-service";
import {
  FixedGraphProtectedProviderProbeExecutor,
  type ProtectedBearerLeaseResolver,
  type ProtectedFetchTransport,
} from "./protected-provider-probe-executor";

const request = {
  credentialId: "credential-1",
  companyId: 3,
  provider: "sharepoint" as const,
  request: {
    method: "GET" as const,
    url: "https://graph.microsoft.com/v1.0/sites/root?$select=id",
    redirect: "error" as const,
    timeoutMs: 10_000 as const,
    maxResponseBytes: 4_096 as const,
    accept: "application/json" as const,
  },
};

let leasedToken = Buffer.from("token-used-only-inside-protected-lease", "utf8");
let leaseClosed = false;
const resolver: ProtectedBearerLeaseResolver = {
  async withBearerToken(input, operation) {
    assert.deepEqual(input, { credentialId: "credential-1", companyId: 3, provider: "sharepoint" });
    try { return await operation(leasedToken); }
    finally { leaseClosed = true; }
  },
};
let cancelled = 0;
const transportCalls: Array<{ url: string; init: Parameters<ProtectedFetchTransport>[1] }> = [];
const transport: ProtectedFetchTransport = async (url, init) => {
  transportCalls.push({ url, init });
  return {
    status: 200,
    headers: { get: (name) => name === "request-id" ? "request-1" : null },
    body: { cancel: async () => { cancelled += 1; } },
  };
};
const executor = new FixedGraphProtectedProviderProbeExecutor(resolver, transport);

assert.deepEqual(await executor.execute(request), { status: 200, providerRequestId: "request-1" });
assert.equal(leaseClosed, true);
assert.equal(cancelled, 1);
assert.equal(leasedToken.every((byte) => byte === 0), true);
assert.equal(transportCalls.length, 1);
assert.equal(transportCalls[0]?.url, request.request.url);
assert.equal(transportCalls[0]?.init.method, "GET");
assert.equal(transportCalls[0]?.init.redirect, "error");
assert.equal(transportCalls[0]?.init.headers.accept, "application/json");
assert.match(transportCalls[0]?.init.headers.authorization ?? "", /^Bearer /);
assert.equal(JSON.stringify(transportCalls[0]).includes("secretCiphertext"), false);

leasedToken = Buffer.from("another-protected-token-value", "utf8");
const noRequestId = new FixedGraphProtectedProviderProbeExecutor(resolver, async () => ({ status: 401, headers: { get: () => "unsafe request id with spaces" }, body: null }));
assert.deepEqual(await noRequestId.execute(request), { status: 401 });
assert.equal(leasedToken.every((byte) => byte === 0), true);

for (const changed of [
  { ...request, request: { ...request.request, url: "https://example.invalid/v1.0/sites/root?$select=id" } },
  { ...request, request: { ...request.request, redirect: "follow" as "error" } },
  { ...request, request: { ...request.request, timeoutMs: 20_000 as 10_000 } },
  { ...request, companyId: 0 },
]) await assert.rejects(() => executor.execute(changed), ConnectorValidationUnavailableError);

leasedToken = Buffer.from("transport-failure-token-value", "utf8");
const failedTransport = new FixedGraphProtectedProviderProbeExecutor(resolver, async () => { throw new Error("sensitive upstream failure"); });
await assert.rejects(() => failedTransport.execute(request), (error: unknown) => error instanceof ConnectorValidationUnavailableError && !error.message.includes("sensitive"));
assert.equal(leasedToken.every((byte) => byte === 0), true);

leasedToken = Buffer.from("response-cancel-failure-token", "utf8");
const failedCancellation = new FixedGraphProtectedProviderProbeExecutor(resolver, async () => ({ status: 200, headers: { get: () => null }, body: { cancel: async () => { throw new Error("body failure"); } } }));
await assert.rejects(() => failedCancellation.execute(request), ConnectorValidationUnavailableError);
assert.equal(leasedToken.every((byte) => byte === 0), true);

const invalidLease = new FixedGraphProtectedProviderProbeExecutor({ withBearerToken: async (_input, operation) => operation(new Uint8Array([1, 2, 3])) }, transport);
await assert.rejects(() => invalidLease.execute(request), ConnectorValidationUnavailableError);

console.log("protected SharePoint provider probe executor behavior: PASS");
