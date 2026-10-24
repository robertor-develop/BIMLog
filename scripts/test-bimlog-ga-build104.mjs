import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const handoff = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build104-viva-handoff.json", "utf8"));
assert.equal(handoff.schemaVersion, "bimlog-ga-build104-viva-handoff-v1");
assert.equal(handoff.reviewTarget, "Build 105 exact pushed candidate");
assert.doesNotThrow(() => execFileSync("git", ["merge-base", "--is-ancestor", handoff.publishedBaseline, "HEAD"]));
for (const result of Object.values(handoff.constructorEvidence)) assert.equal(result, "PASS");
assert.deepEqual(handoff.protectedTruth, {
  customerProductionMutation: false,
  temporaryProjectDeletionExecuted: false,
  commercialSecretsConfiguredByThisProgram: false,
  constructorAssignedIndependentVerdict: false,
});
assert.equal(handoff.independentAcceptance, "AWAITING_VIVA_REVIEW");
assert.equal(handoff.customerFieldAcceptance, "SEPARATE_WHERE_REQUIRED");
assert.deepEqual(handoff.publicationCadence, { lastPublishedBuild: 100, pushAfterBuild: 105, nextPublishAfterBuild: 110, unpublishedBuildsAfterPush: 5 });
console.log("BIMLog GA Build 104: PASS independent Viva handoff and five-build cadence separation");
