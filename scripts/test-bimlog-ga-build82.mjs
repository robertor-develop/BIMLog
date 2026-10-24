import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:ga-final-block03-build022"],
  ["run", "test:post120-block36"],
];

for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("BIMLog GA Build 82: PASS governed Submittal lifecycle, RFI linkage and project isolation");
