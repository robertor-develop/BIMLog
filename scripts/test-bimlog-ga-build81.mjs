import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:ga-final-block03-build021"],
  ["run", "test:post120-block31"],
  ["run", "test:post120-block32"],
];

for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("BIMLog GA Build 81: PASS governed RFI lifecycle, isolation and negative matrix");
