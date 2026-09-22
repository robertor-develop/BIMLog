import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/job-intakes.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("./edt-engine-migration.ts", import.meta.url), "utf8");
for (const table of ["job_activation_work_item_economic_plans", "job_activation_budget_ledger_entries"]) {
  assert.match(schema, new RegExp(`pgTable\\(\"${table}\"`));
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
for (const pool of ["direct_production", "project_administrative", "incentive_reserve", "task_earnings", "project_earnings"]) assert.ok(schema.includes(pool) && migration.includes(pool));
for (const state of ["budgeted", "committed_pending", "approved_consumed", "released", "corrected"]) assert.ok(schema.includes(state) && migration.includes(state));
for (const column of ["status", "optimistic_version", "submitted_by_id", "decided_by_id", "corrects_entry_id", "superseded_by_entry_id", "source_fingerprint"]) assert.match(migration, new RegExp(`job_activation_time_entries ADD COLUMN IF NOT EXISTS ${column}`));
assert.match(migration, /job_activation_economic_plan_immutable/);
assert.match(migration, /job_activation_budget_ledger_immutable/);
assert.doesNotMatch(migration, /^\s*(DROP\b|TRUNCATE\b|DELETE\s+FROM\b)/im);
console.log("EDT_ENGINE_BUILD288_RESULT=PASS");
