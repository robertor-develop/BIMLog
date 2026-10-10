import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/commercial-billing-identity.behavior.ts",
  "artifacts/api-server/src/lib/commercial-subscription-setup.behavior.ts",
  "artifacts/api-server/src/routes/commercial-billing-identity-route.behavior.ts",
]){
  const result=spawnSync(process.execPath,[tsx,file],{encoding:"utf8"});
  assert.equal(result.status,0,result.stdout+result.stderr);
  process.stdout.write(result.stdout);
}
const setup=fs.readFileSync("artifacts/api-server/src/lib/commercial-subscription-setup.ts","utf8");
const provider=fs.readFileSync("artifacts/api-server/src/lib/commercial-provider-adapter.ts","utf8");
const route=fs.readFileSync("artifacts/api-server/src/routes/commercial-workspace.ts","utf8");
for(const token of ["deriveCommercialBillingIdentity","Complete company billing identity before subscription setup","billingAddress","billingPhone"])assert.ok(setup.includes(token),token);
for(const token of ["address[line1]","phone","metadata[company_id]"])assert.ok(provider.includes(token),token);
for(const token of ["BILLING_IDENTITY_INCOMPLETE","identity?409","billingAddress:companiesTable.address","billingPhone:companiesTable.phone"])assert.ok(route.includes(token),token);
console.log("LR040 billing identity to subscription setup acceptance: PASS");
