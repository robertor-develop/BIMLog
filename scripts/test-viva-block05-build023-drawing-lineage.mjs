import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const commands = [
  ["pnpm", ["run", "test:corrective-b12"]],
  [process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/drawing-current-resolution.behavior.ts"]],
  [process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/drawing-record-links.behavior.ts"]],
];
for (const [command, args] of commands) {
  const run = spawnSync(command, args, { encoding: "utf8", shell: command === "pnpm", timeout: 180_000 });
  assert.equal(run.status, 0, `${command} ${args.join(" ")}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK05_BUILD023=PASS lineage=project-scoped drawings=current-and-as-of links=revision-bound");
