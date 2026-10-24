import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(
  "evidence/outcome-remediation-20261023/build50-ten-build-publication-contract.json",
  "utf8",
));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.equal(contract.build, 50);
assert.deepEqual(contract.blocks, [3, 4]);
assert.deepEqual(contract.buildRange, [41, 50]);
assert.equal(contract.controlledProjectId, 68);
assert.equal(contract.controlledProjectCode, "QA-LOR-FINAL-1023");
assert.equal(contract.requiredRoutes.length, 7);
assert.equal(contract.requiredAssertions.length, 8);
assert.equal(contract.evidencePolicy.exactCandidateRequired, true);
assert.equal(contract.evidencePolicy.hardReloadRequired, true);
assert.equal(contract.evidencePolicy.freshAuthenticatedTabRequired, true);
assert.equal(contract.evidencePolicy.historicalEvidenceRejected, true);

for (let build = 41; build <= 49; build += 1) {
  assert.ok(pkg.scripts[`test:bimlog-final-build${build}`], `Build ${build} must remain bound`);
}

console.log("BIMLog final closure Build 50: PASS ten-build publication contract");
