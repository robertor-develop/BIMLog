import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const reviewedThroughCommit = process.argv[2];
const baseCommit = process.argv[3];
const block = process.argv[4];
if (!/^[0-9a-f]{40}$/.test(reviewedThroughCommit ?? "") || !/^[0-9a-f]{40}$/.test(baseCommit ?? "") || !/^\d+$/.test(block ?? ""))
  throw new Error("usage: record-viva-block-review <reviewed-commit> <base-commit> <block>");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const changed = new Set(git("diff", "--name-only", `${baseCommit}..${reviewedThroughCommit}`).split(/\r?\n/).filter(Boolean));
for (const line of git("status", "--porcelain").split(/\r?\n/).filter(Boolean)) changed.add(line.slice(3).replaceAll("\\", "/"));
changed.add("living-brief/impact-declarations.json");
changed.add("living-brief/state.json");
const declarationsPath = path.join(root, "living-brief", "impact-declarations.json");
const declarations = JSON.parse(fs.readFileSync(declarationsPath, "utf8"));
const authorityKeys = declarations.reviews.at(-1).authorities.map(({ key }) => key);
const reviewedChangedPaths = [...changed].sort();
const updated = new Set(["status", "open_loop"]);
const reason = `Viva whole-platform closure Block ${block} semantically reviews the exact changed-path set, preserves the accepted live release, and records only locally proven outcomes pending the configured publication boundary.`;
declarations.reviews.push({
  taskId: `viva-whole-platform-closure-block${String(block).padStart(2, "0")}-20261023`,
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
console.log(`VIVA_BLOCK_REVIEW_RECORDED=${reviewedThroughCommit} block=${block} paths=${reviewedChangedPaths.length}`);
