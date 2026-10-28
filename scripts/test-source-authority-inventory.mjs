import assert from "node:assert/strict";
import fs from "node:fs";
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

const inventory = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/SOURCE_AUTHORITY_INVENTORY.json", "utf8"));
const allowed = new Set(["KEEP", "INTEGRATE", "SUPERSEDE", "EVIDENCE_ONLY", "RETIRE"]);
assert.equal(inventory.worktreeCounts.registered, inventory.worktrees.length);
assert.equal(inventory.worktreeCounts.present, inventory.worktrees.filter((item) => !item.prunable).length);
assert.equal(inventory.worktreeCounts.prunable, inventory.worktrees.filter((item) => item.prunable).length);
assert.equal(inventory.worktreeCounts.baselineDirty, inventory.worktrees.filter((item) => item.baselineDirty).length);
assert.equal(inventory.branchCounts.registered, inventory.branches.length);
assert.equal(inventory.branchCounts.ancestryUnmerged, inventory.branches.filter((item) => item.relationship === "DIVERGED" || item.relationship === "DESCENDANT").length);
assert.ok([...inventory.worktrees, ...inventory.branches].every((item) => allowed.has(item.disposition)));
assert.equal(new Set(inventory.worktrees.map((item) => item.path.toLowerCase())).size, inventory.worktrees.length);
assert.equal(new Set(inventory.branches.map((item) => item.branch.toLowerCase())).size, inventory.branches.length);

console.log(`Source authority inventory behavior: PASS worktrees=${inventory.worktrees.length} branches=${inventory.branches.length}`);
