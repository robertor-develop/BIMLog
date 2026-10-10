import {spawnSync} from "node:child_process";

const tests=[
  "artifacts/api-server/src/lib/commercial-portal-eligibility.behavior.ts",
  "artifacts/api-server/src/lib/commercial-portal-command.behavior.ts",
  "artifacts/api-server/src/routes/commercial-portal-recovery-route.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-workspace-client.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-portal-recovery-ui.behavior.ts",
];
for(const test of tests){const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
console.log("Launch Readiness Block 13 LR061-LR065: PASS");
