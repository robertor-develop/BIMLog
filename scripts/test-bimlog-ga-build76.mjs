import { spawnSync } from "node:child_process";
const tests=[
  "artifacts/api-server/src/lib/job-intake-spreadsheet.behavior.ts",
  "artifacts/api-server/src/lib/post-p17-intake-file-inspection.behavior.ts",
  "artifacts/api-server/src/lib/ux-intake-quantity.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-lifecycle.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-draft-resume.behavior.ts"
];
for(const test of tests){const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{encoding:"utf8"});process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");if(r.status!==0)process.exit(r.status??1);}
console.log("BIMLog GA Build 76: PASS Excel intake rows, quantities, validation, duplicates, save and reopen");
