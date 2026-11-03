import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const routes = readFileSync("artifacts/api-server/src/routes/projects.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/project-retirement.ts", "utf8");
const retireUi = readFileSync("artifacts/bimlog/src/components/ProjectRetirementDialog.tsx", "utf8");
const restoreUi = readFileSync("artifacts/bimlog/src/components/ProjectRestoreDialog.tsx", "utf8");
const dashboard = readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");

for (const identity of [
  'get("/projects/:projectId/retirement-preview"',
  'post("/projects/:projectId/retire"',
  'post("/projects/:projectId/restore"',
]) assert.ok(routes.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);

for (const contract of [
  "GA_PROTECTED_PROJECT",
  "PROJECT_RETIREMENT_FORBIDDEN",
  "PROJECT_RETIREMENT_CONFIRMATION_MISMATCH",
  "PROJECT_RETIREMENT_PREVIEW_STALE",
  "PROJECT_RESTORATION_CONFIRMATION_MISMATCH",
  "PROJECT_RESTORATION_PREVIEW_STALE",
  "PROJECT_RESTORATION_CONCURRENT_CHANGE",
  "recordsPreserved: true",
  'action: "retire_project"',
  'action: "restore_project"',
]) assert.match(service, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

for (const text of [
  "No records will be deleted.", "No se eliminará ningún registro.",
  "Type ${preview.projectCode} to confirm", "Escriba ${preview.projectCode} para confirmar",
  "Every preserved record remains attached.", "Cada registro preservado permanece vinculado.",
  "Type ${project.code} to confirm", "Escriba ${project.code} para confirmar",
]) assert.ok(`${retireUi}\n${restoreUi}`.includes(text), `${text} must remain visible`);

assert.match(retireUi, /role="alert"/);
assert.match(restoreUi, /role="alert"/);
assert.match(dashboard, /Project retired\. Every record was preserved\./);
assert.match(dashboard, /Project restored to the active workspace\./);

const result = spawnSync(process.execPath, [
  "artifacts/api-server/node_modules/tsx/dist/cli.mjs",
  "artifacts/api-server/src/lib/project-retirement-inventory.behavior.ts",
], { stdio: "inherit", windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P197 project retirement/restore authority, protected-project denial, exact confirmation, optimistic concurrency, preservation inventory, audit, bilingual lifecycle, error, and success gates passed.");
