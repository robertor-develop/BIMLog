import assert from "node:assert/strict";
import { previewActivatedEdtPlan } from "./edt-engine-plan-projection";
import type { EdtTransactionHost } from "./edt-engine-transaction";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";

type Fault = "none" | "contract" | "workflow" | "trade";
let fault: Fault = "none";
const statements: string[] = [];
const workflow = BIMLOG_DELIVERY_WORKFLOWS[0];
const host: EdtTransactionHost = { async connect() { return { async query<Row>(sql: string) {
  statements.push(sql);
  if (sql.includes("FROM job_intakes")) return { rows: [{ id: "intake-1", company_id: 7, project_id: 11, status: "activated", revision: 4,
    data: { commercial: { contracts: [{ id: "BASE", contractNumber: "B1", title: "Base" }] }, scopeItems: [{ id: "scope-1", contractId: "BASE", deliverableType: "SLEEVE",
      workPackages: [{ id: "wp-1", dimensionType: "floor", dimensionValue: "L2", classification: { disciplineId: "trade-1", disciplineCode: "HVAC" } }] }] },
    activation_summary: { contracts: [{ profileId: "BASE", contractId: "contract-1", contractVersionId: "version-1" }] } }] as Row[] };
  if (sql.includes("FROM projects")) return { rows: [{ id: 11, code: "P11", name: "Project 11" }] as Row[] };
  if (sql.includes("FROM job_activation_work_items")) return { rows: [{ id: "wi-1", stableScopeItemId: "scope-1", contractId: "contract-1", contractVersionId: "version-1", status: "active" }] as Row[] };
  if (sql.includes("FROM financial_contracts")) return { rows: fault === "contract" ? [] : [{ contractId: "contract-1", versionId: "version-1", currency: "USD", contentFingerprint: "a".repeat(64) }] as Row[] };
  if (sql.includes("FROM company_delivery_workflow_work_items")) return { rows: fault === "workflow" ? [] : [{ workItemId: "wi-1", source: "bimlog", versionId: null,
    templateCode: workflow.code, templateVersion: 1, definition: workflow.definition, fingerprint: workflow.fingerprint }] as Row[] };
  if (sql.includes("FROM enterprise_trades")) return { rows: fault === "trade" ? [] : [{ id: "trade-1" }] as Row[] };
  return { rows: [] };
}, release() {} }; } };

const input = { companyId: 7, projectId: 11, intakeId: "intake-1" };
const plan = await previewActivatedEdtPlan(input, host);
assert.equal(plan.workItems.length, 1);
assert.match(plan.sourceFingerprint, /^[a-f0-9]{64}$/);
assert.equal(statements.at(-1), "COMMIT");
for (const [mode, code] of [["contract", "EDT_CONTRACT_SOURCE_MISMATCH"], ["workflow", "EDT_WORKFLOW_SOURCE_MISSING"], ["trade", "EDT_TRADE_SOURCE_MISMATCH"]] as const) {
  fault = mode;
  await assert.rejects(() => previewActivatedEdtPlan(input, host), (error: unknown) => error instanceof Error && "code" in error && error.code === code);
  assert.equal(statements.at(-1), "ROLLBACK");
}
assert.ok(statements.every(sql => !/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql)));
console.log("EDT_ENGINE_BUILD335_RESULT=PASS canonical source chain, read-only preview, and fail-closed rollback");
