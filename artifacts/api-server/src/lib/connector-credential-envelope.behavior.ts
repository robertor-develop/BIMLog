import assert from "node:assert/strict";
import {
  ConnectorCredentialEnvelopeError,
  EnvironmentConnectorKekLeaseSource,
  decryptConnectorBearerToken,
  encryptLeasedConnectorBearerToken,
  type ConnectorCredentialEnvelope,
  type ConnectorKekLeaseSource,
} from "./connector-credential-envelope";

const keyV1 = Buffer.alloc(32, 0x11);
const keyV2 = Buffer.alloc(32, 0x22);
const keys = new Map([[1, keyV1], [2, keyV2]]);
let lastLease: Buffer | null = null;
const keySource: ConnectorKekLeaseSource = {
  async withKey(version, operation) {
    const source = keys.get(version);
    if (!source) throw new ConnectorCredentialEnvelopeError();
    const lease = Buffer.from(source);
    lastLease = lease;
    try { return await operation(lease); }
    finally { lease.fill(0); }
  },
};
const context = { credentialId: "credential-1", companyId: 3, provider: "sharepoint" as const, keyVersion: 1 };
const original = "sharepoint-validation-token-value";
const token = Buffer.from(original, "utf8");
const envelope = await encryptLeasedConnectorBearerToken({ context, token, keySource });

assert.equal(token.every((byte) => byte === 0), true);
assert.equal(lastLease?.every((byte) => byte === 0), true);
assert.equal(JSON.stringify(envelope).includes(original), false);
for (const [name, value] of Object.entries(envelope)) {
  if (name !== "keyVersion") assert.match(String(value), /^[A-Za-z0-9_-]+$/);
}
const restored = await decryptConnectorBearerToken({ context, envelope, keySource });
assert.equal(restored.toString("utf8"), original);
assert.equal(lastLease?.every((byte) => byte === 0), true);
restored.fill(0);

for (const changedContext of [
  { ...context, credentialId: "credential-2" },
  { ...context, companyId: 4 },
  { ...context, keyVersion: 2 },
]) await assert.rejects(() => decryptConnectorBearerToken({ context: changedContext, envelope, keySource }), ConnectorCredentialEnvelopeError);

for (const field of ["secretCiphertext", "secretIv", "secretTag", "wrappedDataKey", "wrapIv", "wrapTag"] as const) {
  const value = envelope[field];
  const replacement = `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(() => decryptConnectorBearerToken({ context, envelope: { ...envelope, [field]: replacement }, keySource }), ConnectorCredentialEnvelopeError);
}
await assert.rejects(() => decryptConnectorBearerToken({ context, envelope: { ...envelope, secretIv: `${envelope.secretIv}=` }, keySource }), ConnectorCredentialEnvelopeError);
await assert.rejects(() => decryptConnectorBearerToken({ context, envelope: { ...envelope, unknown: "field" }, keySource }), ConnectorCredentialEnvelopeError);

const tokenV2 = Buffer.from("rotated-sharepoint-token-value", "utf8");
const contextV2 = { ...context, keyVersion: 2 };
const envelopeV2 = await encryptLeasedConnectorBearerToken({ context: contextV2, token: tokenV2, keySource });
const restoredV1 = await decryptConnectorBearerToken({ context, envelope, keySource });
const restoredV2 = await decryptConnectorBearerToken({ context: contextV2, envelope: envelopeV2, keySource });
assert.equal(restoredV1.toString("utf8"), original);
assert.equal(restoredV2.toString("utf8"), "rotated-sharepoint-token-value");
restoredV1.fill(0);
restoredV2.fill(0);

const missingKeySource: ConnectorKekLeaseSource = { withKey: async () => { throw new Error("sensitive key lookup detail"); } };
await assert.rejects(() => decryptConnectorBearerToken({ context, envelope, keySource: missingKeySource }), (error: unknown) => error instanceof ConnectorCredentialEnvelopeError && !error.message.includes("sensitive"));

const envKey = Buffer.alloc(32, 0x33).toString("base64url");
const environmentSource = new EnvironmentConnectorKekLeaseSource({ BIMLOG_CONNECTOR_KEK_V7: envKey });
let environmentLease: Uint8Array | null = null;
await environmentSource.withKey(7, async (lease) => { environmentLease = lease; assert.equal(lease.byteLength, 32); });
assert.equal(environmentLease?.every((byte) => byte === 0), true);
await assert.rejects(() => new EnvironmentConnectorKekLeaseSource({ BIMLOG_CONNECTOR_KEK_V7: `${envKey}=` }).withKey(7, async () => undefined), ConnectorCredentialEnvelopeError);

const shortToken = Buffer.from("short", "utf8");
await assert.rejects(() => encryptLeasedConnectorBearerToken({ context, token: shortToken, keySource }), ConnectorCredentialEnvelopeError);
assert.equal(shortToken.every((byte) => byte === 0), true);

const invalidRandomToken = Buffer.from(original, "utf8");
await assert.rejects(() => encryptLeasedConnectorBearerToken({ context, token: invalidRandomToken, keySource, randomSource: () => Buffer.alloc(1) }), ConnectorCredentialEnvelopeError);
assert.equal(invalidRandomToken.every((byte) => byte === 0), true);

const malformed = { ...envelope, keyVersion: 0 } as ConnectorCredentialEnvelope;
await assert.rejects(() => decryptConnectorBearerToken({ context, envelope: malformed, keySource }), ConnectorCredentialEnvelopeError);

console.log("connector credential envelope cryptographic behavior: PASS");
