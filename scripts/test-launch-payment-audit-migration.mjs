import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptUrl = new URL("./apply-launch-payment-audit-production.mjs", import.meta.url);
const source = fs.readFileSync(scriptUrl, "utf8");

assert.equal((source.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length, 1);
assert.equal((source.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).length, 1);
assert.match(source, /launch_payment_verification_audit/);
assert.match(source, /pg_advisory_xact_lock/);
assert.match(source, /await client\.query\("BEGIN"\)/);
assert.match(source, /await client\.query\("COMMIT"\)/);
assert.match(source, /await client\.query\("ROLLBACK"\)/);
assert.match(source, /before\.json/);
assert.match(source, /after\.json/);
assert.doesNotMatch(source, /(?:^|\n)\s*(?:DROP|DELETE|TRUNCATE|UPDATE)\b/m);

const refusal = spawnSync(process.execPath, [fileURLToPath(scriptUrl)], {
  cwd: new URL("..", import.meta.url),
  env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("BIMLOG_PRODUCTION_ADDITIVE_MIGRATION"))),
  encoding: "utf8",
});
assert.notEqual(refusal.status, 0);
assert.match(`${refusal.stdout}\n${refusal.stderr}`, /Set BIMLOG_PRODUCTION_ADDITIVE_MIGRATION=launch-payment-verification-audit-v1/);

console.log("LAUNCH_PAYMENT_AUDIT_MIGRATION=PASS additive_only=1 transaction=1 evidence=before_after authorization=fail_closed");
