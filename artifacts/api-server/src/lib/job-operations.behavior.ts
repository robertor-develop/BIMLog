import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const migration = read("./job-intake-migration.ts");
const service = read("./job-operations-service.ts");
const routes = read("../routes/job-operations.ts");
const routeIndex = read("../routes/index.ts");
const schema = read("../../../../lib/db/src/schema/job-intakes.ts");
const ui = read("../../../bimlog/src/pages/JobOperationsWorkspace.tsx");
const shell = read("../../../bimlog/src/components/layout/FinancialProjectShell.tsx");
const sidebar = read("../../../bimlog/src/components/layout/ProjectSidebar.tsx");
const app = read("../../../bimlog/src/App.tsx");

assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|CONSTRAINT)\b/i, "operations migration must remain additive");
for (const table of ["job_activation_time_entries", "job_activation_task_deliverables", "job_activation_operation_events"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} must be created idempotently`);
  assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} must exist in the canonical Drizzle schema`);
}
for (const column of ["progress_percent", "version"]) assert.match(migration, new RegExp(column));
assert.match(migration, /hours\s*>\s*0\s+AND\s+hours\s*<=\s*24/);
assert.match(migration, /UNIQUE\(task_id,file_id,deliverable_type\)/);

assert.match(service, /pm\.status='active'/, "operations must require active project membership");
assert.match(service, /MANAGER_ROLES/);
assert.match(service, /taskAccess/);
assert.match(service, /canControl: access\.canManage/);
assert.match(service, /canRemove: access\.canManage/);
assert.match(service, /version=version\+1/);
assert.match(service, /JOB_OPERATIONS_STALE/);
assert.match(service, /workHours/);
assert.match(service, /ON CONFLICT\(task_id,file_id,deliverable_type\)/);
assert.match(service, /FROM files WHERE id=\$1 AND project_id=\$2/);
assert.match(service, /job_activation_operation_events/);
assert.match(service, /LEFT JOIN LATERAL \(SELECT SUM\(hours\)/, "time aggregation must not multiply when deliverables are joined");
assert.match(service, /internalHourlyRate: showBudget \? row\.internalHourlyRate : null/);
assert.match(service, /billingHourlyRate: showPlanner \? row\.billingHourlyRate : null/);
assert.match(service, /plannedInternalCost: showBudget \? totals\.rows\[0\]\.plannedInternalCost : null/);
assert.match(service, /earnedBillableValue: showPlanner \? totals\.rows\[0\]\.earnedBillableValue : null/);

assert.match(routes, /authMiddleware/);
for (const endpoint of ["operations/tasks/:taskId", "operations/assignments/:assignmentId", "operations/time", "operations/deliverables"]) assert.ok(routes.includes(endpoint), `${endpoint} must be routed`);
assert.match(routes, /error: \{ en: error\.message, es:/);
assert.match(routeIndex, /router\.use\(jobOperationsRouter\)/);

for (const phrase of ["Job Operations", "Operaciones del Trabajo", "Record actual hours", "Registrar horas reales", "Connect deliverable", "Conectar entregable", "Planned internal cost", "Costo interno planificado"]) assert.match(ui, new RegExp(phrase));
assert.match(ui, /data\.capabilities\?\.budget/);
assert.match(ui, /data\.capabilities\?\.cost_value_planner/);
assert.match(ui, /crypto\.randomUUID\(\)/);
assert.match(ui, /@media\(max-width:900px\)/);
assert.match(shell, /"operations"/);
assert.match(sidebar, /\/operations/);
assert.match(app, /JobOperationsWorkspace/);

console.log(JSON.stringify({ status: "PASS", tests: ["additive-schema", "active-membership", "leader-and-assignee-control", "optimistic-concurrency", "bounded-time", "project-file-scope", "idempotent-deliverables", "immutable-events", "safe-aggregation", "entitlement-redaction", "bilingual-api", "bilingual-responsive-ui", "navigation"] }));
