import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:ga-final-block02-build010"],
  ["run", "test:ga-final-block03-build023"],
  ["run", "test:ga-final-block04-build028"],
  ["run", "test:bimlog-final-closure-block07"],
];

for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("BIMLog GA Build 83: PASS Files, transmittal delivery, immutable custody and governed reports");
