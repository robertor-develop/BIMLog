import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(
  "evidence/outcome-remediation-20261023/build70-coordination-block-contract.json",
  "utf8",
));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.equal(contract.build, 70);
assert.equal(contract.scope, "Coordination Hub");
assert.equal(contract.publicationDueAtBuild, 70);
assert.deepEqual(contract.requiredBuilds, [66, 67, 68, 69]);
assert.equal(contract.requiredPublicationChecks.length, 6);
assert.equal(contract.evidencePolicy.exactCandidateRequired, true);
assert.equal(contract.evidencePolicy.authenticatedChromeRequired, true);
assert.equal(contract.evidencePolicy.historicalScreenshotsDoNotSatisfyPublication, true);

for (const build of contract.requiredBuilds) {
  const script = pkg.scripts[`test:bimlog-final-build${build}`];
  assert.ok(script, `Build ${build} must remain bound`);
  assert.match(script, new RegExp(`post-p18-build${build}-coordination`));
}

console.log("BIMLog final closure Build 70: PASS Coordination Hub block contract");
