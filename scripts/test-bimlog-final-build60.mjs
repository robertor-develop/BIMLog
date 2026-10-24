import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(
  "evidence/outcome-remediation-20261023/build60-clash-reports-block-contract.json",
  "utf8",
));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.equal(contract.build, 60);
assert.equal(contract.scope, "Clash Reports");
assert.equal(contract.publicationDueAtBuild, 60);
assert.deepEqual(contract.requiredBuilds, [56, 57, 58, 59]);
assert.equal(contract.requiredPublicationChecks.length, 6);
assert.equal(contract.evidencePolicy.exactCandidateRequired, true);
assert.equal(contract.evidencePolicy.authenticatedChromeRequired, true);
assert.equal(contract.evidencePolicy.historicalScreenshotsDoNotSatisfyPublication, true);

for (const build of contract.requiredBuilds) {
  const script = pkg.scripts[`test:bimlog-final-build${build}`];
  assert.ok(script, `Build ${build} must remain bound`);
  assert.match(script, new RegExp(`post-p17-build${build}-clash-reports`));
}

console.log("BIMLog final closure Build 60: PASS Clash Reports block contract");
