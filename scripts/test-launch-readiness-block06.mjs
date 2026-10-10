import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/bimlog/src/lib/commercial-offer-handoff.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-intent.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-checkout-eligibility.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-workspace.behavior.ts",
]){
  const result=spawnSync(process.execPath,[tsx,file],{encoding:"utf8"});
  assert.equal(result.status,0,result.stdout+result.stderr);
  process.stdout.write(result.stdout);
}
const workspace=fs.readFileSync("artifacts/bimlog/src/pages/CommercialWorkspace.tsx","utf8");
for(const token of ["deriveCommercialOfferHandoff","Your selected offer","Su oferta seleccionada","clearCommercialIntent","Before checkout:","checkoutEligibility?.blockers.map"])assert.ok(workspace.includes(token),token);
assert.equal(workspace.match(/requestCommercialSubscriptionSetup/g)?.length,2,"preparation remains explicit");
assert.equal(workspace.match(/requestCommercialHostedDestination/g)?.length,3,"checkout and portal remain explicit");
console.log("LR030 billing handoff acceptance: PASS");
