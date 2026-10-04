import assert from "node:assert/strict";import fs from "node:fs";
const panel=fs.readFileSync(new URL("./CommercialLaunchPanel.tsx",import.meta.url),"utf8"),page=fs.readFileSync(new URL("../../pages/TotalControl.tsx",import.meta.url),"utf8");
for(const token of ["Commercial launch activation","Activación del lanzamiento comercial","Ready to sell live subscriptions","Listo para vender suscripciones reales","BIMLog action required","Acción requerida de BIMLog"])assert.ok(panel.includes(token),token);
assert.match(panel,/\/api\/v1\/admin\/commercial-launch/);assert.match(panel,/parseCommercialLaunch/);assert.match(page,/CommercialLaunchPanel/);assert.match(page,/Commercial Launch/);
console.log("B254 Super Admin commercial launch control surface: PASS");
