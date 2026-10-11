import{spawnSync}from"node:child_process";
const tests=["artifacts/api-server/src/lib/commercial-billing-history.behavior.ts","artifacts/api-server/src/routes/commercial-billing-history-route.behavior.ts","artifacts/bimlog/src/lib/commercial-billing-history-client.behavior.ts","artifacts/bimlog/src/lib/commercial-invoice-guidance.behavior.ts","artifacts/bimlog/src/components/commercial/billing-history-panel.behavior.ts"];
for(const test of tests){const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
console.log("Launch Readiness Block 15 LR071-LR075: PASS");
