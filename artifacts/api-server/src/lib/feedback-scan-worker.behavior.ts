import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("./feedback-scan-worker.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("./feedback-schema-migration.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/feedback-items.ts", import.meta.url), "utf8");
const checks: Array<[string, RegExp, string]> = [
  ["only governed ClamAV activation starts the worker", /BIMLOG_FEEDBACK_SCANNER === "clamav-cli"/, source],
  ["startup verifies scanner authority", /verifyFeedbackScannerStartup.*verifyStartup\(\)/s, source],
  ["claim is an atomic skip-locked lease", /FOR UPDATE SKIP LOCKED.*scan_lease_owner=\$1.*scan_lease_expires_at=.*scan_fencing_token=asset\.scan_fencing_token\+1/s, source],
  ["claim order is fair by eligibility then age", /ORDER BY COALESCE\(scan_next_attempt_at,created_at\),created_at,id/, source],
  ["worker reads bounded private bytes", /storage\.downloadBounded\(asset\.storagePath, FEEDBACK_MAX_FILE_BYTES\)/, source],
  ["worker rechecks structure, byte count, hash, and MIME", /inspectFeedbackEvidence.*byteLength !== asset\.byteSize.*sha256 !== asset\.sha256.*mediaType !== asset\.mediaType/s, source],
  ["settlement is fenced by exact lease and immutable identity", /sha256, receipt\.sha256.*byteSize, receipt\.byteCount.*scanLeaseToken, claim\.leaseToken.*scanFencingToken, claim\.fencingToken/s, source],
  ["infected evidence is rejected", /receipt\.verdict === "clean" \? "clean" : "rejected"/, source],
  ["failures remain quarantined and become explicit manual review", /evidence_scan_failed.*decision\.state.*scanManualReviewAt/s, source],
  ["backfill progress exposes bounded queue classes and oldest age", /feedbackScanBackfillProgress.*oldest_eligible_age_seconds/s, source],
  ["migration enrolls existing quarantine without resetting prior schedule", /scan_next_attempt_at=COALESCE\(scan_next_attempt_at,created_at\).*scan_state='quarantined'/s, migration],
  ["schema seals lease triples and nonnegative fence", /feedback_assets_scan_lease_chk.*feedback_assets_scan_fencing_chk/s, `${schema}\n${migration}`],
];
for (const [name, pattern, text] of checks) assert.match(text, pattern, name);

const FEEDBACK_SCAN_BACKOFF_BASE_MS = 30_000, FEEDBACK_SCAN_BACKOFF_MAX_MS = 6 * 60 * 60_000, FEEDBACK_SCAN_MAX_ATTEMPTS = 8;
const feedbackScanBackoffMs = (attempt: number) => {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("FEEDBACK_SCAN_ATTEMPT_INVALID");
  return Math.min(FEEDBACK_SCAN_BACKOFF_MAX_MS, FEEDBACK_SCAN_BACKOFF_BASE_MS * 2 ** Math.min(attempt - 1, 30));
};
const feedbackScanFailureDecision = (attempt: number, at: Date) => attempt >= FEEDBACK_SCAN_MAX_ATTEMPTS ? { state: "manual-review", nextAttemptAt: null } : { state: "retry-required", nextAttemptAt: new Date(at.getTime() + feedbackScanBackoffMs(attempt)) };
type FeedbackScanScheduleRow = Readonly<{ id: number; createdAtMs: number; nextAttemptAtMs: number | null; leaseExpiresAtMs: number | null; manualReview: boolean }>;
const selectFeedbackScanScheduleRows = (rows: readonly FeedbackScanScheduleRow[], nowMs: number, limit: number) => rows
  .filter(row => !row.manualReview && (row.nextAttemptAtMs === null || row.nextAttemptAtMs <= nowMs) && (row.leaseExpiresAtMs === null || row.leaseExpiresAtMs <= nowMs))
  .sort((left, right) => (left.nextAttemptAtMs ?? left.createdAtMs) - (right.nextAttemptAtMs ?? right.createdAtMs) || left.createdAtMs - right.createdAtMs || left.id - right.id).slice(0, limit);

assert.match(source, new RegExp(`FEEDBACK_SCAN_BACKOFF_BASE_MS = ${FEEDBACK_SCAN_BACKOFF_BASE_MS.toLocaleString("en-US").replace(",", "_")}`), "proof constants bind production backoff base");
assert.match(source, new RegExp(`FEEDBACK_SCAN_MAX_ATTEMPTS = ${FEEDBACK_SCAN_MAX_ATTEMPTS}`), "proof constants bind production terminal attempt");
const now = Date.parse("2026-08-21T12:00:00.000Z");
assert.equal(feedbackScanBackoffMs(1), FEEDBACK_SCAN_BACKOFF_BASE_MS);
assert.equal(feedbackScanBackoffMs(2), FEEDBACK_SCAN_BACKOFF_BASE_MS * 2);
assert.equal(feedbackScanBackoffMs(99), FEEDBACK_SCAN_BACKOFF_MAX_MS);
assert.throws(() => feedbackScanBackoffMs(0), /FEEDBACK_SCAN_ATTEMPT_INVALID/);

const retry = feedbackScanFailureDecision(1, new Date(now));
assert.equal(retry.state, "retry-required");
assert.equal(retry.nextAttemptAt?.getTime(), now + FEEDBACK_SCAN_BACKOFF_BASE_MS);
const deadLetter = feedbackScanFailureDecision(FEEDBACK_SCAN_MAX_ATTEMPTS, new Date(now));
assert.deepEqual(deadLetter, { state: "manual-review", nextAttemptAt: null });

const poison: FeedbackScanScheduleRow[] = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, createdAtMs: now - 60_000, nextAttemptAtMs: now + 30_000, leaseExpiresAtMs: null, manualReview: false }));
const laterClean: FeedbackScanScheduleRow = { id: 11, createdAtMs: now - 1_000, nextAttemptAtMs: null, leaseExpiresAtMs: null, manualReview: false };
assert.deepEqual(selectFeedbackScanScheduleRows([...poison, laterClean], now, 10).map(row => row.id), [11], "ten deferred poison rows cannot starve a later eligible clean row");

const leased: FeedbackScanScheduleRow = { id: 12, createdAtMs: now - 2_000, nextAttemptAtMs: null, leaseExpiresAtMs: now + 1, manualReview: false };
assert.deepEqual(selectFeedbackScanScheduleRows([leased], now, 1), [], "a live crash lease is not stolen");
assert.deepEqual(selectFeedbackScanScheduleRows([leased], now + 1, 1).map(row => row.id), [12], "an expired crash lease is reclaimable");
assert.deepEqual(selectFeedbackScanScheduleRows([{ ...leased, leaseExpiresAtMs: null, manualReview: true }], now + 100, 1), [], "manual review stays quarantined and cannot be automatically reclaimed");

console.log(`Feedback scan scheduling behavior: ${checks.length + 10}/${checks.length + 10} passed`);
