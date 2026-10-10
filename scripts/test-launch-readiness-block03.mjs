import assert from "node:assert/strict";import fs from "node:fs";import {spawnSync} from "node:child_process";
const run=file=>{const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",file],{encoding:"utf8"});assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);};
run("artifacts/api-server/src/lib/public-commercial-availability.behavior.ts");run("artifacts/bimlog/src/lib/public-commercial-availability-client.behavior.ts");
const route=fs.readFileSync("artifacts/api-server/src/routes/public-commercial-availability.ts","utf8"),index=fs.readFileSync("artifacts/api-server/src/routes/index.ts","utf8"),pricing=fs.readFileSync("artifacts/bimlog/src/pages/Pricing.tsx","utf8"),authorityMatrix=fs.readFileSync("scripts/endpoint-authority-matrix.mjs","utf8");
for(const token of ["/public/commercial-availability","Cache-Control","no-store","X-Content-Type-Options","nosniff"])assert.ok(route.includes(token),token);assert.ok(index.includes("publicCommercialAvailabilityRouter"));
for(const token of ["fetchPublicCommercialAvailability","Free signup is available now","No payment is taken from this public page","Availability could not be verified","aria-live=\"polite\""])assert.ok(pricing.includes(token),token);
assert.ok(!route.includes("STRIPE_SECRET_KEY"));assert.ok(!route.includes("configurationKeys"));assert.ok(authorityMatrix.includes("public-commercial-availability\\.ts\\|GET\\|\\/public\\/commercial-availability"));
console.log("LR012 public endpoint, LR014 bilingual Pricing truth, LR015 complete block acceptance: PASS");
