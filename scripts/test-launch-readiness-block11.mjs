import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of ["artifacts/api-server/src/lib/commercial-checkout-summary.behavior.ts","artifacts/api-server/src/routes/commercial-checkout-summary-route.behavior.ts","artifacts/bimlog/src/lib/commercial-checkout-summary.behavior.ts","artifacts/bimlog/src/lib/commercial-checkout-result.behavior.ts"]){const result=spawnSync(process.execPath,[tsx,file],{stdio:"inherit"});assert.equal(result.status,0,`${file} failed`);}
const page=fs.readFileSync("artifacts/bimlog/src/pages/CommercialWorkspace.tsx","utf8");
for(const token of ["deriveCommercialCheckoutReturnState","checkoutPolls>=5","Payment verified — subscription active","Payment was not completed","Paid access remains unchanged until verification completes"]){assert.ok(page.includes(token),token);}
assert.ok(!page.includes("provider_session_reference"));
console.log("Launch Readiness Block 11 LR051–LR055 acceptance: PASS");
