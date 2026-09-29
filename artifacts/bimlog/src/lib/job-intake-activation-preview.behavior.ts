import assert from "node:assert/strict";
import { jobIntakeActivationMatches, jobIntakeActivationPreview, jobIntakeBlockerDestination } from "./job-intake-activation-preview";

assert.deepEqual(jobIntakeBlockerDestination("job_name"), { stage: "identity", item: "ji-identity" });
assert.deepEqual(jobIntakeBlockerDestination("budget_mapping"), { stage: "contract", item: "ji-contract" });
assert.deepEqual(jobIntakeBlockerDestination("confirmations"), { stage: "review", item: "ji-review" });
const preview = jobIntakeActivationPreview({ scopeItems: [{ workPackages: [] }], team: { assignments: [{ userId: null }, { userId: 9 }] }, commercial: { contracts: [{}, {}] } }, { totals: { unassignedHours: "18" } }, true);
assert.equal(preview.workItems, 1);
assert.equal(preview.tasks, 1);
assert.equal(preview.namedAssignments, 1);
assert.equal(preview.genericResourceDemands, 1);
assert.equal(preview.unassignedHours, "18");
assert.equal(preview.contractDrafts, 2);
assert.equal(jobIntakeActivationMatches(preview, { workItems: [{}], tasks: [{}], assignments: [{}, {}] }), true);
assert.equal(jobIntakeActivationMatches(preview, { workItems: [{}, {}], tasks: [{}], assignments: [{}, {}] }), false);
console.log("job intake activation preview behavior: PASS");
