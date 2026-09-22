import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/job-intakes.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("./edt-engine-migration.ts", import.meta.url), "utf8");
for (const table of ["job_activation_edt_nodes", "job_activation_work_item_code_aliases"]) {
  assert.match(schema, new RegExp(`pgTable\\(\"${table}\"`));
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
for (const column of ["edt_node_id", "location_identity", "trade_identity", "deliverable_type_identity", "display_code", "revision_number", "issuance_version", "split_from_work_item_id", "identity_fingerprint", "economic_plan_fingerprint"]) {
  assert.match(schema, new RegExp(`\"${column}\"`));
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
}
assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE)\b/i);
assert.match(migration, /UNIQUE INDEX IF NOT EXISTS job_activation_work_item_display_code_uidx/);
assert.match(migration, /job_activation_work_item_active_alias_uidx/);
console.log("EDT_ENGINE_BUILD286_RESULT=PASS");
