import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../../bimlog/src/features/lens-next/LensNextPanel.tsx", import.meta.url), "utf8");
assert.match(route, /"Issue Viewpoints"/);
assert.match(route, /issueViewpointsByIssue/);
assert.match(route, /\[Primary\]/);
assert.match(route, /\[Archived\]/);
assert.match(route, /lens-issue-viewpoint-history\.v1/);
assert.match(panel, /Additional Issue viewpoints are listed in the Excel export/);
assert.match(panel, /XML V2 currently exports only each Issue's primary viewpoint/);
console.log("Lens Build 009 export compatibility and separate viewpoint history disclosure: PASS");
