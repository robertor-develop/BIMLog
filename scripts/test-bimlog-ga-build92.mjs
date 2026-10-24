import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:bimlog-ga-block76-80"],
  ["run", "test:bimlog-ga-block81-85"],
  ["run", "test:bimlog-ga-block86-90"],
  ["run", "test:bimlog-ga-build91"],
];
for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true, timeout: 900_000 });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("BIMLog GA Build 92: PASS complete Builds 76-91 regression aggregation");
