import assert from "node:assert/strict";
import { jobIntakeActivationMatches, jobIntakeActivationPreview, jobIntakeActivationStructure, jobIntakeActiveChangeDestinations, jobIntakeBlockerDestination } from "./job-intake-activation-preview";

assert.deepEqual(jobIntakeBlockerDestination("job_name"), { stage: "identity", item: "ji-job-name" });
assert.deepEqual(jobIntakeBlockerDestination("budget_mapping"), { stage: "contract", item: "ji-scope" });
assert.deepEqual(jobIntakeBlockerDestination("delivery"), { stage: "delivery", item: "ji-submittal-strategy" });
assert.deepEqual(jobIntakeBlockerDestination("confirmations"), { stage: "review", item: "ji-review" });
const preview = jobIntakeActivationPreview({ scopeItems: [{ workPackages: [] }], team: { assignments: [{ userId: null }, { userId: 9 }] }, commercial: { contracts: [{}, {}] } }, { totals: { unassignedHours: "18" } }, true);
assert.equal(preview.workItems, 1);
assert.equal(preview.tasks, 1);
assert.equal(preview.namedAssignments, 1);
assert.equal(preview.genericResourceDemands, 1);
assert.equal(preview.unassignedHours, "18");
assert.equal(preview.contractDrafts, 2);
assert.equal(preview.resourcePlans, 1);
assert.equal(jobIntakeActivationMatches(preview, { workItems: [{}], tasks: [{}], assignments: [{}] }), true);
assert.equal(jobIntakeActivationMatches(preview, { workItems: [{}, {}], tasks: [{}], assignments: [{}] }), false);
assert.equal(jobIntakeActivationStructure("draft", preview, null).mode, "preview");
assert.equal(jobIntakeActivationStructure("draft", preview, { workItems: [{}], tasks: [{}], assignments: [] }).mode, "created");
assert.deepEqual(jobIntakeActivationStructure("activated", preview, { workItems: [{}, {}], tasks: [{}], assignments: [{}, {}, {}] }), { mode: "created", workItems: 2, tasks: 1, resourcePlans: 3, namedAssignments: 3, genericResourceDemands: 0, unassignedHours: "0", contractDrafts: 0 });
assert.deepEqual(jobIntakeActiveChangeDestinations(41, true), {
  operations: "/projects/41/operations?returnTo=%2Fprojects%2F41%2Fintake%3Fstage%3Dreview%26item%3Dji-review",
  contracts: "/projects/41/financial/contracts?returnTo=%2Fprojects%2F41%2Fintake%3Fstage%3Dreview%26item%3Dji-review",
});
assert.equal(jobIntakeActiveChangeDestinations(41, false).contracts, null);
console.log("job intake activation preview behavior: PASS");
