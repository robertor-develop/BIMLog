import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ui = path.resolve(here, "../../../bimlog/src");
const read = (relative: string) => readFileSync(path.join(ui, relative), "utf8");

const button = read("components/PrintPdfButton.tsx");
const navbar = read("components/layout/Navbar.tsx");
const intake = read("pages/JobIntakeWorkspace.tsx");
const operations = read("pages/JobOperationsWorkspace.tsx");
const planner = read("pages/FinancialApuWorkspace.tsx");
const team = read("pages/TeamPerformanceWorkspace.tsx");
const help = read("pages/HelpCenter.tsx");
const manual = read("lib/help-content.ts");

assert.match(button, /"Imprimir PDF" : "Print PDF"/);
assert.match(button, /selectionMode/);
assert.match(button, /downloadPdfResponse/);
for (const [name, source, surface] of [
  ["Job Intake", intake, "job-intake"],
  ["Job Operations", operations, "job-operations"],
  ["Cost & Value Planner", planner, "cost-value-planner"],
  ["Team Performance", team, "team-performance"],
] as const) {
  assert.match(source, /PrintPdfButton/, `${name} must use the standard PDF dialog`);
  assert.match(source, new RegExp(`surface: "${surface}"`), `${name} must use the governed PDF endpoint`);
  assert.doesNotMatch(source, /window\.print|window\.open/, `${name} must not use browser printing or a blank popup`);
}
assert.match(help, /\/api\/v1\/help\/manual\/pdf/);
assert.match(help, /Complete manual/);
assert.match(help, /Current category and search/);
assert.match(help, /Current manual section/);
assert.doesNotMatch(help, /window\.print|window\.open|Print complete manual|Print this manual section/);
assert.doesNotMatch(planner, /Print \/ Save draft PDF|Draft PDF|PDF borrador/);
assert.match(navbar, /v1\.60\.31\.04/);
assert.match(navbar, /marginTop:4/);
assert.doesNotMatch(navbar, /window\.print/);
assert.match(manual, /v1\.60\.31\.04: Build 4 and consistent PDF generation/);
assert.match(manual, /generación consistente de PDF/);

console.log("Build 4 PDF UI consistency validation: 5/5 surfaces passed.");
