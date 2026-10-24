import { spawnSync } from "node:child_process";
const tests=[
  "artifacts/api-server/src/lib/job-intake-work-package-reload.behavior.ts",
  "artifacts/api-server/src/lib/job-work-packages.behavior.ts",
  "artifacts/bimlog/src/lib/intake-activation-task-count.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-activation-preview.behavior.ts",
  "artifacts/api-server/src/lib/edt-engine-hierarchy.behavior.ts",
  "artifacts/api-server/src/lib/company-master-catalog-usage.behavior.ts"
];
for(const test of tests){const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{encoding:"utf8"});process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");if(r.status!==0)process.exit(r.status??1);}
console.log("BIMLog GA Build 80: PASS canonical contract, EDT/WBS, work packages, tasks and reload continuity");
