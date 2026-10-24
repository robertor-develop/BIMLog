import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { validateAuthenticatedReleaseAcceptance } from "./authenticated-release-acceptance.mjs";

const contract = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build90-publication-contract.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(contract.schemaVersion, "bimlog-ga-build90-publication-contract-v1");
assert.deepEqual(contract.range, [81, 90]);
for (const [build, commit] of Object.entries(contract.commits)) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"), `Build ${build} is absent from HEAD`);
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}`));
}
assert.equal(new Set(contract.requiredRoutes).size, 11);
assert.deepEqual(contract.controlledProject, { id: 68, code: "QA-LOR-FINAL-1023" });
assert.deepEqual(contract.cadence, { push: true, publish: true, authenticatedChrome: true, unpublishedBuildCount: 10 });
assert.equal(validateAuthenticatedReleaseAcceptance({}).ok, false);
assert.deepEqual(contract.acceptance, { implemented: true, tested: true, pushed: false, published: false, liveVerified: false, independentlyAccepted: false });
console.log("BIMLog GA Build 90: PASS exact ten-build publication and authenticated Chrome contract");
