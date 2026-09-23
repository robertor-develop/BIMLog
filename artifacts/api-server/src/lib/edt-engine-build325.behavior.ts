import assert from "node:assert/strict";
import { previewActivatedEdtPlan } from "./edt-engine-plan-projection";
import type { EdtTransactionHost } from "./edt-engine-transaction";

const statements: string[] = [];
const host: EdtTransactionHost = { async connect() { return { async query<Row>(sql: string, values?: readonly unknown[]) {
  statements.push(sql);
  if (sql.includes("FROM job_intakes")) return { rows: values?.[1] === 7 ? [{ id: "intake-1", company_id: 7, project_id: 11, status: "activated", revision: 4,
    data: { commercial: { contracts: [{ id: "BASE", contractNumber: "B1", title: "Base" }] }, scopeItems: [{ id: "scope-1", contractId: "BASE", deliverableType: "SLEEVE", workPackages: [{ id: "wp-1", dimensionType: "floor", dimensionValue: "L2", classification: { disciplineId: "discipline-1", disciplineCode: "HVAC" } }] }] },
    activation_summary: { contracts: [{ profileId: "BASE", contractId: "contract-1", contractVersionId: "version-1" }] } }] as Row[] : [] };
  if (sql.includes("FROM projects")) return { rows: [{ id: 11, code: "P11", name: "Project 11" }] as Row[] };
  if (sql.includes("FROM job_activation_work_items")) return { rows: [{ id: "wi-1", stableScopeItemId: "scope-1", contractId: "contract-1", contractVersionId: "version-1", status: "active" }] as Row[] };
  if (sql.includes("FROM financial_contracts")) return { rows: [{ contractId: "contract-1", versionId: "version-1", currency: "USD", contentFingerprint: "a".repeat(64) }] as Row[] };
  return { rows: [] };
}, release() {} }; } };
const result = await previewActivatedEdtPlan({ companyId: 7, projectId: 11, intakeId: "intake-1" }, host);
assert.equal(result.workItems.length, 1);
assert.match(result.sourceFingerprint, /^[a-f0-9]{64}$/);
assert.equal(statements[0], "BEGIN ISOLATION LEVEL SERIALIZABLE");
assert.equal(statements.at(-1), "COMMIT");
assert.ok(statements.every(sql => !/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql)));
await assert.rejects(() => previewActivatedEdtPlan({ companyId: 8, projectId: 11, intakeId: "intake-1" }, host), (error: unknown) => error instanceof Error && "code" in error && error.code === "INTAKE_NOT_FOUND");
assert.equal(statements.at(-1), "ROLLBACK");
console.log("EDT_ENGINE_BUILD325_RESULT=PASS authorized read-only preview transaction and company isolation");
