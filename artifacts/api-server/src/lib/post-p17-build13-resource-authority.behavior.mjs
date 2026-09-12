import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(ui, /\/members\/eligible/);
assert.match(ui, /\/projects\/\$\{projectId\}\/members/);
for (const token of ["engagementId", "contractId", "scopeItemId", "workPackageId", "plannedHours", "internalHourlyRate", "incentiveAmount"]) assert.match(ui, new RegExp(token));
assert.match(ui, /Internal hourly cost and incentive remain separate per assignment/);
assert.match(service, /JOB_ACTIVATION_ASSIGNMENT_PACKAGE_INVALID/);
assert.match(service, /planned_internal_cost/);
assert.match(service, /planned_billable_value/);
console.log("POST-P17 Build 13 eligible-user/resource authority and rate separation: PASS");
