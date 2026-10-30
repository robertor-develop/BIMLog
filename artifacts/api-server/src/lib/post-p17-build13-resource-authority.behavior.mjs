import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const plan = fs.readFileSync(new URL("../../../bimlog/src/components/job-intake/GenericResourcePlan.tsx", import.meta.url), "utf8");
const operations = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
// Intake now plans roles; named member assignment remains in Job Operations.
assert.match(ui, /Named people can be assigned later in Job Operations/);
assert.match(ui, /GenericResourcePlan/);
assert.match(plan, /Manage named assignments in Job Operations/);
assert.match(operations, /data\.members\.map/);
for (const token of ["contractId", "scopeItemId", "workPackageId", "plannedHours", "internalHourlyRate"]) assert.match(plan, new RegExp(token));
assert.match(plan, /userId:null/);
assert.match(plan, /Estimated internal cost \/ hour/);
assert.match(service, /JOB_ACTIVATION_ASSIGNMENT_PACKAGE_INVALID/);
assert.match(service, /planned_internal_cost/);
assert.match(service, /planned_billable_value/);
console.log("POST-P17 Build 13 planned-role/resource authority and named Operations assignment: PASS");
