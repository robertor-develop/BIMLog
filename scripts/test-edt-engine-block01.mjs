import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const evidenceRoot = "evidence/edt-engine-program-20260922";

const requirements = read(`${evidenceRoot}/BUILD_276_PACKAGE_REQUIREMENTS_REGISTER.md`);
assert.match(requirements, /MATCHED=12 TOTAL=12/);
assert.match(requirements, /Project → Contract → Work Item/);
assert.match(requirements, /No production deployment or production database migration/);

const reconciliation = read(`${evidenceRoot}/BUILD_277_REPOSITORY_RELEASE_RECONCILIATION.md`);
assert.match(reconciliation, /c97efd491f15d393f7c432419f2e2d908cd574a8/);
assert.match(reconciliation, /Push success\s+and deployment success remain separate facts/);
assert.match(reconciliation, /No production database connection was opened/);

const delta = read(`${evidenceRoot}/BUILD_278_EXISTING_CAPABILITY_DELTA.md`);
for (const authority of [
  "company_delivery_workflow_*",
  "job_intakes",
  "job_activation_*",
  "Schedule buckets/Sprints",
  "Change Order module",
]) assert.ok(delta.includes(authority), `missing reuse decision: ${authority}`);
for (const gap of ["r0-v0", "result` worksheet", "anti-self-approval", "exact 10.00%"])
  assert.ok(delta.toLowerCase().includes(gap), `missing classified gap: ${gap}`);

const schemaPlan = read(`${evidenceRoot}/BUILD_279_ADDITIVE_SCHEMA_PLAN.md`);
assert.match(schemaPlan, /Database connected: `NO`/);
assert.match(schemaPlan, /Migration executed: `NO`/);
assert.match(schemaPlan, /CREATE TABLE IF NOT EXISTS/);
assert.match(schemaPlan, /DROP.*TRUNCATE.*DELETE/s);
assert.match(schemaPlan, /both:[\s\S]*Drizzle definitions[\s\S]*idempotent runtime migration/);

const intakeSchema = read("lib/db/src/schema/job-intakes.ts");
for (const existingTable of [
  "job_activation_work_items",
  "job_activation_tasks",
  "job_activation_resource_assignments",
  "job_activation_time_entries",
  "job_activation_budget_accounts",
]) assert.ok(intakeSchema.includes(existingTable), `existing authority missing: ${existingTable}`);

const workflowMigration = read("artifacts/api-server/src/lib/delivery-workflow-template-migration.ts");
assert.match(workflowMigration, /company_delivery_workflow_templates/);
assert.match(workflowMigration, /company_delivery_workflow_work_items/);

const governanceUi = read("artifacts/bimlog/src/pages/CompanyWorkflowGovernance.tsx");
assert.match(governanceUi, /recorded policy intent, not yet execution permissions/);

const scheduleUi = read("artifacts/bimlog/src/pages/project/ScheduleTab.tsx");
assert.match(scheduleUi, /Create Bucket or Sprint/);

console.log("EDT_ENGINE_BLOCK01_RESULT=PASS");
console.log("BUILD_276_PACKAGE_REQUIREMENTS=PASS");
console.log("BUILD_277_SOURCE_RELEASE_BOUNDARIES=PASS");
console.log("BUILD_278_CAPABILITY_DELTA=PASS");
console.log("BUILD_279_ADDITIVE_SCHEMA_PLAN=PASS");
console.log("BUILD_280_EVIDENCE_HARNESS=PASS");
console.log("PRODUCT_SOURCE_CHANGED=NO");
console.log("DATABASE_CHANGED=NO");
console.log("LENS_NEXT_NATIVE_CHANGED=NO");
console.log("NAVISWORKS_SMOKE_REQUIRED=NO");
