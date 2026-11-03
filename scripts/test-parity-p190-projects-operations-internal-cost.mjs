import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const governance = readFileSync("artifacts/api-server/src/lib/internal-cost-governance.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
for (const identity of [
  'post("/projects/:projectId/operations/internal-cost/policies"',
  'post("/projects/:projectId/operations/internal-cost/profiles"',
  'post("/projects/:projectId/operations/internal-cost/:kind/:versionId/decision"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
assert.match(route, /\['policies', 'profiles'\]\.includes\(req\.params\.kind\)/);
assert.match(route, /INTERNAL_COST_KIND_INVALID/);
assert.match(route, /INTERNAL_COST_MANAGE_DENIED/);
for (const contract of [/INTERNAL_COST_CEO_APPROVAL_REQUIRED/, /INTERNAL_COST_VERSION_NOT_PENDING/, /resolveApprovedMemberInternalCost/, /effective_from/, /content_fingerprint/]) assert.match(governance, contract);
for (const text of ["Internal cost governance", "Gobernanza del costo interno", "Propose controlled internal-cost policy", "Proponer política controlada de costo interno", "Approve profile", "Aprobar perfil"]) assert.match(ui, new RegExp(text));
assert.match(ui, /customer billing never changes/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result = spawnSync(process.execPath, [tsx, "artifacts/api-server/src/lib/ux-block26-internal-cost.behavior.ts"], { stdio: "inherit", env: { ...process.env, PROD_DATABASE_URL: process.env.PROD_DATABASE_URL ?? "postgresql://bimlog_test:bimlog_test@127.0.0.1:55439/bimlog_rfi_test" }, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P190 internal-cost policy/profile proposal and decision, invalid-kind rejection, CEO authorization, effective-date persistence, localization, and financial isolation gates passed.");
