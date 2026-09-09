import assert from "node:assert/strict";
import { ConnectorValidationUnavailableError } from "./coordination-hub-configuration-service";
import { SharePointCredentialValidator, type ProtectedProviderProbeExecutor } from "./sharepoint-credential-validator";

const baseInput = {
  credentialId: "credential-1",
  companyId: 3,
  projectId: 7,
  provider: "sharepoint" as const,
  label: "Coordination SharePoint",
  keyVersion: 1,
  configurationDigest: "a".repeat(64),
};
const calls: unknown[] = [];
let probeResult: unknown = { status: 200, providerRequestId: "request-1" };
const executor: ProtectedProviderProbeExecutor = { execute: async (input) => { calls.push(input); return probeResult; } };
const validator = new SharePointCredentialValidator({
  enabled: true,
  providerApprovals: "3:sharepoint:validate",
  graphOrigin: "https://graph.microsoft.com",
  executor,
});

assert.deepEqual(await validator.validate(baseInput), { valid: true, evidenceCode: "SHAREPOINT_GRAPH_AUTHORIZED" });
const call = calls[0] as Record<string, unknown>;
assert.deepEqual(call, {
  credentialId: "credential-1",
  companyId: 3,
  provider: "sharepoint",
  request: {
    method: "GET",
    url: "https://graph.microsoft.com/v1.0/sites/root?$select=id",
    redirect: "error",
    timeoutMs: 10_000,
    maxResponseBytes: 4_096,
    accept: "application/json",
  },
});
assert.equal(JSON.stringify(call).includes("secret"), false);
assert.equal(JSON.stringify(call).includes("envelope"), false);
assert.equal(JSON.stringify(call).includes(baseInput.configurationDigest), false);

for (const [status, evidenceCode] of [[401, "SHAREPOINT_CREDENTIAL_REJECTED"], [403, "SHAREPOINT_SCOPE_DENIED"], [404, "SHAREPOINT_ROOT_SITE_UNAVAILABLE"]] as const) {
  probeResult = { status };
  assert.deepEqual(await validator.validate(baseInput), { valid: false, evidenceCode });
}

for (const status of [408, 425, 429, 500, 502, 503, 504]) {
  probeResult = { status };
  await assert.rejects(() => validator.validate(baseInput), ConnectorValidationUnavailableError);
}
probeResult = { status: 200, body: { id: "must-not-cross-boundary" } };
await assert.rejects(() => validator.validate(baseInput), /invalid governed result/);

const disabled = new SharePointCredentialValidator({ enabled: false, providerApprovals: "3:sharepoint:validate", graphOrigin: "https://graph.microsoft.com", executor });
await assert.rejects(() => disabled.validate(baseInput), ConnectorValidationUnavailableError);
const unapproved = new SharePointCredentialValidator({ enabled: true, providerApprovals: "4:sharepoint:validate", graphOrigin: "https://graph.microsoft.com", executor });
await assert.rejects(() => unapproved.validate(baseInput), ConnectorValidationUnavailableError);
const unsafeOrigin = new SharePointCredentialValidator({ enabled: true, providerApprovals: "3:sharepoint:validate", graphOrigin: "https://example.invalid", executor });
await assert.rejects(() => unsafeOrigin.validate(baseInput), ConnectorValidationUnavailableError);
await assert.rejects(() => validator.validate({ ...baseInput, provider: "outlook" }), ConnectorValidationUnavailableError);
await assert.rejects(() => validator.validate({ ...baseInput, configurationDigest: "invalid" }), /digest is invalid/);

const failedExecutor = new SharePointCredentialValidator({
  enabled: true,
  providerApprovals: "3:sharepoint:validate",
  graphOrigin: "https://graph.microsoft.com",
  executor: { execute: async () => { throw new Error("sensitive provider text"); } },
});
await assert.rejects(() => failedExecutor.validate(baseInput), (error: unknown) => error instanceof ConnectorValidationUnavailableError && !error.message.includes("sensitive"));

console.log("SharePoint credential validator behavior: PASS");
