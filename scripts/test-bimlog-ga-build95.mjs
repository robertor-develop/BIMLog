import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

for (const build of [91, 93, 94]) {
  const result = spawnSync("pnpm", ["run", `test:bimlog-ga-build${build}`], { encoding: "utf8", shell: true, timeout: 180_000 });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const seal = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build95-final-block-seal.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(seal.schemaVersion, "bimlog-ga-build95-final-block-seal-v1");
assert.deepEqual(seal.range, [91, 95]);
assert.deepEqual(seal.programRange, [71, 95]);
for (const [build, commit] of Object.entries({ ...seal.commits, ...seal.lineageAnchors })) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"), `Build ${build} lineage is absent from HEAD`);
}
const subjects = git("log", "--format=%s", "c02e75d069215e149ad423cc5ff6827112094d85^..HEAD");
for (let build = 71; build <= 94; build += 1) assert.match(subjects, new RegExp(`Build ${build}:`), `missing Build ${build}`);
assert.equal(new Set(seal.criteria).size, 5);
assert.deepEqual(seal.cadence, { pushAfterThisBuild: true, publishAfterBuild: 100, unpublishedBuildCountAfterPush: 5, authenticatedChromeDue: false });
assert.deepEqual(seal.acceptance, { implemented: true, tested: true, pushed: false, publishedThroughBuild90: true, liveVerifiedThroughBuild90: true, independentlyAccepted: false });
console.log("BIMLog GA Build 95: PASS exact Builds 71-95 lineage and final five-build block seal");
