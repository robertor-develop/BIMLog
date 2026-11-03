import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/job-operations-service.ts", "utf8");
const governance = readFileSync("artifacts/api-server/src/lib/floor-hour-cost-governance.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
for (const identity of ['post("/projects/:projectId/operations/floor-hour-estimates"', 'post("/projects/:projectId/operations/floor-hour-estimates/:estimateVersionId/decision"']) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
assert.match(service, /location_identity "locationIdentity"/);
for (const contract of [/FLOOR_HOUR_LOCATION_REQUIRED/, /FLOOR_HOUR_POLICY_REQUIRED/, /FLOOR_HOUR_CEO_APPROVAL_REQUIRED/, /FLOOR_HOUR_VERSION_NOT_PENDING/, /writeAllocationRun/]) assert.match(route + governance, contract);
for (const text of ["Propose floor-hour estimate", "Proponer estimado de horas del piso", "Pending CEO decision", "Decisión del CEO pendiente", "Only the configured CEO authority", "Solo la autoridad configurada del CEO"]) assert.match(ui, new RegExp(text));
assert.match(ui, /floor-hour-estimates\/\$\{estimate\.id\}\/decision/);
assert.match(ui, /trim\(\)\.length<10/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result = spawnSync(process.execPath, [tsx, "artifacts/api-server/src/lib/ux-block26-internal-cost.behavior.ts"], { stdio: "inherit", env: { ...process.env, PROD_DATABASE_URL: process.env.PROD_DATABASE_URL ?? "postgresql://bimlog_test:bimlog_test@127.0.0.1:55439/bimlog_rfi_test" }, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P189 floor-hour proposal/decision, CEO authorization, prerequisite, persistence, cost-allocation, localization, and UI recovery gates passed.");
