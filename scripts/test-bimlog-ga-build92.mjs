import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:bimlog-ga-block76-80"],
  ["run", "test:bimlog-ga-block81-85"],
  ["run", "test:bimlog-ga-block86-90"],
  ["run", "test:bimlog-ga-build91"],
];
for (const args of commands) {
  const gate = args.at(-1);
  const startedAt = Date.now();
  console.log(`BIMLog GA Build 92: running ${gate}...`);
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: true, timeout: 900_000 });
  console.log(`BIMLog GA Build 92: ${gate} completed in ${Math.ceil((Date.now() - startedAt) / 1000)}s`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("BIMLog GA Build 92: PASS complete Builds 76-91 regression aggregation");
