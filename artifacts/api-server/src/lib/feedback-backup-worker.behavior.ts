import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
process.env.PROD_DATABASE_URL ??= "postgres://fixture:fixture@127.0.0.1:1/fixture";
const {
  createFeedbackBackupAuthorityFromEnvironment,
  feedbackBackupBackoffMs,
  feedbackBackupFailureState,
  parseFeedbackBackupEnvironment,
} = await import("./feedback-backup-worker");

const key = Buffer.alloc(32, 37).toString("base64");
function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    BIMLOG_FEEDBACK_APP_STORAGE_BUCKET_ID: "primary-feedback-bucket",
    BIMLOG_FEEDBACK_BACKUP_BACKEND: "replit-app-storage",
    BIMLOG_FEEDBACK_BACKUP_BUCKET_ID: "independent-backup-bucket",
    BIMLOG_FEEDBACK_BACKUP_BACKEND_ID: "feedback-backup-test",
    BIMLOG_FEEDBACK_BACKUP_KEY_ID: "feedback-backup-key-v1",
    BIMLOG_FEEDBACK_BACKUP_KEY_B64: key,
    BIMLOG_FEEDBACK_BACKUP_MAX_SOURCE_BYTES: "20971520",
    ...overrides,
  };
}

const objects = new Map<string, Buffer>();
const client = {
  async uploadFromBytes(name: string, bytes: Buffer) { objects.set(name, Buffer.from(bytes)); return { ok: true as const, value: null }; },
  downloadAsStream(name: string) { const value = objects.get(name); return value ? Readable.from([value]) : Readable.from((async function*(){ throw new Error("missing"); })()); },
  async delete(name: string) { objects.delete(name); return { ok: true as const, value: null }; },
};

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
async function checkAsync(name: string, fn: () => Promise<void>) { await fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

check("empty environment leaves backup disabled", () => assert.equal(parseFeedbackBackupEnvironment({ NODE_ENV: "production" }), null));
check("complete authority parses exact independent binding", () => { const parsed = parseFeedbackBackupEnvironment(environment()); assert.equal(parsed?.backendId, "feedback-backup-test"); assert.equal(parsed?.key.length, 32); });
check("partial authority fails closed", () => assert.throws(() => parseFeedbackBackupEnvironment({ BIMLOG_FEEDBACK_BACKUP_BACKEND: "replit-app-storage" }), /INCOMPLETE/));
check("primary bucket reuse is denied", () => assert.throws(() => parseFeedbackBackupEnvironment(environment({ BIMLOG_FEEDBACK_BACKUP_BUCKET_ID: "primary-feedback-bucket" })), /MUST_BE_INDEPENDENT/));
check("unknown authority input is denied", () => assert.throws(() => parseFeedbackBackupEnvironment(environment({ BIMLOG_FEEDBACK_BACKUP_UNSAFE: "1" })), /UNKNOWN/));
check("noncanonical or short key is denied", () => assert.throws(() => parseFeedbackBackupEnvironment(environment({ BIMLOG_FEEDBACK_BACKUP_KEY_B64: Buffer.alloc(16).toString("base64") })), /KEY_INVALID/));

await checkAsync("encrypted backup readback restores exact bytes and hash", async () => {
  objects.clear(); const authority = createFeedbackBackupAuthorityFromEnvironment(environment(), client)!; const source = Buffer.from("governed feedback evidence"); const digest = createHash("sha256").update(source).digest("hex");
  const receipt = await authority.backup(41, source, digest); assert.equal(receipt.sourceSha256, digest); assert.equal(receipt.sourceByteCount, source.length); assert.ok(receipt.objectId.startsWith("bimlog-feedback-backup/v1/")); assert.notEqual(objects.get(receipt.objectId)?.includes(source), true); assert.deepEqual(await authority.restoreVerified(receipt), source);
});
await checkAsync("ciphertext substitution fails authentication and exact hash", async () => {
  objects.clear(); const authority = createFeedbackBackupAuthorityFromEnvironment(environment(), client)!; const source = Buffer.from("tamper proof"); const receipt = await authority.backup(42, source, createHash("sha256").update(source).digest("hex")); const payload = Buffer.from(objects.get(receipt.objectId)!); payload[payload.length - 3] ^= 1; objects.set(receipt.objectId, payload);
  await assert.rejects(authority.restoreVerified(receipt), /CIPHERTEXT_MISMATCH|AUTHENTICATION_FAILED|ENVELOPE_INVALID/);
});
await checkAsync("wrong key cannot restore an authentic envelope", async () => {
  objects.clear(); const sourceAuthority = createFeedbackBackupAuthorityFromEnvironment(environment(), client)!; const source = Buffer.from("key ring proof"); const receipt = await sourceAuthority.backup(43, source, createHash("sha256").update(source).digest("hex"));
  const wrong = createFeedbackBackupAuthorityFromEnvironment(environment({ BIMLOG_FEEDBACK_BACKUP_KEY_B64: Buffer.alloc(32, 12).toString("base64") }), client)!; await assert.rejects(wrong.restoreVerified(receipt), /AUTHENTICATION_FAILED/);
});
await checkAsync("startup probe leaves no backup residue", async () => { objects.clear(); await createFeedbackBackupAuthorityFromEnvironment(environment(), client)!.verifyStartup(); assert.equal(objects.size, 0); });
await checkAsync("zero-byte source is encrypted and exactly restorable", async () => { objects.clear(); const authority = createFeedbackBackupAuthorityFromEnvironment(environment(), client)!; const source = Buffer.alloc(0), receipt = await authority.backup(44, source, createHash("sha256").update(source).digest("hex")); assert.deepEqual(await authority.restoreVerified(receipt), source); });

check("retry backoff is bounded and attempt eight enters manual review", () => { assert.equal(feedbackBackupBackoffMs(1), 60_000); assert.equal(feedbackBackupBackoffMs(99), 6 * 60 * 60_000); assert.equal(feedbackBackupFailureState(7), "retry-required"); assert.equal(feedbackBackupFailureState(8), "manual-review"); });
check("worker source binds fair claim lease fence exact restore audit and progress", () => {
  const source = readFileSync(new URL("./feedback-backup-worker.ts", import.meta.url), "utf8");
  for (const token of ["FOR UPDATE SKIP LOCKED", "lease_token=$2", "fencing_token=job.fencing_token+1", "restoreVerified(receipt)", "evidence_backup_verified", "evidence_backup_failed", "feedbackBackupProgress", "manual-review"]) assert.ok(source.includes(token), token);
});
check("retry object identity is deterministic so a crash cannot strand random backup objects", () => { const source = readFileSync(new URL("./feedback-backup-worker.ts", import.meta.url), "utf8"); assert.match(source, /\$\{assetId\}-\$\{sourceSha256\}\.json/); assert.doesNotMatch(source, /assetId\}-\$\{randomUUID\(\)\}/); });
check("migration installs and backfills durable backup authority", () => { const source = readFileSync(new URL("./feedback-schema-migration.ts", import.meta.url), "utf8"); assert.ok(source.includes("CREATE TABLE IF NOT EXISTS feedback_backup_jobs")); assert.ok(source.includes("ON CONFLICT(asset_id) DO NOTHING")); });

process.stdout.write(`feedback backup behavior: ${passed}/${passed} passed\n`);
