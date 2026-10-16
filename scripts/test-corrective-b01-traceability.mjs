import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ledger=JSON.parse(readFileSync("evidence/post-audit-corrective-20261016/GA_BUILD_TRACEABILITY.json","utf8"));
const pkg=JSON.parse(readFileSync("package.json","utf8"));
assert.equal(ledger.schemaVersion,"bimlog-ga-build-traceability-v1");
assert.equal(ledger.builds.length,33);
assert.deepEqual(ledger.builds.map(x=>x.id),Array.from({length:33},(_,i)=>String(i+1).padStart(3,"0")));
for(const row of ledger.builds){
  assert.ok(["behavioral","synthetic/source","structural","self-authored-receipt","none","synthetic","synthetic-behavior","static-plus-behavior"].includes(row.evidence));
  if(row.gate) assert.equal(typeof pkg.scripts[row.gate],"string",`${row.id} references a missing gate`);
  else assert.equal(row.disposition,"unrepresented");
  assert.notEqual(row.disposition,"live-ga-pass","ledger must not manufacture live acceptance");
}
assert.deepEqual(ledger.builds.filter(x=>x.disposition==="unrepresented").map(x=>x.id),["011","012","013","014","015","016","017","018","019","020"]);
console.log("CORRECTIVE-B01 traceability PASS: 001-033 accounted; 011-020 explicitly unrepresented; unsupported claims reclassified");
