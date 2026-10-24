import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const receipt = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build96-pushed-candidate.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(receipt.schemaVersion, "bimlog-ga-build96-pushed-candidate-v1");
assert.equal(receipt.branch, "codex/bimlog-template-gap-block01-20260923");
assert.match(receipt.pushedCommit, /^[0-9a-f]{40}$/);
assert.equal(git("rev-parse", `origin/${receipt.branch}`), receipt.pushedCommit);
assert.doesNotThrow(() => git("merge-base", "--is-ancestor", receipt.pushedCommit, "HEAD"));
assert.match(git("show", "-s", "--format=%s", receipt.pushedCommit), /Build 95 state seal/);
assert.deepEqual(receipt.buildRange, [91, 95]);
assert.equal(receipt.workingTreeClean, true);
assert.equal(receipt.publicationState, "HELD_FOR_BUILD_100");
assert.equal(receipt.unpublishedBuildCount, 5);
console.log("BIMLog GA Build 96: PASS exact pushed Build 95 candidate and cadence hold");
