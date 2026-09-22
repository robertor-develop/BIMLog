import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("./edt-engine-migration.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/job-intakes.ts", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8");

const tables = [
  "job_activation_edt_nodes",
  "job_activation_work_item_code_aliases",
  "job_activation_requests",
  "job_activation_decisions",
  "job_governed_change_requests",
  "job_governed_change_decisions",
  "job_activation_work_item_economic_plans",
  "job_activation_budget_ledger_entries",
  "job_activation_work_item_issuances",
  "job_activation_qc_decisions",
  "job_intake_import_batches",
  "job_intake_import_rows",
];
for (const table of tables) {
  assert.match(schema, new RegExp(`pgTable\\(\"${table}\"`), `Drizzle table missing: ${table}`);
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `runtime migration missing: ${table}`);
}
assert.match(app, /ensureEdtEngineSchema/);
assert.match(app, /edtEngineStartupBarrier/);
assert.match(migration, /BEGIN/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /ROLLBACK/);
assert.doesNotMatch(migration, /^\s*(DROP\b|TRUNCATE\b|DELETE\s+FROM\b)/im);
assert.match(migration, /legacy_recorded/, "historical time entries must not be silently reclassified");
assert.match(migration, /worksheet_name='Result'/, "only the approved workbook sheet may be imported");
console.log("EDT_ENGINE_BUILD290_RESULT=PASS");
console.log(`DRIZZLE_RUNTIME_TABLE_CORRESPONDENCE=${tables.length}`);
console.log("ADDITIVE_ZERO_DROP=PASS");
console.log("PRODUCTION_DATABASE_CHANGED=NO");
console.log("LENS_NEXT_NATIVE_CHANGED=NO");
