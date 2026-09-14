import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export function evaluateCheckoutReadiness({ branch, statusLines, headTree, authorityTree }) {
  const reasons = [];
  if (!branch) reasons.push("detached_head");
  if (statusLines.length > 0) reasons.push("working_tree_dirty");
  if (headTree !== authorityTree) reasons.push("source_tree_not_authoritative");
  return { ready: reasons.length === 0, branch: branch || null, reasons };
}

export function inspectCheckoutReadiness({ cwd, authorityRef = "origin/master" }) {
  const git = (...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
  const branch = git("branch", "--show-current");
  const status = git("status", "--porcelain");
  return evaluateCheckoutReadiness({
    branch,
    statusLines: status ? status.split(/\r?\n/) : [],
    headTree: git("rev-parse", "HEAD^{tree}"),
    authorityTree: git("rev-parse", `${authorityRef}^{tree}`),
  });
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const result = inspectCheckoutReadiness({ cwd: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.ready, true, `checkout is not release-ready: ${result.reasons.join(", ")}`);
}
