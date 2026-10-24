import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

for (const build of [96, 98, 99]) {
  const result = spawnSync("pnpm", ["run", `test:bimlog-ga-build${build}`], { encoding: "utf8", shell: true, timeout: 180_000 });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const seal = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build100-publication-block-seal.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(seal.schemaVersion, "bimlog-ga-build100-publication-block-seal-v1");
assert.deepEqual(seal.range, [96, 100]);
assert.deepEqual(seal.publicationRange, [91, 100]);
for (const [build, commit] of Object.entries(seal.commits)) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}:`));
}
assert.equal(new Set(seal.criteria).size, 5);
assert.deepEqual(seal.cadence, { pushAfterThisBuild: true, publishAfterThisBuild: true, unpublishedBuildCount: 10, authenticatedChromeDue: true });
assert.deepEqual(seal.acceptanceBeforeExternalActions, { implemented: true, tested: true, pushed: false, published: false, liveVerified: false, independentlyAccepted: false });
console.log("BIMLog GA Build 100: PASS exact Builds 96-100 seal and ten-build publication boundary");
