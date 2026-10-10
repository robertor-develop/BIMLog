import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const result=spawnSync(process.execPath,[tsx,"artifacts/api-server/src/lib/commercial-subscription-lifecycle.behavior.ts"],{stdio:"inherit"});assert.equal(result.status,0,"subscription lifecycle behavior failed");
const route=fs.readFileSync("artifacts/api-server/src/routes/commercial-workspace.ts","utf8"),client=fs.readFileSync("artifacts/bimlog/src/lib/commercial-workspace-client.ts","utf8"),page=fs.readFileSync("artifacts/bimlog/src/pages/CommercialWorkspace.tsx","utf8");
assert.ok(route.includes("readLatestSubscriptionLifecycle"));for(const source of [route,client])assert.ok(source.includes("subscriptionLifecycle"));
for(const token of ["Payment needs attention","Subscription suspended","Cancellation scheduled","Subscription canceled"]){assert.ok(page.includes(token),token);}
for(const forbidden of ["provider_session_reference","customer_reference"]){assert.ok(!client.includes(forbidden),forbidden);}
console.log("Launch Readiness Block 12 LR056–LR060 acceptance: PASS");
