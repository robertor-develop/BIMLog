import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const commands = [
  [process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/handover-readiness.behavior.ts"]],
  [process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/handover-package-manifest.behavior.ts"]],
  ["pnpm", ["run", "test:artifact-proof-fixture-guard"]],
];
for (const [command, args] of commands) {
  const run = spawnSync(command, args, { encoding: "utf8", shell: command === "pnpm", timeout: 180_000 });
  assert.equal(run.status, 0, `${command} ${args.join(" ")}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK05_BUILD024=PASS handover=evidence-backed manifest=deterministic fixture_guard=true");
