import assert from "node:assert/strict";
import { ConnectorValidationOperationsService, type ConnectorValidationOperationsStore } from "./connector-validation-operations";
import { PostgresConnectorValidationOperationsStore, type ConnectorValidationOperationsPool } from "./connector-validation-operations-postgres-store";
import { CoordinationConflictError } from "./coordination-hub-service";

const scope = { projectId: 71, companyId: 23, actorUserId: 11 };
const operation = {
  credentialId: "sharepoint-credential-1", provider: "sharepoint" as const, credentialState: "active" as const,
  keyVersion: 4, decision: "activated" as const, evidenceCode: "SHAREPOINT_GRAPH_AUTHORIZED", actorUserId: 11,
  occurredAt: "2026-09-09T19:30:00.000Z",
};
let observed: unknown;
const service = new ConnectorValidationOperationsService({ async list(input) { observed = input; return [operation]; } });
assert.deepEqual(await service.list({ scope }), { projectId: 71, limit: 20, operations: [operation] });
assert.deepEqual(observed, { scope, limit: 20 });
await assert.rejects(() => service.list({ scope, limit: 51 }));
await assert.rejects(() => service.list({ scope, limit: 1, unexpected: true }));
await assert.rejects(() => new ConnectorValidationOperationsService({ async list() { return [{ ...operation, secretCiphertext: "forbidden" }] as never; } }).list({ scope }));

const calls: Array<{ sql: string; values?: unknown[] }> = [];
let released = false;
const pool: ConnectorValidationOperationsPool = {
  async connect() {
    return {
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql.includes("FROM users")) return { rows: [{ one: 1 }], rowCount: 1 };
        if (sql.includes("FROM admin_actions_log")) return { rows: [{ ...operation, occurredAt: new Date(operation.occurredAt) }], rowCount: 1 };
        return { rows: [], rowCount: null };
      },
      release() { released = true; },
    };
  },
};
const postgres = new PostgresConnectorValidationOperationsStore(pool);
assert.deepEqual(await postgres.list({ scope, limit: 20 }), [operation]);
assert.equal(released, true);
assert.match(calls[0]?.sql ?? "", /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
assert.match(calls[1]?.sql ?? "", /pm\.status='active' AND pm\.role='project_admin'/);
assert.deepEqual(calls[1]?.values, [11, 23, 71]);
assert.match(calls[2]?.sql ?? "", /c\.company_id=\$2 AND c\.provider='sharepoint'/);
assert.match(calls[2]?.sql ?? "", /a\.details->>'projectId'=\$3::text/);
assert.match(calls[2]?.sql ?? "", /ORDER BY a\.created_at DESC,a\.id DESC LIMIT \$4/);
assert.doesNotMatch(calls[2]?.sql ?? "", /secret_ciphertext|secret_iv|secret_tag|wrapped_data_key|wrap_iv|wrap_tag|SELECT\s+\*/i);
assert.deepEqual(calls[2]?.values, [11, 23, 71, 20]);
assert.equal(calls[3]?.sql, "COMMIT");

let rolledBack = false;
const deniedPool: ConnectorValidationOperationsPool = { async connect() { return {
  async query(sql) { if (sql === "ROLLBACK") rolledBack = true; return sql.includes("FROM users") ? { rows: [], rowCount: 0 } : { rows: [], rowCount: null }; },
  release() {},
}; } };
await assert.rejects(() => new PostgresConnectorValidationOperationsStore(deniedPool).list({ scope, limit: 20 }), CoordinationConflictError);
assert.equal(rolledBack, true);

const leakingStore: ConnectorValidationOperationsStore = { async list() { return [{ ...operation, envelope: "forbidden" }] as never; } };
await assert.rejects(() => new ConnectorValidationOperationsService(leakingStore).list({ scope }));
console.log("connector validation operational projection behavior: PASS");
