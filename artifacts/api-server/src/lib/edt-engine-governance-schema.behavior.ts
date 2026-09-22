import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/job-intakes.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("./edt-engine-migration.ts", import.meta.url), "utf8");
for (const table of ["job_activation_requests", "job_activation_decisions", "job_governed_change_requests", "job_governed_change_decisions"]) {
  assert.match(schema, new RegExp(`pgTable\\(\"${table}\"`));
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
for (const action of ["redistribute_work_item", "redistribute_contract", "extra_hours", "code_correction", "split_work_item", "reopen_work_item"]) {
  assert.ok(schema.includes(action));
  assert.ok(migration.includes(action));
}
assert.match(schema, /requestFingerprint[\s\S]*eligibleRole[\s\S]*reason[\s\S]*evidence/);
assert.match(migration, /job_activation_decision_immutable/);
assert.match(migration, /job_governed_change_decision_immutable/);
assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\b/i);
console.log("EDT_ENGINE_BUILD287_RESULT=PASS");
