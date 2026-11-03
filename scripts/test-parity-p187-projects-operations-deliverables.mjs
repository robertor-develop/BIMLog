import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/job-operations-service.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
for (const identity of [
  'post("/projects/:projectId/operations/deliverables"',
  'delete("/projects/:projectId/operations/deliverables/:deliverableId"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
for (const contract of [/JOB_OPERATIONS_DELIVERABLE_DENIED/, /JOB_OPERATIONS_FILE_INVALID/, /JOB_OPERATIONS_DELIVERABLE_NOT_FOUND/, /eventType: "deliverable_linked"/, /eventType: "deliverable_unlinked"/]) assert.match(service, contract);
for (const text of ["Connect deliverable", "Conectar entregable", "No active project file is available", "No hay un archivo activo del proyecto", "Link removed", "Vínculo eliminado"]) assert.match(ui, new RegExp(text));
assert.match(ui, /disabled=\{busy \|\| !task\.canControl \|\| data\.files\.length === 0\}/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result = spawnSync(process.execPath, [tsx, "artifacts/api-server/src/lib/job-operations.behavior.ts"], { stdio: "inherit", env: process.env, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P187 deliverable create/remove, file isolation, authorization, empty-state recovery, evidence, localization, and connected Operations gates passed.");
