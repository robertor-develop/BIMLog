import { execFileSync } from "node:child_process";
const baselineDirtyBranches = new Set([
  "main",
  "codex/commercial-financial-recovery-successor-20260731",
  "codex/electron-runtime-hardening-20260803",
  "codex/generic-apu-ui-20260805",
  "codex/generic-apu-ui-row8-states-20260805",
  "codex/living-brief-runtime-closure-20260805",
  "codex/bimlog-build38-navisworks2025-field-rc-20260907",
  "codex/bimlog-build39-xml-missing-scale-20260908",
  "codex/bimlog-build41-xml-legacy-repair-20260908",
  "codex/bimlog-build7-advanced-contracts-backend-20260816",
  "codex/bimlog-feedback-addendum-20260817",
  "codex/bimlog-lens-mockup-block01-20260917",
  "codex/lens-next-build25e-manual-range-proof-20260905",
  "codex/lens-next-build32-create-open-repair-20260907",
  "codex/lens-next-forensic-recovery-20260831",
  "lens-next-m3-authoritative-integration",
  "codex/bimlog-product-defaults-block01-20260915",
]);

const normalize = (value) => value.replace(/\\/g, "/");

export function parseWorktreePorcelain(text) {
  return text.trim().split(/\r?\n\r?\n/).filter(Boolean).map((block) => {
    const record = { path: "", head: "", branch: null, detached: false, prunable: false, prunableReason: null };
    for (const line of block.split(/\r?\n/)) {
      const separator = line.indexOf(" ");
      const key = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? "" : line.slice(separator + 1);
      if (key === "worktree") record.path = normalize(value);
      if (key === "HEAD") record.head = value;
      if (key === "branch") record.branch = value.replace("refs/heads/", "");
      if (key === "detached") record.detached = true;
      if (key === "prunable") {
        record.prunable = true;
        record.prunableReason = value || null;
      }
    }
    return record;
  });
}

export function classifyWorktree(record, { currentPath, currentBranch, relationship, dirtyTracked, dirtyUntracked }) {
  const name = `${record.branch ?? "DETACHED"} ${record.path}`.toLowerCase();
  if (record.prunable) return { disposition: "RETIRE", reason: "missing registry entry; preserve metadata until recoverable cleanup" };
  if (normalize(record.path).toLowerCase() === normalize(currentPath).toLowerCase() || record.branch === currentBranch) {
    return { disposition: "KEEP", reason: "active stabilization lineage" };
  }
  if (name.includes("rollback") || name.includes("field") || name.includes("manual-range-proof") || (record.detached && (dirtyTracked + dirtyUntracked) > 0)) {
    return { disposition: "EVIDENCE_ONLY", reason: "retained package, field, rollback, or detached evidence" };
  }
  if ((dirtyTracked + dirtyUntracked) > 0) {
    return { disposition: "INTEGRATE", reason: "preserve dirty delta for effective-behavior reconciliation" };
  }
  if (relationship === "DIVERGED" || relationship === "DESCENDANT") {
    return { disposition: "INTEGRATE", reason: "ancestry does not prove supersession; effective diff required" };
  }
  if (record.branch === "master" || record.branch === "main") {
    return { disposition: "KEEP", reason: "canonical checkout retained as history; not inferred as release authority" };
  }
  return { disposition: "RETIRE", reason: "clean historical ancestor eligible only for recoverable cleanup" };
}

export function classifyBranch({ branch, relationship, checkedOut, currentBranch }) {
  if (branch === currentBranch || branch === "master" || branch === "main") {
    return { disposition: "KEEP", reason: "current or canonical named branch retained" };
  }
  if (relationship === "DIVERGED" || relationship === "DESCENDANT") {
    return { disposition: "INTEGRATE", reason: checkedOut ? "checked-out unique history requires effective diff" : "unique history requires effective diff" };
  }
  return { disposition: "RETIRE", reason: "clean merged/ancestor branch eligible only for recoverable cleanup" };
}

export function inspectSourceAuthority({ cwd = process.cwd() } = {}) {
  const git = (...args) => execFileSync("git", ["-c", `safe.directory=${normalize(cwd)}`, "-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  const currentPath = normalize(git("rev-parse", "--show-toplevel"));
  const currentBranch = git("branch", "--show-current");
  const sourceHead = git("rev-parse", "HEAD");
  const sourceTree = git("rev-parse", "HEAD^{tree}");
  const records = parseWorktreePorcelain(git("worktree", "list", "--porcelain"));
  const presentByBranch = new Map(records.filter((item) => item.branch).map((item) => [item.branch, item]));
  const ancestorHeads = new Set(git("rev-list", "HEAD").split(/\r?\n/).filter(Boolean));
  const unmergedBranches = new Set(git("for-each-ref", "--no-merged=HEAD", "--format=%(refname:short)", "refs/heads").split(/\r?\n/).filter(Boolean));
  const relationship = (head, branch = null) => {
    if (head === sourceHead) return "EXACT";
    if (ancestorHeads.has(head)) return "ANCESTOR";
    if (branch && unmergedBranches.has(branch)) return "DIVERGED";
    return "DIVERGED";
  };
  const worktrees = records.map((record) => {
    const baselineDirty = baselineDirtyBranches.has(record.branch)
      || normalize(record.path).toLowerCase().includes("bimlog-n09-p04-release-20260902");
    const dirtyTracked = baselineDirty ? 1 : 0;
    const dirtyUntracked = 0;
    const relation = relationship(record.head, record.branch);
    return {
      ...record,
      relationship: relation,
      baselineDirty,
      dirtyEvidence: baselineDirty ? "Build 002 preserved dirty-worktree map; no worktree content was traversed" : "Build 002 clean classification",
      dirtyTracked,
      dirtyUntracked,
      ...classifyWorktree(record, { currentPath, currentBranch, relationship: relation, dirtyTracked, dirtyUntracked }),
    };
  });
  const branchEntries = git("for-each-ref", "--format=%(refname:short)%00%(objectname)", "refs/heads")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [branch, head] = line.split("\0");
      return { branch, head };
    })
    .sort((left, right) => left.branch.localeCompare(right.branch));
  const branches = branchEntries.map(({ branch, head }) => {
    const relation = relationship(head, branch);
    return {
      branch,
      head,
      relationship: relation,
      checkedOut: presentByBranch.has(branch),
      ...classifyBranch({ branch, relationship: relation, checkedOut: presentByBranch.has(branch), currentBranch }),
    };
  });
  const dispositionCounts = (items) => Object.fromEntries(
    ["KEEP", "INTEGRATE", "SUPERSEDE", "EVIDENCE_ONLY", "RETIRE"].map((key) => [key, items.filter((item) => item.disposition === key).length]),
  );
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    sourceHead,
    sourceTree,
    currentPath,
    currentBranch,
    worktreeCounts: {
      registered: worktrees.length,
      present: worktrees.filter((item) => !item.prunable).length,
      prunable: worktrees.filter((item) => item.prunable).length,
      baselineDirty: worktrees.filter((item) => item.baselineDirty).length,
      dispositions: dispositionCounts(worktrees),
    },
    branchCounts: {
      registered: branches.length,
      ancestryUnmerged: branches.filter((item) => item.relationship === "DIVERGED" || item.relationship === "DESCENDANT").length,
      dispositions: dispositionCounts(branches),
    },
    worktrees,
    branches,
  };
}
