import { execFileSync } from "node:child_process";
import fs from "node:fs";

const read = (name) => JSON.parse(fs.readFileSync(`evidence/stabilization-program-20260919/${name}`, "utf8"));
const inventory = read("SOURCE_AUTHORITY_INVENTORY.json");
const histories = read("SOURCE_HISTORY_RECONCILIATION.json");
const dirty = read("DIRTY_CANDIDATE_RECONCILIATION.json");
const cleanup = read("RECOVERABLE_CLEANUP_MANIFEST.json");
const fail = (message) => { throw new Error(message); };

if (inventory.worktreeCounts.registered !== 143 || inventory.worktreeCounts.present !== 142 || inventory.worktreeCounts.prunable !== 1 || inventory.worktreeCounts.baselineDirty !== 18) fail("worktree authority counts drifted");
if (inventory.branchCounts.ancestryUnmerged !== 61) fail("ancestry-unmerged branch count drifted");
if ([...inventory.worktrees, ...inventory.branches].some((item) => !item.disposition)) fail("source-authority record lacks disposition");
if (histories.candidates.length !== 2 || histories.candidates.some((item) => item.wholesaleIntegrationAllowed !== false || item.files.some((file) => !file.disposition))) fail("candidate history is not fully mapped and fail-closed");
if (dirty.destructiveActionAuthorized !== false || dirty.candidates.length !== 5 || dirty.candidates.some((item) => !item.cleanCandidateLocation)) fail("dirty candidate reconciliation is incomplete");
if (cleanup.executionAuthorized !== false || cleanup.broadRecursiveActionAllowed !== false) fail("cleanup manifest incorrectly authorizes execution");
if (cleanup.worktreeCount !== inventory.worktrees.filter((item) => item.disposition === "RETIRE").length) fail("cleanup worktree count does not match inventory");
if (cleanup.branchCount !== inventory.branches.filter((item) => item.disposition === "RETIRE").length) fail("cleanup branch count does not match inventory");

const cwd = process.cwd();
const git = (...args) => execFileSync("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, "-C", cwd, ...args], { encoding: "utf8" }).trim();
const changed = git("diff", "--name-only", "b3ba648b1c964ae3867366acfcdd17ca37222b0a...HEAD").split(/\r?\n/).filter(Boolean);
const allowedBriefFiles = new Set([
  "living-brief/STATUS.md",
  "living-brief/OPEN_LOOP.md",
  "living-brief/OPEN_LOOP_DISPOSITIONS.json",
  "living-brief/impact-declarations.json",
  "living-brief/state.json"
]);
const unexpected = changed.filter((file) => !(file === "package.json" || file.startsWith("scripts/") || file.startsWith("evidence/stabilization-program-20260919/") || allowedBriefFiles.has(file)));
if (unexpected.length) fail(`Block 06 contains unaccepted product paths: ${unexpected.join(", ")}`);

console.log(JSON.stringify({
  status: "PASS",
  registeredWorktrees: inventory.worktreeCounts.registered,
  baselineDirtyWorktrees: inventory.worktreeCounts.baselineDirty,
  ancestryUnmergedBranches: inventory.branchCounts.ancestryUnmerged,
  mappedHistoryPaths: histories.candidates.reduce((total, item) => total + item.files.length, 0),
  dirtyCandidateFamilies: dirty.candidates.length,
  recoverableWorktreePlans: cleanup.worktreeCount,
  recoverableBranchPlans: cleanup.branchCount,
  acceptedProductPatchesIntegrated: 0,
  blockChangedPaths: changed.length
}));
