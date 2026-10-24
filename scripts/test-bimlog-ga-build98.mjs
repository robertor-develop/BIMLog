import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build98-exact-head-release-contract.json", "utf8"));
assert.equal(contract.schemaVersion, "bimlog-ga-build98-exact-head-release-contract-v1");
assert.deepEqual(contract.candidateRange, [91, 100]);
assert.equal(new Set(contract.requiredLocalGates).size, 5);
for (const gate of ["test:bimlog-ga-block91-95", "test:bimlog-ga-build97", "check:living-brief", "build"]) {
  assert.ok(contract.requiredLocalGates.includes(gate), `missing release gate ${gate}`);
}
assert.deepEqual(contract.releaseRequirements, {
  workingTreeClean: true,
  normalPushOnly: true,
  replitBuildAtExactPushedHead: true,
  publishOnlyAfterSuccessfulReplitBuild: true,
  productionIdentityMustEqualCandidate: true,
  rollbackPredecessorMustBeRetained: true,
});
assert.deepEqual(contract.protectedTruth, {
  customerProjectMutationRequired: false,
  externalCredentialsRequiredForReleaseBuild: false,
  constructorMayAssignIndependentAcceptance: false,
});
console.log("BIMLog GA Build 98: PASS exact-head build, push, publish, identity and rollback contract");
