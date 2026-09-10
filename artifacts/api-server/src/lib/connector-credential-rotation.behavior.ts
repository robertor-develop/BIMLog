import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConnectorCredentialRotationService, type ConnectorCredentialRotator } from "./connector-credential-rotation";
import { ConnectorCredentialEnrollmentInputError, decodeCanonicalConnectorEnrollmentToken } from "./connector-credential-enrollment";
import { decryptConnectorBearerToken, type ConnectorKekLeaseSource } from "./connector-credential-envelope";

const key = randomBytes(32);
const keySource: ConnectorKekLeaseSource = {
  async withKey(version, operation) {
    assert.equal(version, 14);
    const lease = Buffer.from(key);
    try { return await operation(lease); }
    finally { lease.fill(0); }
  },
};
let rotated: Parameters<ConnectorCredentialRotator["rotateCredential"]>[0] | undefined;
const rotator: ConnectorCredentialRotator = {
  async rotateCredential(input) {
    rotated = input;
    return { result: "rotated", credentialId: "credential-12", state: "pending_validation", previousKeyVersion: 12, keyVersion: 14 };
  },
};
const service = new ConnectorCredentialRotationService(rotator, keySource, { current: () => 14 });
const token = decodeCanonicalConnectorEnrollmentToken(Buffer.from("replacement-token-material-never-persisted", "utf8").toString("base64url"));
assert.deepEqual(await service.rotate({
  scope: { projectId: 7, companyId: 3, actorUserId: 5 },
  credential: { id: "credential-12", provider: "sharepoint", token },
  expectedState: "active",
  expectedKeyVersion: 12,
}), { result: "rotated", credentialId: "credential-12", state: "pending_validation", previousKeyVersion: 12, keyVersion: 14 });
assert.equal(token.every((byte) => byte === 0), true);
assert.ok(rotated);
assert.equal(JSON.stringify(rotated).includes("replacement-token-material"), false);
assert.deepEqual({ ...rotated, credential: { ...rotated?.credential, envelope: undefined } }, {
  scope: { projectId: 7, companyId: 3, actorUserId: 5 },
  credential: { id: "credential-12", provider: "sharepoint", envelope: undefined },
  expectedState: "active",
  expectedKeyVersion: 12,
});
const decrypted = await decryptConnectorBearerToken({
  context: { credentialId: "credential-12", companyId: 3, provider: "sharepoint", keyVersion: 14 },
  envelope: rotated?.credential.envelope,
  keySource,
});
assert.equal(decrypted.toString("utf8"), "replacement-token-material-never-persisted");
decrypted.fill(0);

for (const candidate of [
  { scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential: { id: "credential-12", provider: "sharepoint", token: Buffer.from("valid-rotation-token-material") }, expectedState: "pending_validation", expectedKeyVersion: 12 },
  { scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential: { id: "credential-12", provider: "sharepoint", token: Buffer.from("valid-rotation-token-material"), envelope: rotated?.credential.envelope }, expectedState: "active", expectedKeyVersion: 12 },
  { scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential: { id: "credential-12", provider: "outlook", token: Buffer.from("valid-rotation-token-material") }, expectedState: "active", expectedKeyVersion: 12 },
]) {
  const candidateToken = candidate.credential.token;
  await assert.rejects(() => service.rotate(candidate), ConnectorCredentialEnrollmentInputError);
  assert.equal(candidateToken.every((byte) => byte === 0), true);
}

const failingToken = Buffer.from("valid-rotation-token-for-cas-conflict", "utf8");
const failingService = new ConnectorCredentialRotationService({ async rotateCredential() { throw new Error("bounded compare-and-set conflict"); } }, keySource, { current: () => 14 });
await assert.rejects(() => failingService.rotate({ scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential: { id: "credential-12", provider: "sharepoint", token: failingToken }, expectedState: "active", expectedKeyVersion: 12 }), /bounded compare-and-set conflict/);
assert.equal(failingToken.every((byte) => byte === 0), true);

key.fill(0);
console.log("connector credential rotation behavior: PASS");
