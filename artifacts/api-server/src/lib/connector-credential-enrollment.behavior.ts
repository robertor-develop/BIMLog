import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  ConnectorCredentialEnrollmentInputError,
  ConnectorCredentialEnrollmentService,
  EnvironmentConnectorEnrollmentKeyVersionSource,
  decodeCanonicalConnectorEnrollmentToken,
  type ConnectorCredentialRegistrar,
} from "./connector-credential-enrollment";
import { decryptConnectorBearerToken, type ConnectorKekLeaseSource } from "./connector-credential-envelope";

const key = randomBytes(32);
const keySource: ConnectorKekLeaseSource = {
  async withKey(version, operation) {
    assert.equal(version, 12);
    const lease = Buffer.from(key);
    try { return await operation(lease); }
    finally { lease.fill(0); }
  },
};
let registered: Parameters<ConnectorCredentialRegistrar["registerCredential"]>[0] | undefined;
const registrar: ConnectorCredentialRegistrar = {
  async registerCredential(input) { registered = input; return { result: "created", credentialId: "credential-12", state: "pending_validation" }; },
};
const service = new ConnectorCredentialEnrollmentService(registrar, keySource, { current: () => 12 });
const token = Buffer.from("server-side-enrollment-test-token-never-persisted", "utf8");
const result = await service.enroll({ scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential: { id: "credential-12", provider: "sharepoint", label: "Project SharePoint", token } });
assert.deepEqual(result, { result: "created", credentialId: "credential-12", state: "pending_validation" });
assert.equal(token.every((byte) => byte === 0), true);
assert.ok(registered);
assert.equal(JSON.stringify(registered).includes("server-side-enrollment-test-token"), false);
assert.deepEqual(registered?.scope, { projectId: 7, companyId: 3, actorUserId: 5 });
assert.deepEqual({ ...registered?.credential, envelope: undefined }, { id: "credential-12", provider: "sharepoint", label: "Project SharePoint", envelope: undefined });
const decrypted = await decryptConnectorBearerToken({ context: { credentialId: "credential-12", companyId: 3, provider: "sharepoint", keyVersion: 12 }, envelope: registered?.credential.envelope, keySource });
assert.equal(decrypted.toString("utf8"), "server-side-enrollment-test-token-never-persisted");
decrypted.fill(0);

const encoded = Buffer.from("canonical-base64url-enrollment-token", "utf8").toString("base64url");
const decoded = decodeCanonicalConnectorEnrollmentToken(encoded);
assert.equal(decoded.toString("utf8"), "canonical-base64url-enrollment-token");
decoded.fill(0);
for (const invalid of [`${encoded}=`, "contains spaces", "short", { token: encoded }]) {
  assert.throws(() => decodeCanonicalConnectorEnrollmentToken(invalid), ConnectorCredentialEnrollmentInputError);
}
assert.equal(new EnvironmentConnectorEnrollmentKeyVersionSource({ BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION: "19" }).current(), 19);
for (const environment of [{}, { BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION: "0" }, { BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION: "01" }, { BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION: "2147483648" }]) {
  assert.throws(() => new EnvironmentConnectorEnrollmentKeyVersionSource(environment).current(), ConnectorCredentialEnrollmentInputError);
}

for (const credential of [
  { id: "credential-12", provider: "sharepoint", label: "Project SharePoint", token: Buffer.from("too-short") },
  { id: "credential-12", provider: "sharepoint", label: "Project SharePoint", token: Buffer.from("valid-token-material-but-extra-field"), envelope: registered?.credential.envelope },
  { id: "credential-12", provider: "outlook", label: "Project SharePoint", token: Buffer.from("valid-token-material-for-wrong-provider") },
]) {
  const candidate = credential.token;
  await assert.rejects(() => service.enroll({ scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential }), ConnectorCredentialEnrollmentInputError);
  assert.equal(candidate.every((byte) => byte === 0), true);
}

const failingToken = Buffer.from("valid-token-material-for-registration-failure", "utf8");
const failingService = new ConnectorCredentialEnrollmentService({ async registerCredential() { throw new Error("bounded registration failure"); } }, keySource, { current: () => 12 });
await assert.rejects(() => failingService.enroll({ scope: { projectId: 7, companyId: 3, actorUserId: 5 }, credential: { id: "credential-12", provider: "sharepoint", label: "Project SharePoint", token: failingToken } }), /bounded registration failure/);
assert.equal(failingToken.every((byte) => byte === 0), true);

key.fill(0);
console.log("connector credential server-side enrollment behavior: PASS");
