import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";

const commands = [
  ["run", "test:release-integrity-block02"],
  ["--filter", "@workspace/api-server", "run", "test:production-artifact"],
];
for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
assert.match(head, /^[0-9a-f]{40}$/);
assert.equal(git("diff", "--name-only", "--diff-filter=U"), "", "Build 89 rejects unresolved merge conflicts");
assert.equal(git("merge-base", "--is-ancestor", "d95747b91e887c08f417944d44b05e041620f9a2", "HEAD"), "");
console.log(`BIMLog GA Build 89: PASS release integrity and production artifact at ${head}`);
