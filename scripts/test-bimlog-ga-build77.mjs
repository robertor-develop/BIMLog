import { spawnSync } from "node:child_process";
const tests=[
  "artifacts/bimlog/src/lib/job-intake-apu-autobind.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-apu-rates.behavior.ts",
  "artifacts/api-server/src/lib/job-intake-mapped-item-pricing.behavior.ts",
  "artifacts/api-server/src/lib/company-pricing-template-intake.behavior.ts",
  "artifacts/api-server/src/lib/job-intake-apu-reload.behavior.ts"
];
for(const test of tests){const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{encoding:"utf8"});process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");if(r.status!==0)process.exit(r.status??1);}
console.log("BIMLog GA Build 77: PASS immutable APU auto-rate and contractual/plan/labor separation");
