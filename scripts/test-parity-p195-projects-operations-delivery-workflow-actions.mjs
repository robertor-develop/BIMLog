import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const runtime = readFileSync("artifacts/api-server/src/lib/delivery-workflow-runtime.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/components/job-operations/WorkItemDeliveryWorkflowPanel.tsx", "utf8");
for (const action of ["evidence", "qc", "approval", "advance", "reopen"]) {
  assert.ok(route.includes(`/delivery-workflow/${action}`), `${action} must remain routed`);
}
for (const contract of [
  /DELIVERY_WORKFLOW_DOCUMENT_REQUIRED/,
  /DELIVERY_WORKFLOW_DOCUMENT_CODE_INVALID/,
  /DELIVERY_WORKFLOW_FILE_NOT_FOUND/,
  /DELIVERY_WORKFLOW_EVIDENCE_EXISTS/,
  /DELIVERY_WORKFLOW_INDEPENDENT_REVIEW_REQUIRED/,
  /DELIVERY_WORKFLOW_QC_REQUIRED/,
  /DELIVERY_WORKFLOW_APPROVAL_REQUIRED/,
  /WORKFLOW_POLICY_APPROVAL_REQUIRED/,
  /DELIVERY_WORKFLOW_REASON_REQUIRED/,
  /DELIVERY_WORKFLOW_REOPEN_TARGET_INVALID/,
]) assert.match(runtime, contract);
for (const text of [
  "Required evidence",
  "Evidencia requerida",
  "Approve QC",
  "Aprobar control de calidad",
  "Record next policy approval",
  "Registrar próxima aprobación de política",
  "Advance phase",
  "Avanzar fase",
  "Required reason",
  "Motivo obligatorio",
  "Previous decisions remain in history.",
]) assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(ui, /completedOwnWork/);
assert.match(ui, /governanceDecisionMessage/);

const result = spawnSync(process.execPath, [
  "scripts/workflow-database-fixture.mjs", "--run", "delivery_runtime_test", "--", process.execPath,
  "artifacts/api-server/node_modules/tsx/dist/cli.mjs",
  "artifacts/api-server/src/lib/delivery-workflow-runtime.http-evidence.ts",
], {
  stdio: "inherit",
  env: { ...process.env, BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL: "postgresql://postgres@127.0.0.1:55449/postgres" },
  windowsHide: true,
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P195 delivery-workflow evidence, QC, independent approval, governed advance, reopen reason, immutable history, error recovery, localization, accessibility, persistence, and connected PostgreSQL gates passed.");
