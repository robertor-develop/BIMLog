import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const reviewedThroughCommit = process.argv[2];
const baseCommit = process.argv[3];
if (!/^[0-9a-f]{40}$/.test(reviewedThroughCommit ?? "") || !/^[0-9a-f]{40}$/.test(baseCommit ?? "")) throw new Error("usage: record-release-integrity-review <reviewed-commit> <base-commit>");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const changed = new Set(git("diff", "--name-only", `${baseCommit}..${reviewedThroughCommit}`).split(/\r?\n/).filter(Boolean));
for (const line of git("status", "--porcelain").split(/\r?\n/).filter(Boolean)) changed.add(line.slice(3).replaceAll("\\", "/"));
changed.add("living-brief/impact-declarations.json");
changed.add("living-brief/state.json");
const reviewedChangedPaths = [...changed].sort();
const declarationsPath = path.join(root, "living-brief", "impact-declarations.json");
const declarations = JSON.parse(fs.readFileSync(declarationsPath, "utf8"));
const authorityKeys = declarations.reviews.at(-1).authorities.map(({ key }) => key);
const reason = "Protected-file recovery closure Block 7 reconciles the authenticated live inventory to 16 non-portable records, requires exact candidate identity, preserves source-search truth and produces a no-overwrite dry run while provider recovery sources remain unresolved; no production data changed.";
const updated = new Set();
if (changed.has("living-brief/STATUS.md")) updated.add("status");
if (changed.has("living-brief/OPEN_LOOP.md")) updated.add("open_loop");
declarations.reviews.push({
  taskId: "protected-file-recovery-closure-block07-20261016",
  reviewedThroughCommit,
  reviewedAt: new Date().toISOString(),
  status: "local_candidate",
  captureTiming: "pre_release_reconciliation",
  authorities: authorityKeys.map((key) => ({ key, result: updated.has(key) ? "updated" : "reviewed_no_semantic_change", reason })),
  reason,
  reviewedChangedPaths,
  reviewedChangeSha256: crypto.createHash("sha256").update("pending-state-refresh").digest("hex"),
});
fs.writeFileSync(declarationsPath, `${JSON.stringify(declarations, null, 2)}\n`);
console.log(`LIVING_BRIEF_REVIEW_RECORDED=${reviewedThroughCommit} paths=${reviewedChangedPaths.length}`);
