import assert from "node:assert/strict";
import { loadActivatedEdtSource } from "./edt-engine-source-service";
import type { EdtTransactionClient } from "./edt-engine-transaction";

const queries: { sql: string; values?: readonly unknown[] }[] = [];
const client: EdtTransactionClient = { async query<Row>(sql: string, values?: readonly unknown[]) {
  queries.push({ sql, values });
  if (sql.includes("FROM job_intakes")) return { rows: [{ id: "intake", company_id: 7, project_id: 11, status: "activated", revision: 2, data: {}, activation_summary: { contracts: [{ profileId: "A", contractId: "contract", contractVersionId: "version" }] } }] as Row[] };
  if (sql.includes("FROM projects")) return { rows: values?.[1] === 7 ? [{ id: 11, code: "P11", name: "Project" }] as Row[] : [] };
  if (sql.includes("FROM financial_contracts")) return { rows: [{ contractId: "contract", versionId: "version", currency: "USD", contentFingerprint: "a".repeat(64) }] as Row[] };
  return { rows: [{ id: "wi", stableScopeItemId: "scope", contractId: "contract", contractVersionId: "version", status: "active" }] as Row[] };
}, release() {} };
const source = await loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "intake" });
assert.equal(source.project.id, 11);
assert.ok(queries.some(query => query.sql.includes("FROM projects") && query.sql.includes("company_id=$2") && query.values?.[1] === 7));
console.log("EDT_ENGINE_BUILD326_RESULT=PASS canonical project lookup remains company-scoped");
