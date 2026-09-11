import assert from "node:assert/strict";
import fs from "node:fs";

const intake = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const operations = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
const reports = fs.readFileSync(new URL("../../../bimlog/src/pages/project/ReportsTab.tsx", import.meta.url), "utf8");

assert.match(intake, /aria-live="polite"/);
assert.match(intake, /role="alert"/);
assert.match(intake, /@media\(max-width:900px\)/);
assert.match(intake, /@media\(max-width:560px\)/);
assert.match(operations, /aria-labelledby="document-connections-title"/);
assert.match(operations, /role="status"/);
assert.match(operations, /role="alert"/);
assert.match(operations, /\.jo-table\{display:block;overflow:auto\}/);
assert.match(operations, /@media\(max-width:560px\)/);
assert.match(reports, /role="alert" aria-live="assertive"/);
assert.match(reports, /max-h-\[calc\(100vh-32px\)\]/);
assert.match(reports, /w-\[calc\(100vw-32px\)\]/);
assert.match(reports, /sm:grid-cols-2/);

console.log("POST-P17 Build 24 responsive and accessibility contract: PASS");
