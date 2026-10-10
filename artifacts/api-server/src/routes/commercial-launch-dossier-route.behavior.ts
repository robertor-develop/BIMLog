import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("./commercial-workspace.ts",import.meta.url),"utf8");
assert.match(source,/router\.get\("\/admin\/commercial-launch\/dossier",authMiddleware,isSuperAdminMiddleware/);
for(const token of ["deriveCommercialLaunchProfile(process.env)","deriveCommercialLaunchActivation(process.env)","readLatestCommercialLaunchVerification(pool)","deriveCommercialLaunchDossier","commercialLaunchProfileConfigurationKeys","COMMERCIAL_LAUNCH_DOSSIER_UNAVAILABLE"])assert.ok(source.includes(token),token);
assert.match(source,/Cache-Control","private, no-store, max-age=0/);assert.match(source,/Vary","Authorization/);
console.log("Launch Block 1 Build 3 protected launch dossier endpoint: PASS");
