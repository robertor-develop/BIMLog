import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root=path.resolve(import.meta.dirname,"../../../..");
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),"utf8");
const migration=read("artifacts/api-server/src/lib/onboarding-migration.ts"),route=read("artifacts/api-server/src/routes/onboarding.ts"),ui=read("artifacts/bimlog/src/components/OnboardingFlow.tsx"),app=read("artifacts/bimlog/src/App.tsx"),updater=read("plugins/BIMLogLensNext/native/LensNextNativeUpdateService.cs");
assert.match(migration,/email_verified_at/);assert.match(route,/token_hash/);assert.match(route,/expires_at/);assert.match(route,/consumed_at/);assert.match(app,/\/verify-email/);
assert.match(ui,/Current authenticated company/);assert.match(ui,/secure invitation/);assert.match(ui,/never grants permissions/);assert.match(route,/WORK_PROFILE_INVALID/);
assert.match(ui,/\/projects\/\$\{createdProjectId\}\/intake/);assert.match(ui,/team assignments can remain pending/);
assert.match(ui,/Shop Drawings/);assert.match(route,/preferred_disciplines/);assert.match(route,/ONBOARDING_PREREQUISITES_INCOMPLETE/);assert.match(updater,/Replace\("\{year\}"/);
const config=read("plugins/BIMLogLensNext/native/LensNextNativeConfig.cs"),modulus=config.match(/<Modulus>([^<]+)<\/Modulus>/)?.[1],exponent=config.match(/<Exponent>([^<]+)<\/Exponent>/)?.[1];
assert.ok(modulus&&exponent,"embedded update public key missing");
const publicKey=crypto.createPublicKey({key:{kty:"RSA",n:Buffer.from(modulus,"base64").toString("base64url"),e:Buffer.from(exponent,"base64").toString("base64url")},format:"jwk"});
for(const year of [2021,2025]){const dir=path.join(root,"artifacts/bimlog/public/lens-next/updates/stable",String(year)),manifest=JSON.parse(fs.readFileSync(path.join(dir,"manifest.json"),"utf8")),pkg=fs.readFileSync(path.join(dir,path.basename(new URL(manifest.packageUrl).pathname)));assert.deepEqual(manifest.navisworksYears,[year]);assert.equal(pkg.length,manifest.packageSize);assert.equal(crypto.createHash("sha256").update(pkg).digest("hex"),manifest.packageSha256);const payload=[manifest.contractVersion,manifest.channel,manifest.version,manifest.minimumBimLogVersion,manifest.packageUrl,manifest.packageSha256,String(manifest.packageSize),manifest.navisworksYears.join(","),manifest.mandatory?"true":"false",manifest.releaseNotesUrl].join("\n");assert.equal(crypto.verify("RSA-SHA256",Buffer.from(payload),publicKey,Buffer.from(manifest.signature,"base64")),true);}
console.log("SaaS Block 12 B056-B060 onboarding and dual-year updater publication contract: PASS");
