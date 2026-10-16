import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HEX40 = /^[0-9a-f]{40}$/;

export function validateSourceIdentity(identity) {
  const errors = [];
  if (!HEX40.test(identity.commit ?? "")) errors.push("commit must be a full SHA-1");
  if (!HEX40.test(identity.tree ?? "")) errors.push("tree must be a full SHA-1");
  if (!identity.branch?.startsWith("codex/")) errors.push("branch must be an explicit codex branch");
  if (identity.upstream !== `origin/${identity.branch}`) errors.push("upstream must match the checked-out branch");
  if (identity.ahead !== 0 || identity.behind !== 0) errors.push("local and upstream must be identical");
  if (identity.dirtyPaths?.length) errors.push("worktree must be clean");
  return { ok: errors.length === 0, errors };
}

export function readSourceIdentity(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  const branch = git("branch", "--show-current");
  const upstream = git("rev-parse", "--abbrev-ref", "@{upstream}");
  const [behind, ahead] = git("rev-list", "--left-right", "--count", "@{upstream}...HEAD").split(/\s+/).map(Number);
  const dirtyPaths = git("status", "--porcelain").split(/\r?\n/).filter(Boolean);
  return { schemaVersion: "bimlog-source-identity-v1", branch, upstream, commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), ahead, behind, dirtyPaths };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const identity = readSourceIdentity();
  const result = validateSourceIdentity(identity);
  console.log(JSON.stringify({ ...identity, validation: result }, null, 2));
  if (!result.ok) process.exitCode = 1;
}
