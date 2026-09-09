import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptLeasedConnectorBearerToken, type ConnectorKekLeaseSource } from "./connector-credential-envelope";
import { PostgresConnectorCredentialLeaseResolver, type ConnectorCredentialLeasePool } from "./connector-credential-lease-resolver";
import { ConnectorValidationUnavailableError } from "./coordination-hub-configuration-service";

const key = randomBytes(32);
const keySource: ConnectorKekLeaseSource = {
  async withKey(_version, operation) {
    const lease = Buffer.from(key);
    try { return await operation(lease); }
    finally { lease.fill(0); }
  },
};
const context = { credentialId: "sharepoint-credential-1", companyId: 41, provider: "sharepoint" as const, keyVersion: 8 };
const originalToken = Buffer.from("sharepoint-test-token-that-never-leaves-the-lease", "utf8");
const envelope = await encryptLeasedConnectorBearerToken({ context, token: originalToken, keySource });

function bytes(value: string): Buffer { return Buffer.from(value, "ascii"); }
function selectedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    idBytes: bytes(context.credentialId), companyId: context.companyId, providerBytes: bytes(context.provider), stateBytes: bytes("pending_validation"),
    secretCiphertextBytes: bytes(envelope.secretCiphertext), secretIvBytes: bytes(envelope.secretIv), secretTagBytes: bytes(envelope.secretTag),
    wrappedDataKeyBytes: bytes(envelope.wrappedDataKey), wrapIvBytes: bytes(envelope.wrapIv), wrapTagBytes: bytes(envelope.wrapTag), keyVersion: envelope.keyVersion,
    ...overrides,
  };
}

const calls: Array<{ sql: string; values?: unknown[] }> = [];
let released = false;
const row = selectedRow();
const database: ConnectorCredentialLeasePool = {
  async connect() {
    return {
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql.startsWith("SELECT")) return { rows: [row], rowCount: 1 };
        return { rows: [], rowCount: null };
      },
      release() { released = true; },
    };
  },
};

let leased: Uint8Array | undefined;
const resolver = new PostgresConnectorCredentialLeaseResolver(database, {
  async withKey(version, operation) {
    assert.equal(released, true, "decryption must occur only after the read-only transaction releases its client");
    return keySource.withKey(version, operation);
  },
});
assert.equal(await resolver.withBearerToken({ credentialId: context.credentialId, companyId: context.companyId, provider: context.provider }, async (token) => {
  leased = token;
  assert.equal(Buffer.from(token).toString("utf8"), "sharepoint-test-token-that-never-leaves-the-lease");
  return "operation-complete";
}), "operation-complete");
assert.equal(leased?.every((value) => value === 0), true);
assert.equal(Object.values(row).filter(Buffer.isBuffer).every((value) => value.every((byte) => byte === 0)), true);
assert.match(calls[0]?.sql ?? "", /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
assert.match(calls[1]?.sql ?? "", /id=\$1 AND company_id=\$2 AND provider=\$3 AND state='pending_validation'/);
assert.doesNotMatch(calls[1]?.sql ?? "", /SELECT\s+\*/i);
assert.deepEqual(calls[1]?.values, [context.credentialId, context.companyId, context.provider]);
assert.equal(calls[2]?.sql, "COMMIT");

async function rejectingPool(result: { rows: Array<Record<string, unknown>>; rowCount: number }): Promise<ConnectorCredentialLeasePool> {
  return { async connect() { return { async query(sql) { return sql.startsWith("SELECT") ? result : { rows: [], rowCount: null }; }, release() {} }; } };
}
for (const result of [
  { rows: [], rowCount: 0 },
  { rows: [selectedRow(), selectedRow()], rowCount: 2 },
  { rows: [selectedRow({ stateBytes: bytes("active") })], rowCount: 1 },
  { rows: [selectedRow({ companyId: 99 })], rowCount: 1 },
  { rows: [selectedRow({ secretTagBytes: bytes("malformed") })], rowCount: 1 },
]) {
  const denied = new PostgresConnectorCredentialLeaseResolver(await rejectingPool(result), keySource);
  await assert.rejects(
    () => denied.withBearerToken({ credentialId: context.credentialId, companyId: context.companyId, provider: context.provider }, async () => undefined),
    (error: unknown) => error instanceof ConnectorValidationUnavailableError && error.message === "Protected connector credential lease is unavailable",
  );
  for (const rejectedRow of result.rows) assert.equal(Object.values(rejectedRow).filter(Buffer.isBuffer).every((value) => value.every((byte) => byte === 0)), true);
}

const operationRow = selectedRow();
let failedLease: Uint8Array | undefined;
const operationFailure = new PostgresConnectorCredentialLeaseResolver(await rejectingPool({ rows: [operationRow], rowCount: 1 }), keySource);
await assert.rejects(() => operationFailure.withBearerToken({ credentialId: context.credentialId, companyId: context.companyId, provider: context.provider }, async (token) => { failedLease = token; throw new Error("bounded operation failure"); }), /bounded operation failure/);
assert.equal(failedLease?.every((value) => value === 0), true);
assert.equal(Object.values(operationRow).filter(Buffer.isBuffer).every((value) => value.every((byte) => byte === 0)), true);

key.fill(0);
console.log("PostgreSQL connector credential lease resolver behavior: PASS");
