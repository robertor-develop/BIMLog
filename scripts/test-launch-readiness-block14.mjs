import {spawnSync} from "node:child_process";

const tests=[
  "artifacts/api-server/src/lib/commercial-portal-command.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-checkout-return.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-checkout-result.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-portal-return-ui.behavior.ts",
];
for(const test of tests){const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
console.log("Launch Readiness Block 14 LR066-LR070: PASS");
