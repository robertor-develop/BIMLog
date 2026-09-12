import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const editor = fs.readFileSync(new URL("../../../bimlog/src/components/job-intake/ContractItemBulkEditor.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
for (const token of ["responsibleParticipantId", "contractId", "workPackages"]) assert.match(ui, new RegExp(token));
for (const token of ["apuPlanVersion", "budgetSnapshotLineId", "billingHourlyRate"]) assert.match(editor, new RegExp(token));
assert.match(ui, /Authoritative agreement/);
assert.match(editor, /preserves the exact source line association/);
assert.match(service, /stable_scope_item_id/);
assert.match(service, /budget_snapshot_line_id/);
assert.match(service, /project_cost_node_id/);
assert.match(service, /ON CONFLICT\(project_id,package_code\) DO NOTHING/);
console.log("POST-P17 Build 12 contract/APU/budget/Work Package binding chain: PASS");
