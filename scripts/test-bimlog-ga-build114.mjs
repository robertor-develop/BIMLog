import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const plan = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build114-ten-build-publication-plan.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(plan.publishedBaseline, "691ca74b774ab48735736878c0bb81e99a04ce89");
assert.equal(plan.firstBlockHead, "bfdd51f8a5e7da8cfe8a427f838b261adfe640be");
assert.equal(Object.keys(plan.secondBlockCommits).length, 3);
for (const [build, commit] of Object.entries(plan.secondBlockCommits)) {
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}:`));
}
assert.equal(new Set(plan.releaseActions).size, 7);
assert.equal(plan.nativeOrInstallerChanged, false);
assert.equal(plan.customerDataMutationAuthorized, false);
console.log("BIMLog GA Build 114: PASS exact ten-build publication plan and protected boundaries");
