import assert from "node:assert/strict";import fs from "node:fs";
const panel=fs.readFileSync(new URL("./CommercialLaunchPanel.tsx",import.meta.url),"utf8");
for(const token of ["/api/v1/admin/commercial-launch/dossier","parseCommercialLaunchDossier","Launch dossier","Expediente de lanzamiento","Supplier","Proveedor","Registration / tax identity","Invoice jurisdiction","Billing and support","BIMLog configuration required"])assert.ok(panel.includes(token),token);
assert.match(panel,/dossier\.sourceCommit\.slice\(0,12\)/);assert.match(panel,/dossier\.missingConfigurationKeys\.join/);assert.match(panel,/dossier\.ready/);
console.log("Launch Block 1 Build 5 bilingual operator dossier: PASS");
