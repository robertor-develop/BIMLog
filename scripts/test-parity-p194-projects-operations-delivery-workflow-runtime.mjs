import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const runtime = readFileSync("artifacts/api-server/src/lib/delivery-workflow-runtime.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/components/job-operations/WorkItemDeliveryWorkflowPanel.tsx", "utf8");
for (const identity of [
  'get("/projects/:projectId/operations/work-items/:workItemId/delivery-workflow"',
  'patch("/projects/:projectId/operations/work-items/:workItemId/delivery-workflow/roles/:role"',
  'patch("/projects/:projectId/operations/work-items/:workItemId/delivery-workflow/steps/:phaseId/:taskId"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
for (const contract of [
  /DELIVERY_WORKFLOW_REVISION_REQUIRED/,
  /DELIVERY_WORKFLOW_STALE/,
  /DELIVERY_WORKFLOW_ROLE_REQUIRED/,
  /DELIVERY_WORKFLOW_ROLE_MEMBER_INVALID/,
  /DELIVERY_WORKFLOW_STEP_NOT_CURRENT/,
  /DELIVERY_WORKFLOW_STEP_STATUS_INVALID/,
  /WORKFLOW_POLICY_SNAPSHOT_MISMATCH/,
]) assert.match(runtime, contract);
for (const text of [
  "Open Delivery Workflow",
  "Abrir flujo de entrega",
  "Frozen activation snapshot",
  "Instantánea congelada de activación",
  "Role assignments",
  "Asignaciones de funciones",
  "Complete checkpoint",
  "Completar punto de control",
]) assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(ui, /expectedRevision: runtime\.revision/);
assert.match(ui, /aria-expanded=\{open\}/);
assert.match(ui, /role="alert"/);

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
console.log("P194 delivery-workflow read, frozen snapshot, role assignment, checkpoint execution, optimistic revision, tenant/project membership, localization, accessibility, persistence, and connected PostgreSQL gates passed.");
