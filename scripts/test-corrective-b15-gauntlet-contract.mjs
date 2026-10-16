import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("scripts/run-corrective-b15-gauntlet.mjs","utf8");
for(const gate of ["test:corrective-b11","test:corrective-b12","test:corrective-b13","test:corrective-b14","test:ga-final-block03-build021","test:ga-final-block03-build022","test:ga-final-block04-build028","test:ga-final-block05-build031","test:ga-final-block05-build032","test:ga-final-block05-build033"])
  assert.ok(source.includes(gate),`gauntlet missing ${gate}`);
assert.match(source,/status!==0/);
console.log("CORRECTIVE-B15 gauntlet contract: PASS");
