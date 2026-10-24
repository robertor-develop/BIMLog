import assert from "node:assert/strict";
import fs from "node:fs";

const handoff = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build94-viva-handoff.json", "utf8"));
assert.equal(handoff.schemaVersion, "bimlog-ga-build94-viva-handoff-v1");
assert.deepEqual(handoff.buildRange, [71, 95]);
assert.equal(handoff.reviewTarget, "Build 95 exact pushed candidate");
for (const result of Object.values(handoff.constructorEvidence)) assert.equal(result, "PASS");
assert.deepEqual(handoff.protectedTruth, {
  customerProductionMutation: false,
  temporaryProjectDeletionExecuted: false,
  commercialSecretsConfiguredByThisProgram: false,
  constructorAssignedIndependentVerdict: false,
});
assert.equal(handoff.independentAcceptance, "AWAITING_VIVA_REVIEW");
assert.equal(handoff.customerFieldAcceptance, "SEPARATE_WHERE_REQUIRED");
assert.deepEqual(handoff.publicationCadence, { lastPublishedBuild: 90, pushAfterBuild: 95, nextPublishAfterBuild: 100, unpublishedBuildsAfterPush: 5 });
console.log("BIMLog GA Build 94: PASS independent Viva handoff and acceptance-state separation");
