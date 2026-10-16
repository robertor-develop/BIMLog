import { spawnSync } from "node:child_process";

const runner = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const checks = [
  "artifacts/bimlog/src/lib/workflow-policy-guidance.behavior.ts",
  "artifacts/bimlog/src/components/job-intake/CommercialIntake.behavior.tsx",
  "artifacts/bimlog/src/components/job-operations/ux139-edt-guided-repair.behavior.ts",
  "artifacts/bimlog/src/lib/contract-deep-link.behavior.ts",
];

for (const check of checks) {
  const result = spawnSync(process.execPath, [runner, check], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("LORENA_P1_RELEASE_BLOCK02=PASS governance_role_truth=true canonical_contract_visible=true exact_edt_contract=true operations_return=true");
