import assert from "node:assert/strict";import fs from "node:fs";
const panel=fs.readFileSync(new URL("./CommercialLaunchPanel.tsx",import.meta.url),"utf8"),page=fs.readFileSync(new URL("../../pages/TotalControl.tsx",import.meta.url),"utf8");
for(const token of ["Commercial launch activation","Activación del lanzamiento comercial","Ready to sell live subscriptions","Listo para vender suscripciones reales","BIMLog action required","Acción requerida de BIMLog"])assert.ok(panel.includes(token),token);
assert.match(panel,/verifyCommercialLaunchForLiveSource/);assert.match(panel,/evaluateCommercialVerificationEvidence/);assert.match(panel,/decision\.status/);assert.match(panel,/Live source/);assert.match(page,/CommercialLaunchPanel/);assert.match(page,/Commercial Launch/);
assert.ok(panel.includes("Verify live services"));assert.ok(panel.includes("Verificar servicios reales"));assert.ok(panel.includes("Current live provider verification passed"));assert.ok(panel.includes("Live provider verification is not current"));
for(const token of ["Bound source","Fuente vinculada","Valid until","Válido hasta","evidenceSha256","No source-bound evidence was issued."])assert.ok(panel.includes(token),token);
console.log("B269 current-source commercial verification control surface: PASS");
