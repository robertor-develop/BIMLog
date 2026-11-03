import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/job-operations-service.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
assert.match(route, /post\("\/projects\/:projectId\/operations\/priced-assignments"/);
for (const contract of [
  /JOB_OPERATIONS_PRICED_ASSIGNMENT_DENIED/,
  /JOB_OPERATIONS_PRICED_ASSIGNEE_MISMATCH/,
  /JOB_OPERATIONS_PRICED_ASSIGNMENT_ID_CONFLICT/,
  /JOB_OPERATIONS_PRICED_ASSIGNMENT_CONFLICT/,
  /JOB_OPERATIONS_PRICED_HOURS_EXCEEDED/,
  /JOB_OPERATIONS_TIME_ALREADY_PRICED/,
  /resolveApprovedMemberInternalCost/,
  /customerBillingRateChanged: false/,
  /optimistic_version=optimistic_version\+1/,
]) assert.match(service, contract);
for (const text of [
  "Bind governed priced staffing",
  "Vincular personal valorizado controlado",
  "Create priced assignment and bind time",
  "Crear asignación valorizada y vincular tiempo",
  "Customer/APU pricing is preserved",
  "Se conserva el precio al cliente/APU",
]) assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(ui, /profile\.status==="approved"/);
assert.match(ui, /entry\.assignmentId\)\?\.id \?\? null/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result = spawnSync(process.execPath, [tsx, "artifacts/api-server/src/lib/terminal-ga-build009-priced-staffing.behavior.ts"], { stdio: "inherit", env: { ...process.env, PROD_DATABASE_URL: process.env.PROD_DATABASE_URL ?? "postgresql://bimlog_test:bimlog_test@127.0.0.1:55439/bimlog_rfi_test" }, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P192 priced-assignment authorization, approved-rate resolution, project/task isolation, idempotency, arithmetic, time rebinding, customer-price separation, localization, and evidence gates passed.");
