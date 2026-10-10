import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const read=path=>fs.readFileSync(path,"utf8");
const run=path=>{const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",path],{stdio:"inherit",shell:false});assert.equal(result.status,0,`${path} failed`);};

for(const path of [
  "artifacts/api-server/src/lib/commercial-checkout-authorization.behavior.ts",
  "artifacts/api-server/src/lib/commercial-checkout-command.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-workspace-client.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-checkout-eligibility.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-hosted-destination.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-workspace.behavior.ts",
])run(path);

const route=read("artifacts/api-server/src/routes/commercial-workspace.ts"),checkout=route.slice(route.indexOf('router.post("/commercial/checkout"'),route.indexOf('router.post("/commercial/subscription-setup"'));
for(const token of ["readLatestCommercialLaunchVerification(pool)","resolveReleaseMetadata(process.env).sourceCommit","deriveCommercialLaunchAuthorization","CHECKOUT_LIVE_VERIFICATION_REQUIRED"])assert.ok(checkout.includes(token),token);
assert.ok(checkout.indexOf("readLatestCommercialLaunchVerification(pool)")<checkout.indexOf("startCommercialCheckout"),"current verification must be resolved before checkout starts");
const commandSource=read("artifacts/api-server/src/lib/commercial-checkout-command.ts"),command=commandSource.slice(commandSource.indexOf("export async function startCommercialCheckout"));
assert.ok(command.indexOf("requireCommercialCheckoutReadiness")<command.indexOf("readPersistentCommercialAuthority"));
assert.ok(command.indexOf("requireCommercialCheckoutAuthorization")<command.indexOf("readPersistentCommercialAuthority"));
const page=read("artifacts/bimlog/src/pages/CommercialWorkspace.tsx");
for(const text of ["BIMLog must verify the currently published release before checkout","BIMLog debe verificar la versión publicada actualmente antes del pago"])assert.ok(page.includes(text),text);
console.log("LR050 source-bound live-checkout acceptance: PASS");
