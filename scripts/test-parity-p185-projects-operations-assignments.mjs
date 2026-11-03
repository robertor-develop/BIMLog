import { spawnSync } from "node:child_process";
const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const test of [
  "artifacts/api-server/src/lib/project-operation-assignment-contract.behavior.ts",
  "artifacts/api-server/src/lib/job-operations.behavior.ts",
  "artifacts/api-server/src/lib/job-intake.behavior.ts",
]) {
  const result = spawnSync(process.execPath, [tsx, test], { stdio: "inherit", env: process.env, windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("P185 assignment route, governed service, financial preservation, audit, UI save/reopen, and connected Intake continuity gates passed.");
