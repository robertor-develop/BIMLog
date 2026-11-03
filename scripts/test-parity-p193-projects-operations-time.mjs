import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/job-operations-service.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
assert.match(route, /post\("\/projects\/:projectId\/operations\/time"/);
assert.match(route, /result\.idempotent \? 200 : 201/);
for (const contract of [
  /JOB_OPERATIONS_TIME_DENIED/,
  /JOB_OPERATIONS_ASSIGNMENT_INVALID/,
  /JOB_OPERATIONS_ASSIGNMENT_REQUIRED/,
  /JOB_OPERATIONS_HOURS_INVALID/,
  /JOB_OPERATIONS_DATE_INVALID/,
  /JOB_OPERATIONS_TIME_ID_CONFLICT/,
  /time_recorded/,
  /refreshFloorHourCostForWorkItem/,
]) assert.match(service, contract);
for (const text of [
  "Record actual hours",
  "Registrar horas reales",
  "Actual hours recorded.",
  "Horas reales registradas.",
  "Select a priced assignment",
  "Seleccione una asignación valorizada",
]) assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(ui, /defaultValue=\{taskAssignments\(task\.id\)\.length === 1/);
assert.match(ui, /crypto\.randomUUID\(\)/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result = spawnSync(process.execPath, [tsx, "artifacts/api-server/src/lib/terminal-ga-build008-time-custody.behavior.ts"], { stdio: "inherit", windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P193 actual-time recorder authorization, priced-assignment selection, project/task isolation, bounded date-hours, exact replay, conflict rejection, persistence, review continuity, localization, and evidence gates passed.");
