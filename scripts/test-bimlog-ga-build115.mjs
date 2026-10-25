import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const build of [111, 112, 113, 114]) runNodeGate(`scripts/test-bimlog-ga-build${build}.mjs`, { timeout: 600_000 });
const seal = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build115-publication-candidate-seal.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.deepEqual(seal.range, [111, 115]);
assert.deepEqual(seal.priorBlockRange, [106, 110]);
for (const [build, commit] of Object.entries(seal.commits)) {
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}:`));
}
assert.deepEqual(seal.cadence, { totalUnpublishedBuilds: 10, pushDue: true, publicationDue: true, authenticatedChromeDueAfterPublication: true });
console.log("BIMLog GA Build 115: PASS exact ten-build publication candidate seal");
