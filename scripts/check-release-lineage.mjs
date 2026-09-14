import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export function inspectReleaseLineage({ cwd, canonicalRef = "origin/main", productionRef = "origin/master" }) {
  const git = (...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
  const canonicalCommit = git("rev-parse", canonicalRef);
  const productionCommit = git("rev-parse", productionRef);
  const canonicalTree = git("rev-parse", `${canonicalRef}^{tree}`);
  const productionTree = git("rev-parse", `${productionRef}^{tree}`);
  const counts = git("rev-list", "--left-right", "--count", `${canonicalRef}...${productionRef}`)
    .split(/\s+/)
    .map(Number);
  return {
    canonicalRef,
    productionRef,
    canonicalCommit,
    productionCommit,
    canonicalTree,
    productionTree,
    canonicalOnlyCommits: counts[0],
    productionOnlyCommits: counts[1],
    treesMatch: canonicalTree === productionTree,
  };
}

export function requireReleaseLineageParity(result) {
  assert.equal(result.treesMatch, true, `${result.canonicalRef} and ${result.productionRef} do not contain the same source tree`);
  return result;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const result = inspectReleaseLineage({ cwd: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
  requireReleaseLineageParity(result);
}
