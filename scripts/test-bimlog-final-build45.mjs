import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(
  "evidence/outcome-remediation-20261023/build45-change-order-block-contract.json",
  "utf8",
));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.equal(contract.build, 45);
assert.equal(contract.scope, "Change Orders");
assert.equal(contract.publicationDueAtBuild, 50);
assert.deepEqual(contract.requiredBuilds, [41, 42, 43, 44]);
assert.equal(contract.requiredPublicationChecks.length, 6);
assert.equal(contract.evidencePolicy.exactCandidateRequired, true);
assert.equal(contract.evidencePolicy.authenticatedChromeRequired, true);
assert.equal(contract.evidencePolicy.historicalScreenshotsDoNotSatisfyPublication, true);

for (const build of contract.requiredBuilds) {
  const script = pkg.scripts[`test:bimlog-final-build${build}`];
  assert.ok(script, `Build ${build} must remain bound in package.json`);
  assert.match(script, new RegExp(`post-p17-build${build}-change-order`));
}

for (const suite of contract.requiredSuites) {
  assert.equal(
    fs.existsSync(`artifacts/api-server/src/lib/${suite}`),
    true,
    `Required suite is missing: ${suite}`,
  );
}

console.log("BIMLog final closure Build 45: PASS Change Order block contract");
