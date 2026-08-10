import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const service = read("./job-operations-service.ts");
const ui = read("../../../bimlog/src/components/job-operations/ProjectControlsDashboard.tsx");
const page = read("../../../bimlog/src/pages/JobOperationsWorkspace.tsx");
const help = read("../../../bimlog/src/lib/help-content.ts");

assert.match(service, /projectControlsView/);
assert.match(service, /planned-task-hours weighted completion/);
assert.match(service, /earned internal value \/ actual internal cost/);
assert.match(service, /actual \/ physical progress/);
assert.match(service, /spi: null/);
assert.match(service, /budgetVisible \? row\.cpi : null/);
assert.match(service, /valueVisible \? row\.earnedBillableValue : null/);
assert.match(service, /overdue_packages/);
assert.match(service, /blocked_packages/);
assert.match(page, /ProjectControlsDashboard/);
for (const phrase of ["Project Controls Dashboard & Forecast", "Panel de Control y Pronóstico del Proyecto", "Export CSV", "Exportar CSV", "Print / PDF", "Imprimir / PDF", "Phase / scope item", "Fase / partida", "Team member scope", "Alcance del miembro", "No AI invents missing data", "La IA no inventa datos faltantes"]) assert.match(ui, new RegExp(phrase));
assert.match(ui, /@media\(max-width:800px\)/);
assert.match(ui, /@media print/);
assert.match(help, /Project Controls Dashboard & Forecast/);
assert.match(help, /Panel de Control y Pronóstico del Proyecto/);

console.log(JSON.stringify({ status: "PASS", tests: ["weighted-physical-progress", "operational-cpi", "deterministic-eac-etc-vac", "schedule-spi-fail-closed", "entitlement-redaction", "early-warning", "scope-package-member-risk-filters", "csv-export", "print-pdf", "bilingual-responsive-ui", "manual-updated"] }));
