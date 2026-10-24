import { spawnSync } from "node:child_process";
const tests=[
  "artifacts/api-server/src/lib/job-intake-idempotent-activation.behavior.ts",
  "artifacts/api-server/src/lib/workflow-phase-hours.behavior.ts",
  "artifacts/api-server/src/lib/lorena-allocation-correction-integration.behavior.ts",
  "artifacts/api-server/src/lib/job-intake-budget-account.behavior.ts",
  "artifacts/bimlog/src/lib/workflow-policy-guidance.behavior.ts"
];
for(const test of tests){const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{encoding:"utf8"});process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");if(r.status!==0)process.exit(r.status??1);}
console.log("BIMLog GA Build 79: PASS activation replay, PRE/COO/FOR/ASB hours, budget and governed authority");
