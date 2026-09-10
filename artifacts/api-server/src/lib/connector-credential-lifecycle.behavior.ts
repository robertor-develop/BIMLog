import assert from "node:assert/strict";
import { ConnectorCredentialLifecycleService, type ConnectorCredentialLifecycleStore } from "./connector-credential-lifecycle";
import { PostgresConnectorCredentialLifecycleStore, type ConnectorCredentialLifecyclePool } from "./connector-credential-lifecycle-postgres-store";
import { CoordinationConflictError } from "./coordination-hub-service";

const scope = { projectId: 71, companyId: 23, actorUserId: 11 };
const credential = {
  credentialId: "sharepoint-credential-1", provider: "sharepoint" as const, label: "Project SharePoint",
  state: "pending_validation" as const, keyVersion: 7, createdByUserId: 11,
  enrolledAt: "2026-09-09T20:00:00.000Z", mappedToProject: true,
};
const event = {
  event: "rotated_pending_validation" as const, credentialId: credential.credentialId, actorUserId: 11,
  occurredAt: "2026-09-09T21:00:00.000Z", previousKeyVersion: 4, keyVersion: 7, evidenceCode: null,
};

let observed: unknown;
const service = new ConnectorCredentialLifecycleService({ async read(input) { observed = input; return { credentials: [credential], events: [event] }; } });
assert.deepEqual(await service.read({ scope }), { projectId: 71, credentialLimit: 20, eventLimit: 50, credentials: [credential], events: [event] });
assert.deepEqual(observed, { scope, credentialLimit: 20, eventLimit: 50 });
await assert.rejects(() => service.read({ scope, credentialLimit: 51 }));
await assert.rejects(() => service.read({ scope, eventLimit: 101 }));
await assert.rejects(() => service.read({ scope, unexpected: true }));
const leakingStore: ConnectorCredentialLifecycleStore = { async read() { return { credentials: [{ ...credential, secretCiphertext: "forbidden" }] as never, events: [event] }; } };
await assert.rejects(() => new ConnectorCredentialLifecycleService(leakingStore).read({ scope }));

const calls: Array<{ sql: string; values?: unknown[] }> = [];
let released = false;
const pool: ConnectorCredentialLifecyclePool = {
  async connect() {
    return {
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql.includes("FROM users")) return { rows: [{ one: 1 }], rowCount: 1 };
        if (sql.includes("SELECT c.id AS")) return { rows: [{ ...credential, enrolledAt: new Date(credential.enrolledAt) }], rowCount: 1 };
        if (sql.includes("WITH project_credentials") && sql.includes("lifecycle_events")) return { rows: [{ ...event, occurredAt: new Date(event.occurredAt) }], rowCount: 1 };
        return { rows: [], rowCount: null };
      },
      release() { released = true; },
    };
  },
};
const postgres = new PostgresConnectorCredentialLifecycleStore(pool);
assert.deepEqual(await postgres.read({ scope, credentialLimit: 20, eventLimit: 50 }), { credentials: [credential], events: [event] });
assert.equal(released, true);
assert.match(calls[0]?.sql ?? "", /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
assert.match(calls[1]?.sql ?? "", /pm\.status='active' AND pm\.role='project_admin'/);
assert.deepEqual(calls[1]?.values, [11, 23, 71]);
assert.match(calls[2]?.sql ?? "", /project_credentials/);
assert.match(calls[2]?.sql ?? "", /sharepoint_project_mappings/);
assert.match(calls[2]?.sql ?? "", /details->>'projectId'=\$2::text/);
assert.match(calls[2]?.sql ?? "", /c\.company_id=\$1 AND c\.provider='sharepoint'/);
assert.deepEqual(calls[2]?.values, [23, 71, 20]);
assert.match(calls[3]?.sql ?? "", /'enrolled'::text/);
assert.match(calls[3]?.sql ?? "", /coordination_credential_rotated_pending_validation/);
assert.match(calls[3]?.sql ?? "", /coordination_credential_validation_rejected/);
assert.deepEqual(calls[3]?.values, [23, 71, 50]);
for (const call of [calls[2], calls[3]]) assert.doesNotMatch(call?.sql ?? "", /secret_ciphertext|secret_iv|secret_tag|wrapped_data_key|wrap_iv|wrap_tag|SELECT\s+\*/i);

let rolledBack = false;
const deniedPool: ConnectorCredentialLifecyclePool = {
  async connect() {
    return {
      async query(sql) {
        if (sql === "ROLLBACK") rolledBack = true;
        if (sql.includes("FROM users")) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: null };
      },
      release() {},
    };
  },
};
await assert.rejects(() => new PostgresConnectorCredentialLifecycleStore(deniedPool).read({ scope, credentialLimit: 20, eventLimit: 50 }), CoordinationConflictError);
assert.equal(rolledBack, true);

console.log("connector credential lifecycle projection behavior: PASS");
