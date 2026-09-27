import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../components/job-operations/project-controls-filters.behavior";

for (const path of ["../pages/JobOperationsWorkspace.tsx", "../components/job-operations/ProjectControlsDashboard.tsx"]) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  assert.ok(source.includes("Recorded-hour billable value"));
  assert.ok(source.includes("Valor facturable de horas registradas"));
  assert.ok(!source.includes('"Earned billable value"'));
  assert.ok(!source.includes("from approved operational data"));
}
const help = readFileSync(new URL("./help-content.ts", import.meta.url), "utf8");
assert.ok(help.includes("Actual hours are recorded hours, not approved hours"));
assert.ok(help.includes("no horas aprobadas"));
console.log("C015 recorded-value labels, bilingual source explanation and attributable totals: PASS");
