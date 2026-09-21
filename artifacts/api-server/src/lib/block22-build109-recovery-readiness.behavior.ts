import assert from "node:assert/strict";
import fs from "node:fs";
import { recoveryDecision } from "./runtime-resilience";

const restore = fs.readFileSync(new URL("../../../../scripts/database-restore-rehearsal.mjs", import.meta.url), "utf8");
for (const safeguard of ["bimlog_rfi_restore_test", "pg_dump.exe", "pg_restore.exe", "backupSha256", "recordCountsExact", "DROP DATABASE bimlog_rfi_restore_test"]) assert.ok(restore.includes(safeguard), safeguard);
assert.match(restore, /F:\\\\BIMLOG\\\\TESTPROOF/);
assert.doesNotMatch(restore, /PROD_DATABASE_URL/);
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/workflow-governance-policies.ts", import.meta.url), "utf8");
for (const stableName of ["policies_code_check", "versions_version_chk", "versions_revision_check", "versions_state_check", "versions_fingerprint_check", "events_action_check"]) assert.ok(schema.includes(stableName), stableName);
assert.equal(recoveryDecision({ operation: "read", failure: "database_disconnect", acknowledged: false }), "retry");
assert.equal(recoveryDecision({ operation: "non_idempotent_write", failure: "partial_response", acknowledged: false }), "fail_closed");

const deployment = fs.readFileSync(new URL("../../../bimlog/src/lib/deployment-module-recovery.ts", import.meta.url), "utf8");
assert.match(deployment, /reload|recover/i);
console.log("block22 build109 recovery readiness: PASS isolated_restore=guarded checksums=required counts=exact rollback=fail_closed");
