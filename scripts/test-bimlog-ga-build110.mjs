import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const build of [106, 107, 108, 109]) runNodeGate(`scripts/test-bimlog-ga-build${build}.mjs`);
const evidence = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build110-repair-regression-block.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.deepEqual(evidence.range, [106, 110]);
assert.equal(evidence.publishedBaseline, "691ca74b774ab48735736878c0bb81e99a04ce89");
for (const [build, commit] of Object.entries(evidence.commits)) {
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}:`));
}
assert.equal(new Set(evidence.criteria).size, 5);
assert.deepEqual(evidence.cadence, { pushAfterThisBuild: true, publishAfterNextFiveBuilds: true, unpublishedBuildCountAfterPush: 5, authenticatedChromeDue: false });
console.log("BIMLog GA Build 110: PASS five-build repair regression block and publication cadence");
