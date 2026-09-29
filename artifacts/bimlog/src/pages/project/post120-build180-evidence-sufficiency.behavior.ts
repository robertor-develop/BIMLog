import assert from "node:assert/strict"; import {evidenceSufficiency} from "./report-experience.ts";
assert.equal(evidenceSufficiency({}).state,"unrated"); assert.equal(evidenceSufficiency({assumption:"10% faster"}).state,"assumed"); assert.equal(evidenceSufficiency({measuredValue:0}).state,"measured"); assert.match(evidenceSufficiency({assumption:"x"}).meaning,/not observed performance/);
console.log("PASS UX070 performance and scenario evidence sufficiency states");
