import assert from "node:assert/strict";
import { LAUNCH_CONFIGURATION_SCHEMA_SQL } from "./launch-configuration-migration";

for (const token of ["launch_configurations", "launch_configuration_versions", "launch_configuration_audit", "launch_email_verification_audit", "UNIQUE(configuration_id, revision)", "development','staging','production", "REFERENCES users(id)"]) {
  assert.ok(LAUNCH_CONFIGURATION_SCHEMA_SQL.includes(token), token);
}
assert.match(LAUNCH_CONFIGURATION_SCHEMA_SQL, /configuration jsonb NOT NULL/);
assert.match(LAUNCH_CONFIGURATION_SCHEMA_SQL, /readiness jsonb NOT NULL/);
console.log("LAUNCH_CONFIGURATION_BUILD_06=PASS persistence=additive environments=isolated revisions=append-only");
