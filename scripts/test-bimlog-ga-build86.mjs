import { spawnSync } from "node:child_process";

const commands = [
  ["run", "test:ga-final-block05-build031"],
  ["run", "test:tracked-secret-exposure"],
  ["run", "test:database-safety"],
];
for (const args of commands) {
  const result = spawnSync("pnpm", args, { encoding: "utf8", shell: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("BIMLog GA Build 86: PASS authorization isolation, secret exposure and database safety");
