import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(
  "evidence/outcome-remediation-20261023/build55-schedule-block-contract.json",
  "utf8",
));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.equal(contract.build, 55);
assert.equal(contract.scope, "Schedule");
assert.equal(contract.publicationDueAtBuild, 60);
assert.deepEqual(contract.requiredBuilds, [51, 52, 53, 54]);
assert.equal(contract.requiredPublicationChecks.length, 6);
assert.equal(contract.evidencePolicy.exactCandidateRequired, true);
assert.equal(contract.evidencePolicy.authenticatedChromeRequired, true);
assert.equal(contract.evidencePolicy.historicalScreenshotsDoNotSatisfyPublication, true);

for (const build of contract.requiredBuilds) {
  const script = pkg.scripts[`test:bimlog-final-build${build}`];
  assert.ok(script, `Build ${build} must remain bound`);
  assert.match(script, new RegExp(`post-p17-build${build}-schedule`));
}

console.log("BIMLog final closure Build 55: PASS Schedule block contract");
