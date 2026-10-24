import { spawnSync } from "node:child_process";
const tests=[
  "artifacts/bimlog/src/lib/intake-workflow-preview-selection.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-delivery-defaults.behavior.ts",
  "artifacts/api-server/src/lib/contract-item-workflow.behavior.ts",
  "artifacts/api-server/src/lib/delivery-workflow-template-contract.behavior.ts",
  "artifacts/bimlog/src/lib/lorena-intake-correction-integration.behavior.ts"
];
for(const test of tests){const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{encoding:"utf8"});process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");if(r.status!==0)process.exit(r.status??1);}
console.log("BIMLog GA Build 78: PASS workflow strategy/milestones, edit preservation, clear/reselect and reload");
