import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/commercial-billing-identity.behavior.ts",
  "artifacts/api-server/src/routes/commercial-billing-identity-route.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-billing-identity-client.behavior.ts",
  "artifacts/bimlog/src/components/commercial/billing-identity-panel.behavior.ts",
]){
  const result=spawnSync(process.execPath,[tsx,file],{encoding:"utf8"});
  assert.equal(result.status,0,result.stdout+result.stderr);
  process.stdout.write(result.stdout);
}

const route=fs.readFileSync("artifacts/api-server/src/routes/commercial-workspace.ts","utf8");
const panel=fs.readFileSync("artifacts/bimlog/src/pages/CompanyProfile.tsx","utf8");
const workspace=fs.readFileSync("artifacts/bimlog/src/pages/CommercialWorkspace.tsx","utf8");
for(const token of ["BEGIN","billing_identity_updated","admin_actions_log","ROLLBACK","COMMIT"])assert.ok(route.includes(token),token);
assert.ok(!route.includes("JSON.stringify({address:"),"audit evidence must not contain the billing address");
assert.ok(!route.includes("JSON.stringify({phone:"),"audit evidence must not contain the billing phone");
for(const token of ["Billing identity","Identidad de facturación","Return to Billing & Support","Volver a Facturación y Soporte"])assert.ok(panel.includes(token),token);
assert.ok(workspace.includes('`${action.href}?from=billing`'),"billing blocker must preserve the canonical server-owned identity editor route");
console.log("LR035 canonical billing identity acceptance: PASS");
