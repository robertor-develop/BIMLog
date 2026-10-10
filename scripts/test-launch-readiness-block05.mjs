import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/bimlog/src/lib/commercial-intent.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-post-onboarding.behavior.ts",
  "artifacts/bimlog/src/components/commercial-onboarding-continuity.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-workspace.behavior.ts",
]){
  const result=spawnSync(process.execPath,[tsx,file],{encoding:"utf8"});
  assert.equal(result.status,0,result.stdout+result.stderr);
  process.stdout.write(result.stdout);
}
const onboarding=fs.readFileSync("artifacts/bimlog/src/components/OnboardingFlow.tsx","utf8");
const workspace=fs.readFileSync("artifacts/bimlog/src/pages/CommercialWorkspace.tsx","utf8");
for(const token of ["postOnboardingCommercialDestination","Save and review billing","Guardar y revisar facturación","navigate(destination)"])assert.ok(onboarding.includes(token),token);
for(const token of ["readCommercialIntent","Prepare subscription","Preparar suscripción","Start secure checkout"])assert.ok(workspace.includes(token),token);
assert.equal(workspace.match(/requestCommercialSubscriptionSetup/g)?.length,2,"subscription setup must remain import plus explicit button action");
assert.equal(workspace.match(/requestCommercialHostedDestination/g)?.length,3,"hosted destinations must remain import plus checkout and portal button actions");
console.log("LR025 onboarding-to-billing continuity acceptance: PASS");
