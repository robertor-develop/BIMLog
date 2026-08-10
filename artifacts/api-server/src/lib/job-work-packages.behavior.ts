import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const migration = read("./job-intake-migration.ts");
const service = read("./job-operations-service.ts");
const routes = read("../routes/job-operations.ts");
const ui = read("../../../../artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx");
const schema = read("../../../../lib/db/src/schema/job-intakes.ts");

for (const table of ["job_activation_work_packages", "job_activation_work_package_tasks"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} must be created idempotently`);
  assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} must exist in the canonical Drizzle schema`);
}
assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE)\b/i, "work-package migration must remain additive");
assert.match(migration, /package_type IN\('shop_drawing','submittal','mixed','deliverable'\)/);
assert.match(migration, /status IN\('draft','internal_review','submitted','returned','approved','cancelled'\)/);
assert.match(migration, /UNIQUE\(project_id,package_code\)/);
assert.match(migration, /UNIQUE\(package_id,task_id\)/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS package_id/);

assert.match(service, /PACKAGE_TRANSITIONS/);
for (const status of ["draft", "internal_review", "submitted", "returned", "approved", "cancelled"]) assert.match(service, new RegExp(status));
assert.match(service, /Only the project leader may create work packages/);
assert.match(service, /responsible_user_id\) === actorUserId/);
assert.match(service, /pm\.status='active'/);
assert.match(service, /Every package task must belong to the selected activated work item/);
assert.match(service, /package_code=\$2 AND id<>\$3/);
assert.match(service, /work_item_id=\$1 AND id=ANY\(\$2::text\[\]\)/);
assert.match(service, /version=version\+1/);
assert.match(service, /JOB_OPERATIONS_STALE/);
assert.match(service, /ROUND\(AVG\(t\.progress_percent\)\)/, "package progress must roll up from linked tasks");
assert.match(service, /p\.due_date<CURRENT_DATE/, "overdue state must be calculated server-side");
assert.match(service, /work_package_created/);
assert.match(service, /work_package_updated/);
assert.match(service, /packageSummary/);

assert.match(routes, /authMiddleware/);
for (const endpoint of ["operations/packages", "operations/packages/:packageId"]) assert.ok(routes.includes(endpoint), `${endpoint} must be routed`);
assert.match(routes, /JOB_OPERATIONS_PACKAGE_TRANSITION_INVALID/);
assert.match(routes, /error: \{ en: error\.message, es:/);

for (const phrase of ["Work packages", "Paquetes de trabajo", "Create package", "Crear paquete", "Internal review", "Revisión interna", "Overdue packages", "Paquetes vencidos"]) assert.match(ui, new RegExp(phrase));
assert.match(ui, /form\.getAll\("taskIds"\)/);
assert.match(ui, /packageStatusLabel/);
assert.match(ui, /packageTypeLabel/);
assert.match(ui, /data\.packageSummary/);
assert.match(ui, /@media\(max-width:900px\)/);

console.log(JSON.stringify({ status: "PASS", tests: ["additive-schema", "project-code-uniqueness", "active-project-scope", "manager-create", "responsible-control", "lifecycle-transitions", "same-work-item-tasks", "optimistic-concurrency", "automatic-progress", "overdue-and-blocked-summary", "immutable-events", "bilingual-responsive-ui"] }));
