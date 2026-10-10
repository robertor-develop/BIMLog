import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/commercial-checkout-readiness.behavior.ts",
  "artifacts/api-server/src/lib/commercial-checkout-command.behavior.ts",
  "artifacts/api-server/src/routes/commercial-workspace.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-hosted-destination.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-checkout-eligibility.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-workspace.behavior.ts",
]){
  const result=spawnSync(process.execPath,[tsx,file],{encoding:"utf8"});
  assert.equal(result.status,0,result.stdout+result.stderr);
  process.stdout.write(result.stdout);
}
const command=fs.readFileSync("artifacts/api-server/src/lib/commercial-checkout-command.ts","utf8");
const route=fs.readFileSync("artifacts/api-server/src/routes/commercial-workspace.ts","utf8");
const client=fs.readFileSync("artifacts/bimlog/src/lib/commercial-workspace-client.ts","utf8");
const page=fs.readFileSync("artifacts/bimlog/src/pages/CommercialWorkspace.tsx","utf8");
const checkoutBody=command.slice(command.indexOf("export async function startCommercialCheckout"));
assert.ok(checkoutBody.indexOf("requireCommercialCheckoutReadiness")<checkoutBody.indexOf("readPersistentCommercialAuthority"),"checkout readiness must precede authority reads and writes");
for(const token of ["CHECKOUT_PLATFORM_NOT_READY","CHECKOUT_AUTHORITY_CONFLICT","payment-service setup"])assert.ok(route.includes(token),token);
for(const token of ["CommercialHostedDestinationError","commercialHostedFailureCodes","slice(0,6)"])assert.ok(client.includes(token),token);
for(const token of ["platform_launch","required platform setup","hostedFailureMessage"])assert.ok(page.includes(token),token);
console.log("LR045 live-checkout fail-closed acceptance: PASS");
