import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredScripts = [
  "test:outcome-remediation-block11",
  "test:outcome-remediation-block12",
  "test:ux-block05",
  "test:ux-block06",
  "test:ux-block07",
  "test:ux-block23",
  "test:ux-block24",
  "test:lorena-p1-release-block02",
  "test:lorena-p1-release-block03",
  "test:lorena-p1-release-block04",
  "test:edt-engine-block14",
  "test:recovery-ga-block03",
  "test:recovery-ga-block04",
  "test:full-ga-remediation-block05",
  "test:ga-final-block03-build021",
  "test:ga-final-block03-build022",
  "test:ga-final-block03-build023",
  "test:ga-final-block02-build010",
  "test:ga-final-block04-build028",
  "test:page-assistant-workspace-block02",
  "test:corrective-b35",
  "test:ga-final-block05-build032",
];
for (const name of requiredScripts) assert.equal(typeof packageJson.scripts[name], "string", `missing executable criterion: ${name}`);

const matrix = fs.readFileSync("evidence/outcome-remediation-20261023/LORENA_FINAL_ACCEPTANCE.md", "utf8");
for (const criterion of ["Job Intake", "APU and Cost & Value", "Delivery workflow", "EDT/WBS", "Activation and Operations", "RFIs", "Submittals", "Files, transmittals and reports", "BIMLog Agent", "UX, responsive and accessibility"])
  assert.match(matrix, new RegExp(criterion.replace(/[&/]/g, "."), "i"), `criterion absent: ${criterion}`);
assert.match(matrix, /Viva independent acceptance is separate/);
assert.doesNotMatch(matrix, /\| PASS \|/);
assert.doesNotMatch(matrix, /\|\s*(?:ACCEPTED|INDEPENDENTLY_ACCEPTED|CUSTOMER_ACCEPTED)\s*\|/i);
assert.match(matrix, /AWAITING_INDEPENDENT_REVIEW/);
console.log(`Lorena final closure inventory: PASS (${requiredScripts.length} executable suites; live acceptance remains explicit)`);
