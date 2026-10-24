import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const seal = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build75-block-seal.json", "utf8"));
const receipt = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build72-local-release-receipt.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

assert.equal(seal.schemaVersion, "bimlog-ga-build75-block-seal-v1");
assert.deepEqual(seal.range, [71, 75]);
for (const [build, commit] of Object.entries(seal.commits)) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"), `Build ${build} is absent from HEAD`);
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}`));
}
assert.equal(receipt.status, "PASS");
assert.equal(receipt.source.commit, seal.commits["72"]);
assert.equal(receipt.commandCount, seal.releaseGate.commandCount);
assert.equal(receipt.receiptSha256, seal.releaseGate.receiptSha256);
assert.equal(seal.cadence.pushAfterThisBuild, true);
assert.equal(seal.cadence.publishAfterBuild, 80);
assert.equal(seal.cadence.authenticatedChromeAfterPublication, true);
assert.equal(seal.cadence.unpublishedBuildCountAfterSeal, 5);
assert.deepEqual(seal.acceptance, {
  implemented: true,
  tested: true,
  pushed: false,
  published: false,
  liveVerified: false,
  independentlyAccepted: false
});

console.log("BIMLog GA Build 75: PASS Builds 71-75 exact block seal and publication cadence");
