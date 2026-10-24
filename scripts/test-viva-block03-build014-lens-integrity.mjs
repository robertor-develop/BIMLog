import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const commands = [
  ["pnpm", ["--filter", "@workspace/api-server", "run", "test:lens-next-model-binding"]],
  ["pnpm", ["--filter", "@workspace/api-server", "run", "test:lens-next-digest-v3"]],
  ["pnpm", ["--filter", "@workspace/api-server", "run", "test:lens-next-publishing"]],
  ["pnpm", ["run", "check:lens-next-native-release"]],
];
for (const [command, args] of commands) {
  const run = spawnSync(command, args, { encoding: "utf8", shell: true, timeout: 120_000 });
  assert.equal(run.status, 0, `${command} ${args.join(" ")}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK03_BUILD014=PASS boundaries=model_binding,digest,publishing,native_release authority=preserved");
