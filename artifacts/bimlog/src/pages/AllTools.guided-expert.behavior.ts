import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./AllTools.tsx", import.meta.url), "utf8");
assert.match(source, /recommendedJourney.*\["intake", "operations", "files", "reports"\]/s);
assert.match(source, /Recommended project journey.*Recorrido recomendado del proyecto/s);
assert.match(source, /New to this project\?.*skip directly to any authorized tool below/s);
assert.match(source, /entry\.href && setLocation\(entry\.href\)/);
assert.match(source, /Direct expert access.*Acceso directo experto/s);
assert.doesNotMatch(source, /forceWizard|wizardRequired|completeWizardFirst/);
console.log("GUIDED_AND_EXPERT_ACCESS_P014=PASS");
