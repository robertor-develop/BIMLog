import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync(new URL("../lib/db/scripts/reconcile-launch-audit-indexes.mjs", import.meta.url), "utf8");
const sync = fs.readFileSync(new URL("../lib/db/scripts/sync-development-schema.mjs", import.meta.url), "utf8");
for (const token of ['BIMLOG_SCHEMA_TARGET !== "development"', 'hostname.includes("helium")', 'development.identity === production.identity', 'BEGIN READ ONLY', 'pg_advisory_xact_lock', '"created_at" DESC', 'launch_configuration_audit_time_idx', 'launch_email_verification_audit_time_idx', 'launch_payment_verification_audit_time_idx']) assert.ok(script.includes(token), `missing safety/canonical token: ${token}`);
assert.ok(sync.includes('reconcile-launch-audit-indexes.mjs'), "development sync must run index reconciliation");
assert.ok(sync.indexOf('reconcile-launch-audit-indexes.mjs') < sync.indexOf('check-schema-parity.mjs'), "reconciliation must precede parity");
console.log("Launch audit index development reconciliation contract: PASS");
