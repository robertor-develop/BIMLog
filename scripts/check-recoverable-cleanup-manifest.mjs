import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/RECOVERABLE_CLEANUP_MANIFEST.json", "utf8"));
if (manifest.executionAuthorized !== false || manifest.broadRecursiveActionAllowed !== false) throw new Error("cleanup manifest must remain planning-only and prohibit broad recursive action");
if (manifest.worktreeCount !== manifest.worktrees.length || manifest.branchCount !== manifest.branches.length) throw new Error("cleanup manifest counts do not reconcile");
const paths = new Set();
for (const item of manifest.worktrees) {
  if (!item.sourcePath || /[*?]/.test(item.sourcePath)) throw new Error(`non-exact source path: ${item.sourcePath}`);
  if (!item.preservationDirectory.startsWith(`${manifest.archiveRoot}/`) || /[*?]/.test(item.preservationDirectory)) throw new Error(`invalid preservation directory: ${item.preservationDirectory}`);
  if (item.removalAllowed !== false || item.removalPreconditions.length < 7 || item.requiredEvidence.length !== 6) throw new Error(`unsafe worktree plan: ${item.sourcePath}`);
  if (paths.has(item.sourcePath.toLowerCase())) throw new Error(`duplicate source path: ${item.sourcePath}`);
  paths.add(item.sourcePath.toLowerCase());
}
for (const item of manifest.branches) {
  if (!item.branch || /[*?]/.test(item.branch) || item.deletionAllowed !== false || item.deletionPreconditions.length < 4) throw new Error(`unsafe branch plan: ${item.branch}`);
}
console.log(JSON.stringify({ status: "PASS", worktrees: manifest.worktreeCount, branches: manifest.branchCount, executionAuthorized: manifest.executionAuthorized }));
