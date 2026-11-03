import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const panel = readFileSync("artifacts/bimlog/src/components/job-operations/BudgetGovernancePanel.tsx", "utf8");
for (const identity of [
  'post("/projects/:projectId/operations/budget/baselines"',
  'post("/projects/:projectId/operations/budget/variance-reviews"',
  'patch("/projects/:projectId/operations/budget/variance-reviews/:reviewId"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
for (const text of ["Budget Governance & Change Control", "Gobernanza del Presupuesto y Control de Cambios", "Freeze approved baseline", "Congelar línea base aprobada", "Mark resolved", "Marcar resuelta"]) assert.match(panel, new RegExp(text));
assert.match(panel, /selectedMetric = overruns\.some/);
assert.match(panel, /metric:selectedMetric/);
assert.match(panel, /expectedVersion:review\.version/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const test of ["artifacts/api-server/src/lib/job-operations.behavior.ts"]) {
  const result = spawnSync(process.execPath, [tsx, test], { stdio: "inherit", env: process.env, windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("P186 budget baseline, overrun selection, optimistic resolution, localization, evidence, and connected Operations gates passed.");
