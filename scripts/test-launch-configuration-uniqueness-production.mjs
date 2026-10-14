import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./apply-launch-configuration-uniqueness-production.mjs", import.meta.url), "utf8");
for (const token of [
  "launch-configuration-uniqueness-v1",
  "BIMLOG_ACCEPTED_BRANCH",
  "BIMLOG_ACCEPTED_COMMIT",
  "HEAD must equal the accepted remote branch",
  "Clean source tree is required",
  "Uniqueness preflight failed",
  "launch_configurations_environment_key UNIQUE(environment)",
  "launch_configuration_versions_configuration_id_revision_key UNIQUE(configuration_id,revision)",
  "ROLLBACK",
  "receiptSha256",
]) assert.ok(source.includes(token), token);

const schema = fs.readFileSync(new URL("../lib/db/src/schema/launch-configuration.ts", import.meta.url), "utf8");
for (const index of ["launch_configuration_audit_time_idx", "launch_email_verification_audit_time_idx", "launch_payment_verification_audit_time_idx"]) {
  assert.match(schema, new RegExp(`${index}[^\\n]+createdAt\\.desc\\(\\)`));
}

console.log("launch configuration uniqueness production migration contract: passed");
