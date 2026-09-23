import assert from "node:assert/strict";
import { loadActivatedEdtSource } from "./edt-engine-source-service";
import type { EdtTransactionClient } from "./edt-engine-transaction";

let status = "activated";
let companyId = 7;
const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
const client: EdtTransactionClient = { async query<Row>(sql, values) {
  queries.push({ sql, values });
  if (sql.includes("FROM job_intakes")) return { rows: companyId === 7 ? [{ id: "intake-1", company_id: 7, project_id: 11, status, revision: 4, data: { scopeItems: [] }, activation_summary: { activationMode: "commercial" } }] as Row[] : [] };
  if (sql.includes("FROM projects")) return { rows: [{ id: 11, code: "P11", name: "Project 11" }] as Row[] };
  if (sql.includes("FROM job_activation_work_items")) return { rows: [{ id: "wi-1", stableScopeItemId: "scope-1", contractId: "contract-1", contractVersionId: "version-1", status: "active" }] as Row[] };
  return { rows: [] };
} };
const source = await loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "intake-1" });
assert.equal(source.workItems[0].contractId, "contract-1");
assert.deepEqual(queries[0].values, ["intake-1", 7, 11]);
status = "ready";
await assert.rejects(() => loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "intake-1" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_SOURCE_NOT_ACTIVATED");
status = "activated"; companyId = 8;
await assert.rejects(() => loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "intake-1" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "INTAKE_NOT_FOUND");
console.log("EDT_ENGINE_BUILD321_RESULT=PASS activated source is scoped and saved Work Items are required");
