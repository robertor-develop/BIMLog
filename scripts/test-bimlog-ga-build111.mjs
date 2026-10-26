import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

const pushedBuild110 = "bfdd51f8a5e7da8cfe8a427f838b261adfe640be";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
for (const remoteRef of [
  "origin/main",
  "origin/master",
  "origin/codex/bimlog-template-gap-block01-20260923",
]) {
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", pushedBuild110, remoteRef));
}
runNodeGate("scripts/test-bimlog-ga-build110.mjs");
console.log("BIMLog GA Build 111: PASS pushed Build 110 lineage and complete prior-block regression");
