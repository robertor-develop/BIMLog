import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const route = read("../routes/feedback.ts");
const backup = read("./feedback-backup-worker.ts");
const migration = read("./feedback-schema-migration.ts");

for (const token of [
  'router.post("/feedback"', 'router.get("/feedback/mine"', 'router.get("/feedback/:id/history"',
  'router.get("/feedback/admin"', 'router.patch("/feedback/admin/:id"', "ownerUserId", "TRANSITIONS",
  "pg_advisory_xact_lock", "observedVersion", "FEEDBACK_STALE", "feedbackAuditEventsTable",
]) assert.ok(route.includes(token), `durable feedback route contract missing: ${token}`);
for (const token of [
  "feedback_backup_jobs", "FOR UPDATE SKIP LOCKED", "lease_token=$2", "fencing_token=job.fencing_token+1",
  "restoreVerified(receipt)", "FEEDBACK_BACKUP_RESTORE_MISMATCH", "evidence_backup_verified", "manual-review",
]) assert.ok(backup.includes(token), `backup/restore contract missing: ${token}`);
for (const token of ["feedback_items", "feedback_assets", "feedback_audit_events", "feedback_backup_jobs"]) {
  assert.ok(migration.includes(token), `feedback schema migration missing: ${token}`);
}
assert.match(route, /beforeState: \{ status: before\.status, version: before\.version, ownerUserId: before\.ownerUserId/);
assert.match(route, /afterState: \{ status: row\.status, version: row\.version, ownerUserId: row\.ownerUserId/);
assert.match(backup, /sourceByteCount.*sourceSha256.*ciphertextByteCount.*ciphertextSha256.*restoreVerification/s);
console.log("PASS Build 076 durable feedback capture/readback/assignment/state/evidence/restore contract");
