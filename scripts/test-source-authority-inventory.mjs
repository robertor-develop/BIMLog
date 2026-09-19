import assert from "node:assert/strict";
import { classifyBranch, classifyWorktree, parseWorktreePorcelain } from "./source-authority-inventory.mjs";

const records = parseWorktreePorcelain(`worktree F:/repo
HEAD 1111111111111111111111111111111111111111
branch refs/heads/main

worktree C:/missing
HEAD 2222222222222222222222222222222222222222
detached
prunable gitdir file points to non-existent location
`);
assert.equal(records.length, 2);
assert.equal(records[0].path, "F:/repo");
assert.equal(records[1].prunable, true);
assert.equal(classifyWorktree(records[1], { currentPath: "F:/repo", currentBranch: "topic", relationship: "ANCESTOR", dirtyTracked: 0, dirtyUntracked: 0 }).disposition, "RETIRE");
assert.equal(classifyWorktree(records[0], { currentPath: "F:/repo", currentBranch: "topic", relationship: "DIVERGED", dirtyTracked: 0, dirtyUntracked: 0 }).disposition, "KEEP");
assert.equal(classifyBranch({ branch: "topic", relationship: "DIVERGED", checkedOut: true, currentBranch: "main" }).disposition, "INTEGRATE");
assert.equal(classifyBranch({ branch: "old", relationship: "ANCESTOR", checkedOut: false, currentBranch: "main" }).disposition, "RETIRE");
console.log("Source authority inventory behavior: PASS");
