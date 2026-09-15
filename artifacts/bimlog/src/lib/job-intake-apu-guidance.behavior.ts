import assert from "node:assert/strict";
import fs from "node:fs";
const ui = fs.readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
for (const phrase of ["APU coverage by contract", "Cobertura APU por contrato", "exactly one compatible version exists", "exactamente una versión compatible", "existing selections are never overwritten", "selecciones existentes nunca se sobrescriben"]) assert.match(ui, new RegExp(phrase));
assert.match(ui, /contractApuCoverage/);
assert.match(ui, /entry\.boundCount.*entry\.itemCount/);
console.log("job-intake-apu-guidance: PASS");
