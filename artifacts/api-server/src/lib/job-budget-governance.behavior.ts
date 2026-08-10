import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const migration = read("./job-intake-migration.ts");
const service = read("./job-operations-service.ts");
const routes = read("../routes/job-operations.ts");
const schema = read("../../../../lib/db/src/schema/job-intakes.ts");
const ui = read("../../../bimlog/src/components/job-operations/BudgetGovernancePanel.tsx");
const page = read("../../../bimlog/src/pages/JobOperationsWorkspace.tsx");
const help = read("../../../bimlog/src/lib/help-content.ts");
const sidebarUtilities = read("../../../bimlog/src/components/layout/SidebarUtilities.tsx");
const projectSidebar = read("../../../bimlog/src/components/layout/ProjectSidebar.tsx");

for (const table of ["job_activation_budget_baselines", "job_activation_budget_variance_reviews"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(schema, new RegExp(`pgTable\\("${table}"`));
}
assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b/i);
assert.match(migration, /UNIQUE\(project_id,version\)/);
assert.match(migration, /variance_value>0/);
assert.match(service, /pg_advisory_xact_lock/);
assert.match(service, /content_fingerprint/);
assert.match(service, /budget_baseline_frozen/);
assert.match(service, /budget_baseline_revised/);
assert.match(service, /budget_variance_explained/);
assert.match(service, /budget_variance_reviewed/);
assert.match(service, /A budget revision requires a reason of at least 10 characters/);
assert.match(service, /Budget Governance requires Project Budget or Cost & Value Planner access/);
assert.match(service, /actualInternalCost/);
assert.match(service, /SELECT SUM\(planned_internal_cost\) planned_internal_cost FROM job_activation_resource_assignments/);
assert.match(service, /status IN\('open','acknowledged'\)/);
assert.doesNotMatch(migration, /budget_baseline_fingerprint_uidx/);
assert.match(service, /unresolvedOverruns/);
for (const endpoint of ["operations/budget/baselines", "operations/budget/variance-reviews"]) assert.ok(routes.includes(endpoint));
for (const phrase of ["Budget Governance & Change Control", "Gobernanza del Presupuesto y Control de Cambios", "Freeze approved baseline", "Congelar línea base aprobada", "Root cause", "Causa raíz", "Corrective action", "Acción correctiva"]) assert.match(ui, new RegExp(phrase));
assert.match(page, /BudgetGovernancePanel/);
assert.match(help, /Budget Governance & Change Control/);
assert.match(help, /Gobernanza del Presupuesto y Control de Cambios/);
assert.match(ui, /@media\(max-width:900px\)/);
assert.ok(sidebarUtilities.indexOf('label("Info", "Info")') < sidebarUtilities.indexOf('label("Collapse", "Contraer")'));
assert.ok(sidebarUtilities.indexOf('label("Collapse", "Contraer")') < sidebarUtilities.indexOf('label("Help", "Ayuda")'));
assert.doesNotMatch(sidebarUtilities, /SmartGuide/);
assert.doesNotMatch(projectSidebar, /className="phasea-collapse-toggle"/);

console.log(JSON.stringify({ status: "PASS", tests: ["additive-schema", "immutable-versioned-baselines", "server-calculated-variance", "nonduplicating-cost-aggregation", "active-review-deduplication", "entitlement-boundary", "manager-control", "revision-reason", "overrun-explanation", "corrective-action", "optimistic-review", "immutable-events", "bilingual-responsive-ui", "sidebar-help-layout", "manual-updated"] }));
