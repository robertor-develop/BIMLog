import assert from "node:assert/strict"; import { REPORT_MEASURES,reportMeasure } from "./report-experience.ts";
assert.deepEqual(REPORT_MEASURES.map(x=>x.key),["count","coverage","completion","value"]);
assert.match(reportMeasure("coverage").definition,/never means approval/); assert.match(reportMeasure("value").definition,/missing values are excluded/);
console.log("PASS UX066 defined role-relevant report measures");
