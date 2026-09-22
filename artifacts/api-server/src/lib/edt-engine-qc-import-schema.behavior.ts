import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/job-intakes.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("./edt-engine-migration.ts", import.meta.url), "utf8");
for (const table of ["job_activation_work_item_issuances", "job_activation_qc_decisions", "job_intake_import_batches", "job_intake_import_rows"]) {
  assert.match(schema, new RegExp(`pgTable\\(\"${table}\"`));
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(schema, /revisionNumber[\s\S]*issuanceVersion[\s\S]*issuanceFingerprint/);
assert.match(migration, /UNIQUE\(work_item_id,revision_number,issuance_version\)/);
assert.match(migration, /worksheet_name text NOT NULL DEFAULT 'Result' CHECK \(worksheet_name='Result'\)/);
for (const invalidState of ["invalid", "unsupported", "duplicate"]) assert.ok(schema.includes(invalidState) && migration.includes(invalidState));
assert.match(migration, /job_activation_qc_decision_immutable/);
assert.match(migration, /job_intake_import_row_immutable/);
assert.doesNotMatch(migration, /^\s*(DROP\b|TRUNCATE\b|DELETE\s+FROM\b)/im);
console.log("EDT_ENGINE_BUILD289_RESULT=PASS");
