import assert from "node:assert/strict";
import { decideGovernedEdtChange } from "./edt-engine-governed-change-service";
import type { EdtTransactionClient, EdtTransactionHost } from "./edt-engine-transaction";

const actor = { grants: ["GOVERNED_CHANGE_APPROVE"] as const, actorUserId: 41, actorCompanyId: 7, actorProjectIds: [11], eligibleRole: "OPERATIONS_DIRECTOR" };
const calls: string[] = [];
const client: EdtTransactionClient = {
  async query<Row>(sql: string) {
    calls.push(sql);
    if (sql.includes("FROM job_governed_change_requests")) return { rows: [{
      id: "change-1", company_id: 7, project_id: 11, requested_by_id: 30,
      request_fingerprint: "fingerprint", state: "pending", action_type: "extra_hours",
    }] as Row[] };
    return { rows: [], rowCount: 1 };
  },
};
const host: EdtTransactionHost = { async connect() { return client; } };
const base = { actor, companyId: 7, projectId: 11, requestId: "change-1", expectedFingerprint: "fingerprint", reason: "reviewed", evidence: {} };
await assert.rejects(() => decideGovernedEdtChange({ ...base, outcome: "approved" }, host), (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "GOVERNED_ACTION_NOT_EXECUTABLE");
assert.ok(calls.includes("ROLLBACK"));
assert.equal(calls.some(sql => sql.includes("INSERT INTO job_governed_change_decisions")), false);
calls.length = 0;
const rejected = await decideGovernedEdtChange({ ...base, outcome: "rejected" }, host);
assert.equal(rejected.outcome, "rejected");
assert.ok(calls.some(sql => sql.includes("INSERT INTO job_governed_change_decisions")));
console.log("EDT_ENGINE_BUILD307_RESULT=PASS unsupported approvals cannot create false audit decisions");
