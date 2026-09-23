import assert from "node:assert/strict";
import { loadActivatedEdtSource } from "./edt-engine-source-service";
import type { EdtTransactionClient } from "./edt-engine-transaction";

let canonicalContractId = "contract-1";
let canonicalCompany = 7;
const queries: { sql: string; values?: readonly unknown[] }[] = [];
const client: EdtTransactionClient = { async query<Row>(sql: string, values?: readonly unknown[]) {
  queries.push({ sql, values });
  if (sql.includes("FROM job_intakes")) return { rows: [{ id: "i", company_id: 7, project_id: 11, status: "activated", revision: 2,
    data: {}, activation_summary: { contracts: [{ profileId: "A", contractId: "contract-1", contractVersionId: "version-1" }] } }] as Row[] };
  if (sql.includes("FROM projects")) return { rows: [{ id: 11, code: "P11", name: "Project" }] as Row[] };
  if (sql.includes("FROM job_activation_work_items")) return { rows: [{ id: "w", stableScopeItemId: "scope", contractId: "contract-1", contractVersionId: "version-1", status: "active" }] as Row[] };
  if (sql.includes("FROM financial_contracts")) return { rows: canonicalCompany === 7 ? [{ contractId: canonicalContractId, versionId: "version-1", currency: "USD", contentFingerprint: "b".repeat(64) }] as Row[] : [] };
  return { rows: [] };
}, release() {} };
await loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "i" });
assert.ok(queries.some(query => query.sql.includes("FROM financial_contracts") && query.sql.includes("c.company_id=$1") && query.sql.includes("c.project_id=$2") && query.values?.[0] === 7 && query.values?.[1] === 11));
canonicalContractId = "other";
await assert.rejects(() => loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "i" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CONTRACT_SOURCE_MISMATCH");
canonicalContractId = "contract-1"; canonicalCompany = 8;
await assert.rejects(() => loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "i" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CONTRACT_SOURCE_MISMATCH");
console.log("EDT_ENGINE_BUILD331_RESULT=PASS activated Contract versions remain canonical and tenant-bound");
