import assert from "node:assert/strict";
import fs from "node:fs";

const drizzle = fs.readFileSync(new URL("../lib/db/src/schema/launch-configuration.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../artifacts/api-server/src/lib/launch-configuration-migration.ts", import.meta.url), "utf8");

const canonicalChecks = [
  "launch_configurations_environment_check",
  "launch_configurations_state_check",
  "launch_configurations_revision_check",
  "launch_configuration_versions_revision_check",
  "launch_configuration_audit_action_check",
  "launch_configuration_audit_revision_check",
  "launch_email_verification_audit_revision_check",
  "launch_email_verification_audit_provider_check",
  "launch_email_verification_audit_action_check",
  "launch_email_verification_audit_status_check",
  "launch_payment_verification_audit_revision_check",
  "launch_payment_verification_audit_method_check",
  "launch_payment_verification_audit_mode_check",
  "launch_payment_verification_audit_status_check",
];

for (const name of canonicalChecks) assert.ok(drizzle.includes(name), `missing canonical Drizzle check ${name}`);
assert.doesNotMatch(drizzle, /launch_(?:configuration|configurations|email|payment)[^"']+_chk["']/);

for (const name of [
  "launch_configuration_audit_time_idx",
  "launch_email_verification_audit_time_idx",
  "launch_payment_verification_audit_time_idx",
]) {
  assert.ok(drizzle.includes(name), `missing Drizzle runtime index ${name}`);
  assert.ok(runtime.includes(name), `missing runtime index ${name}`);
}

assert.ok(drizzle.includes('unique("launch_configurations_environment_key")'));
assert.ok(drizzle.includes('unique("launch_configuration_versions_configuration_id_revision_key")'));
assert.doesNotMatch(drizzle, /launch_(?:configurations_environment|configuration_versions_revision)_uidx/);

console.log("LAUNCH_SCHEMA_CONTRACT=PASS canonical_checks=14 runtime_indexes=3 unique_constraints=2");
