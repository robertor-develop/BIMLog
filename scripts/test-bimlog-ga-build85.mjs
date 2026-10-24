import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const commands = [
  ["run", "test:ga-final-block05-build032"],
  ["--filter", "@workspace/bimlog", "run", "typecheck"],
];
for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const seal = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build85-block-seal.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(seal.schemaVersion, "bimlog-ga-build85-block-seal-v1");
assert.deepEqual(seal.range, [81, 85]);
for (const [build, commit] of Object.entries(seal.commits)) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"), `Build ${build} is absent from HEAD`);
  assert.match(git("show", "-s", "--format=%s", commit), new RegExp(`Build ${build}`));
}
assert.equal(seal.cadence.pushAfterThisBuild, true);
assert.equal(seal.cadence.publishAfterBuild, 90);
assert.equal(seal.cadence.unpublishedBuildCountAfterSeal, 5);
assert.deepEqual(seal.criteria, ["rfi_lifecycle", "submittal_lifecycle", "file_transmittal_report_custody", "agent_behavior", "responsive_accessibility"]);
assert.deepEqual(seal.acceptance, { implemented: true, tested: true, pushed: false, published: false, liveVerified: false, independentlyAccepted: false });
console.log("BIMLog GA Build 85: PASS responsive/accessibility contract and Builds 81-85 exact block seal");
