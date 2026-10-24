import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

for (const build of [101, 103, 104]) {
  const result = spawnSync("pnpm", ["run", `test:bimlog-ga-build${build}`], { encoding: "utf8", shell: true, timeout: 900_000 });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const seal = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build105-continuation-block-seal.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(seal.schemaVersion, "bimlog-ga-build105-continuation-block-seal-v1");
assert.deepEqual(seal.range, [101, 105]);
for (const [build, commit] of Object.entries(seal.commits)) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}:`));
}
for (const commit of Object.values(seal.lineageAnchors)) assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
assert.equal(new Set(seal.criteria).size, 5);
assert.deepEqual(seal.cadence, { pushAfterThisBuild: true, publishAfterBuild: 110, unpublishedBuildCountAfterPush: 5, authenticatedChromeDue: false });
assert.deepEqual(seal.acceptance, { implemented: true, tested: true, pushed: false, publishedThroughBuild100: true, liveVerifiedThroughBuild100: true, independentlyAccepted: false });
console.log("BIMLog GA Build 105: PASS exact Builds 101-105 lineage and five-build cadence seal");
