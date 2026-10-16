import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("scripts/run-corrective-b30-release-gauntlet.mjs","utf8");
for(const gate of ["test:corrective-b25","test:corrective-b26","test:corrective-b27","test:corrective-b28","test:corrective-b29"]) assert.ok(source.includes(gate),gate);
for(const boundary of ["protectedProductionDataMutations:0","configuredSecretsInspected:0","unpublishedBuilds:10","publicationRequired:true","postPublicationAuthenticatedChromeRequired:true"]) assert.ok(source.includes(boundary),boundary);
console.log("CORRECTIVE-B30 ten-build release gauntlet contract: PASS");
