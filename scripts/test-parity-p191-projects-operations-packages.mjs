import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/job-operations-service.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");

for (const identity of [
  'post("/projects/:projectId/operations/packages"',
  'patch("/projects/:projectId/operations/packages/:packageId"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
for (const contract of [
  /JOB_OPERATIONS_PACKAGE_MANAGE_DENIED/,
  /JOB_OPERATIONS_PACKAGE_CONTROL_DENIED/,
  /JOB_OPERATIONS_PACKAGE_TASKS_INVALID/,
  /JOB_OPERATIONS_PACKAGE_TRANSITION_INVALID/,
  /JOB_OPERATIONS_STALE/,
  /work_package_created/,
  /work_package_updated/,
]) assert.match(route + service, contract);
for (const text of [
  "Work packages",
  "Paquetes de trabajo",
  "Create package",
  "Crear paquete",
  "Save package",
  "Guardar paquete",
  "The package code is generated automatically when you save.",
]) assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(ui, /form\.getAll\("taskIds"\)/);
assert.match(ui, /expectedVersion: pkg\.version/);
assert.match(ui, /pkg\.canControl/);
assert.match(ui, /@media\(max-width:900px\)/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result = spawnSync(process.execPath, [tsx, "artifacts/api-server/src/lib/job-work-packages.behavior.ts"], { stdio: "inherit", windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P191 work-package create/update, manager/responsible authorization, task isolation, lifecycle, optimistic persistence, localization, accessibility, responsive, and evidence gates passed.");
