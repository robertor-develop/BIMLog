import { spawnSync } from "node:child_process";

const tests = [
  "artifacts/api-server/src/lib/terminal-ga-build006-operations-authority.behavior.ts",
  "artifacts/api-server/src/lib/job-intake-idempotent-activation.behavior.ts",
  "artifacts/api-server/src/lib/workflow-phase-hours.behavior.ts",
  "artifacts/api-server/src/lib/lorena-allocation-correction-integration.behavior.ts",
  "artifacts/api-server/src/lib/job-work-packages.behavior.ts",
  "artifacts/api-server/src/lib/job-operations.behavior.ts",
];

for (const test of tests) {
  const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", test], { encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Terminal GA Build 6: PASS activation, workflow allocation, work packages, Operations, and cross-company administrator projection");
