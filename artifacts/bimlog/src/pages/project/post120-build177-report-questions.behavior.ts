import assert from "node:assert/strict"; import {REPORT_QUESTIONS,reportInputs} from "./report-experience.ts";
assert.equal(new Set(REPORT_QUESTIONS.flatMap(x=>x.reports)).size,10); assert.match(REPORT_QUESTIONS[0].label,/project under control/i); assert.deepEqual(reportInputs("cvr"),["CVR findings","selected date range","detail choice"]);
console.log("PASS UX067 report chooser organized by business question");
