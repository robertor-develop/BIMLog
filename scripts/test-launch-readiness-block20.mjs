import{spawnSync}from"node:child_process";import{readFileSync}from"node:fs";
const tests=["artifacts/bimlog/src/lib/support-data-request-client.behavior.ts","artifacts/bimlog/src/lib/support-data-request-fulfillment-client.behavior.ts","artifacts/bimlog/src/components/commercial/support-data-request-receipt.behavior.ts","artifacts/bimlog/src/components/commercial/support-data-request-status.behavior.ts"];
for(const test of tests){const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
const css=readFileSync("artifacts/bimlog/src/components/commercial/SupportCasesPanel.css","utf8"),panel=readFileSync("artifacts/bimlog/src/components/commercial/SupportCasesPanel.tsx","utf8");
for(const token of[".support-data-status",".support-data-receipt","overflow-wrap:anywhere","@media(max-width:520px)","grid-template-columns:1fr"])if(!css.includes(token))throw new Error(`LR100 missing responsive contract: ${token}`);
if(/https?:\/\//.test(panel))throw new Error("LR100 customer support panel must use the same-origin API only");
console.log("Launch Readiness Block 20 LR096-LR100 customer data-right completion: PASS");
