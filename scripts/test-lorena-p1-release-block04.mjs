import { spawnSync } from "node:child_process";

const runner = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const checks = [
  "artifacts/bimlog/src/lib/contract-item-rate-explanation.behavior.ts",
  "artifacts/bimlog/src/lib/delivery-guidance-status.behavior.ts",
  "artifacts/bimlog/src/lib/intake-phase-hours-preview.behavior.ts",
  "artifacts/bimlog/src/pages/job-operations-governance-guidance.behavior.ts",
  "artifacts/bimlog/src/components/job-operations/ux139-edt-guided-repair.behavior.ts",
];

for (const check of checks) {
  const result = spawnSync(process.execPath, [runner, check], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("LORENA_P1_RELEASE_BLOCK04=PASS invalid_apu_arithmetic_suppressed=true workflow_version_visible=true verified_phase_total_visible=true governance_action_actor_aware=true edt_exact_repair=true");
