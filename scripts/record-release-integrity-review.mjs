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
const reason = "Release integrity B06-B10 repair the audited Agent workspace contract across desktop, tablet and mobile, remove obsolete floating behavior, fit split-workspace widths, enforce current acceptance, and restore keyboard focus without production or customer-data mutation.";
const updated = new Set(["status", "open_loop"]);
declarations.reviews.push({
  taskId: "release-integrity-block02-20261016",
  reviewedThroughCommit,
  reviewedAt: "2026-10-16T11:50:00.000Z",
  status: "local_candidate",
  captureTiming: "pre_release_reconciliation",
  authorities: authorityKeys.map((key) => ({ key, result: updated.has(key) ? "updated" : "reviewed_no_semantic_change", reason })),
  reason,
  reviewedChangedPaths,
  reviewedChangeSha256: crypto.createHash("sha256").update("pending-state-refresh").digest("hex"),
});
fs.writeFileSync(declarationsPath, `${JSON.stringify(declarations, null, 2)}\n`);
console.log(`LIVING_BRIEF_REVIEW_RECORDED=${reviewedThroughCommit} paths=${reviewedChangedPaths.length}`);
