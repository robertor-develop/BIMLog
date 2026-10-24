import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(
  "evidence/outcome-remediation-20261023/build65-files-block-contract.json",
  "utf8",
));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.equal(contract.build, 65);
assert.equal(contract.scope, "Files");
assert.equal(contract.publicationDueAtBuild, 70);
assert.deepEqual(contract.requiredBuilds, [61, 62, 63, 64]);
assert.equal(contract.requiredPublicationChecks.length, 6);
assert.equal(contract.evidencePolicy.exactCandidateRequired, true);
assert.equal(contract.evidencePolicy.authenticatedChromeRequired, true);
assert.equal(contract.evidencePolicy.historicalScreenshotsDoNotSatisfyPublication, true);

for (const build of contract.requiredBuilds) {
  const script = pkg.scripts[`test:bimlog-final-build${build}`];
  assert.ok(script, `Build ${build} must remain bound`);
  assert.match(script, new RegExp(`post-p17-build${build}-files`));
}

console.log("BIMLog final closure Build 65: PASS Files block contract");
