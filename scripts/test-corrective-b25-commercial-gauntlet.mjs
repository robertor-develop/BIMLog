import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("scripts/run-corrective-b25-commercial-gauntlet.mjs","utf8");
for(const gate of ["test:corrective-b21","test:corrective-b22","test:corrective-b23","test:corrective-b24"]) assert.ok(source.includes(gate),gate);
for(const boundary of ["protectedProductionDataMutations:0","configuredSecretsInspected:0","LOCAL_PASS_EXTERNAL_CONFIGURATION_REQUIRED"]) assert.ok(source.includes(boundary),boundary);
console.log("CORRECTIVE-B25 commercial gauntlet contract: PASS");
