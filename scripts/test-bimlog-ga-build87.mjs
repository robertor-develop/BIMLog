import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:ga-final-block05-build033"],
];
for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const recovery = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/bimlog/src/lib/deployment-module-recovery.behavior.ts"], { encoding: "utf8" });
process.stdout.write(recovery.stdout || "");
process.stderr.write(recovery.stderr || "");
if (recovery.status !== 0) process.exit(recovery.status ?? 1);
console.log("BIMLog GA Build 87: PASS failure recovery, stale deployment recovery and retry boundaries");
