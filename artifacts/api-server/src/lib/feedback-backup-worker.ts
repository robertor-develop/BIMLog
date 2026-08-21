import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";
import { pool } from "@workspace/db";
import { FEEDBACK_MAX_FILE_BYTES } from "./feedback-evidence-contract";
import { storage } from "./storage-adapter";

const INTERVAL_MS = 60_000, DEFAULT_BATCH_SIZE = 5, MAX_BATCH_SIZE = 25;
export const FEEDBACK_BACKUP_LEASE_MS = 5 * 60_000;
export const FEEDBACK_BACKUP_MAX_ATTEMPTS = 8;
export const FEEDBACK_BACKUP_BACKOFF_BASE_MS = 60_000;
export const FEEDBACK_BACKUP_BACKOFF_MAX_MS = 6 * 60 * 60_000;
const ENVELOPE_VERSION = 1, ENVELOPE_OVERHEAD_BYTES = 16 * 1024;
const workerOwner = `feedback-backup:${process.pid}:${randomUUID()}`;
let authority: FeedbackBackupAuthority | undefined, timer: NodeJS.Timeout | undefined, running = false;

type ObjectClient = Pick<ReplitObjectStorageClient, "uploadFromBytes" | "downloadAsStream" | "delete">;
type BackupConfig = Readonly<{ bucketId: string; backendId: string; keyId: string; key: Buffer; maxSourceBytes: number }>;
type BackupClaim = Readonly<{ id: string; assetId: number; feedbackId: number; attempt: number; leaseToken: string; fencingToken: number; sourceByteCount: number; sourceSha256: string }>;
export type FeedbackBackupReceipt = Readonly<{ backendId: string; objectId: string; encryptionKeyId: string; sourceByteCount: number; sourceSha256: string; ciphertextByteCount: number; ciphertextSha256: string; verifiedAt: string }>;
export type FeedbackBackupProgress = Readonly<{ configured: boolean; state: "not-configured" | "operational"; queued: number; eligible: number; deferred: number; leased: number; verified: number; manualReview: number; oldestEligibleAgeSeconds: number | null; backendId: string | null; restoreVerification: "exact-bytes-and-sha256" }>;
type Envelope = { schemaVersion: 1; algorithm: "AES-256-GCM"; keyId: string; assetId: number; sourceByteCount: number; sourceSha256: string; nonceB64: string; tagB64: string; ciphertextB64: string };

const ALLOWED_KEYS = new Set([
  "BIMLOG_FEEDBACK_BACKUP_BACKEND", "BIMLOG_FEEDBACK_BACKUP_BUCKET_ID", "BIMLOG_FEEDBACK_BACKUP_BACKEND_ID",
  "BIMLOG_FEEDBACK_BACKUP_KEY_ID", "BIMLOG_FEEDBACK_BACKUP_KEY_B64", "BIMLOG_FEEDBACK_BACKUP_MAX_SOURCE_BYTES",
]);

function hash(bytes: Buffer) { return createHash("sha256").update(bytes).digest("hex"); }
function backupError(code: string) { return Object.assign(new Error(code), { code }); }
function boundedLimit(limit: number) { return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, MAX_BATCH_SIZE) : DEFAULT_BATCH_SIZE; }
function canonicalBase64(value: Buffer) { return value.toString("base64"); }
function parseCanonicalBase64(value: string, expectedBytes?: number) {
  if ((value !== "" && !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) || value.length % 4 !== 0) throw backupError("FEEDBACK_BACKUP_KEY_INVALID");
  const result = Buffer.from(value, "base64");
  if (canonicalBase64(result) !== value || (expectedBytes !== undefined && result.length !== expectedBytes)) throw backupError("FEEDBACK_BACKUP_KEY_INVALID");
  return result;
}

export function parseFeedbackBackupEnvironment(environment: NodeJS.ProcessEnv = process.env): BackupConfig | null {
  for (const key of Object.keys(environment)) if (key.startsWith("BIMLOG_FEEDBACK_BACKUP_") && !ALLOWED_KEYS.has(key)) throw backupError("FEEDBACK_BACKUP_CONFIGURATION_UNKNOWN");
  const values = [...ALLOWED_KEYS].map(key => environment[key]);
  if (values.every(value => value === undefined || value === "")) return null;
  const backend = environment.BIMLOG_FEEDBACK_BACKUP_BACKEND;
  const bucketId = environment.BIMLOG_FEEDBACK_BACKUP_BUCKET_ID;
  const backendId = environment.BIMLOG_FEEDBACK_BACKUP_BACKEND_ID;
  const keyId = environment.BIMLOG_FEEDBACK_BACKUP_KEY_ID;
  const keyB64 = environment.BIMLOG_FEEDBACK_BACKUP_KEY_B64;
  const maxSourceBytes = Number(environment.BIMLOG_FEEDBACK_BACKUP_MAX_SOURCE_BYTES ?? FEEDBACK_MAX_FILE_BYTES);
  if (backend !== "replit-app-storage" || !bucketId || !backendId || !keyId || !keyB64) throw backupError("FEEDBACK_BACKUP_CONFIGURATION_INCOMPLETE");
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/i.test(bucketId) || !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(backendId) || !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(keyId)) throw backupError("FEEDBACK_BACKUP_CONFIGURATION_INVALID");
  if (bucketId === environment.BIMLOG_FEEDBACK_APP_STORAGE_BUCKET_ID) throw backupError("FEEDBACK_BACKUP_BUCKET_MUST_BE_INDEPENDENT");
  if (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes < 1 || maxSourceBytes > FEEDBACK_MAX_FILE_BYTES) throw backupError("FEEDBACK_BACKUP_MAX_BYTES_INVALID");
  return Object.freeze({ bucketId, backendId, keyId, key: parseCanonicalBase64(keyB64, 32), maxSourceBytes });
}

async function readBounded(client: ObjectClient, objectId: string, maxBytes: number) {
  const stream = client.downloadAsStream(objectId, { decompress: false });
  const chunks: Buffer[] = []; let total = 0;
  try {
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value); total += chunk.length;
      if (total > maxBytes) { stream.destroy(); throw backupError("FEEDBACK_BACKUP_OBJECT_TOO_LARGE"); }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    if ((error as { code?: string }).code?.startsWith("FEEDBACK_BACKUP_")) throw error;
    throw backupError("FEEDBACK_BACKUP_OBJECT_READ_FAILED");
  }
}

function aad(envelope: Pick<Envelope, "schemaVersion" | "algorithm" | "keyId" | "assetId" | "sourceByteCount" | "sourceSha256">) {
  return Buffer.from(JSON.stringify({ schemaVersion: envelope.schemaVersion, algorithm: envelope.algorithm, keyId: envelope.keyId, assetId: envelope.assetId, sourceByteCount: envelope.sourceByteCount, sourceSha256: envelope.sourceSha256 }), "utf8");
}

function parseEnvelope(bytes: Buffer): Envelope {
  let value: unknown; try { value = JSON.parse(bytes.toString("utf8")); } catch { throw backupError("FEEDBACK_BACKUP_ENVELOPE_INVALID"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw backupError("FEEDBACK_BACKUP_ENVELOPE_INVALID");
  const item = value as Record<string, unknown>, fields = ["schemaVersion", "algorithm", "keyId", "assetId", "sourceByteCount", "sourceSha256", "nonceB64", "tagB64", "ciphertextB64"];
  if (Object.keys(item).length !== fields.length || fields.some(field => !(field in item)) || item.schemaVersion !== 1 || item.algorithm !== "AES-256-GCM" || typeof item.keyId !== "string" || !Number.isSafeInteger(item.assetId) || typeof item.sourceByteCount !== "number" || !Number.isSafeInteger(item.sourceByteCount) || typeof item.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sourceSha256) || typeof item.nonceB64 !== "string" || typeof item.tagB64 !== "string" || typeof item.ciphertextB64 !== "string") throw backupError("FEEDBACK_BACKUP_ENVELOPE_INVALID");
  return item as unknown as Envelope;
}

export class FeedbackBackupAuthority {
  private readonly prefix = "bimlog-feedback-backup/v1";
  constructor(private readonly config: BackupConfig, private readonly client: ObjectClient) {}
  status() { return Object.freeze({ backendId: this.config.backendId, keyId: this.config.keyId, maxSourceBytes: this.config.maxSourceBytes }); }
  private objectId(assetId: number, sourceSha256: string) { return `${this.prefix}/${sourceSha256.slice(0, 2)}/${sourceSha256.slice(2, 4)}/${assetId}-${sourceSha256}.json`; }
  private envelopeLimit() { return Math.ceil(this.config.maxSourceBytes * 4 / 3) + ENVELOPE_OVERHEAD_BYTES; }
  async verifyStartup() {
    const probe = Buffer.from("bimlog-feedback-backup-health-v1");
    const receipt = await this.backup(0, probe, hash(probe));
    try { const restored = await this.restoreVerified(receipt); if (!restored.equals(probe)) throw backupError("FEEDBACK_BACKUP_HEALTH_FAILED"); }
    finally { await this.client.delete(receipt.objectId, { ignoreNotFound: true }); }
  }
  async backup(assetId: number, source: Buffer, expectedSha256: string): Promise<FeedbackBackupReceipt> {
    if (!Number.isSafeInteger(assetId) || assetId < 0 || source.length > this.config.maxSourceBytes || !/^[a-f0-9]{64}$/.test(expectedSha256) || hash(source) !== expectedSha256) throw backupError("FEEDBACK_BACKUP_SOURCE_MISMATCH");
    const base = { schemaVersion: ENVELOPE_VERSION as 1, algorithm: "AES-256-GCM" as const, keyId: this.config.keyId, assetId, sourceByteCount: source.length, sourceSha256: expectedSha256 };
    const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.config.key, nonce); cipher.setAAD(aad(base));
    const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);
    const envelope: Envelope = { ...base, nonceB64: nonce.toString("base64"), tagB64: cipher.getAuthTag().toString("base64"), ciphertextB64: encrypted.toString("base64") };
    const payload = Buffer.from(JSON.stringify(envelope), "utf8"), objectId = this.objectId(assetId, expectedSha256);
    if (payload.length > this.envelopeLimit()) throw backupError("FEEDBACK_BACKUP_OBJECT_TOO_LARGE");
    const result = await this.client.uploadFromBytes(objectId, payload, { compress: false }); if (!result.ok) throw backupError("FEEDBACK_BACKUP_OBJECT_WRITE_FAILED");
    const receipt = Object.freeze({ backendId: this.config.backendId, objectId, encryptionKeyId: this.config.keyId, sourceByteCount: source.length, sourceSha256: expectedSha256, ciphertextByteCount: payload.length, ciphertextSha256: hash(payload), verifiedAt: new Date().toISOString() });
    try { const restored = await this.restoreVerified(receipt); if (!restored.equals(source)) throw backupError("FEEDBACK_BACKUP_RESTORE_MISMATCH"); }
    catch (error) { await this.client.delete(objectId, { ignoreNotFound: true }); throw error; }
    return receipt;
  }
  async restoreVerified(receipt: FeedbackBackupReceipt) {
    if (receipt.backendId !== this.config.backendId || receipt.encryptionKeyId !== this.config.keyId || !receipt.objectId.startsWith(`${this.prefix}/`) || !/^[a-f0-9]{64}$/.test(receipt.sourceSha256) || !/^[a-f0-9]{64}$/.test(receipt.ciphertextSha256) || receipt.sourceByteCount < 0 || receipt.sourceByteCount > this.config.maxSourceBytes) throw backupError("FEEDBACK_BACKUP_RECEIPT_INVALID");
    const payload = await readBounded(this.client, receipt.objectId, this.envelopeLimit());
    if (payload.length !== receipt.ciphertextByteCount || hash(payload) !== receipt.ciphertextSha256) throw backupError("FEEDBACK_BACKUP_CIPHERTEXT_MISMATCH");
    const envelope = parseEnvelope(payload);
    if (envelope.keyId !== receipt.encryptionKeyId || envelope.assetId < 0 || envelope.sourceByteCount !== receipt.sourceByteCount || envelope.sourceSha256 !== receipt.sourceSha256) throw backupError("FEEDBACK_BACKUP_ENVELOPE_MISMATCH");
    let restored: Buffer; try {
      const decipher = createDecipheriv("aes-256-gcm", this.config.key, parseCanonicalBase64(envelope.nonceB64, 12)); decipher.setAAD(aad(envelope)); decipher.setAuthTag(parseCanonicalBase64(envelope.tagB64, 16)); restored = Buffer.concat([decipher.update(parseCanonicalBase64(envelope.ciphertextB64)), decipher.final()]);
    } catch { throw backupError("FEEDBACK_BACKUP_AUTHENTICATION_FAILED"); }
    if (restored.length !== receipt.sourceByteCount || hash(restored) !== receipt.sourceSha256) throw backupError("FEEDBACK_BACKUP_RESTORE_MISMATCH");
    return restored;
  }
}

export function createFeedbackBackupAuthorityFromEnvironment(environment: NodeJS.ProcessEnv = process.env, client?: ObjectClient) {
  const config = parseFeedbackBackupEnvironment(environment); if (!config) return null;
  return new FeedbackBackupAuthority(config, client ?? new ReplitObjectStorageClient({ bucketId: config.bucketId }));
}
export function __setFeedbackBackupAuthorityForTest(value: FeedbackBackupAuthority | undefined) { if (process.env.NODE_ENV === "production") throw backupError("FEEDBACK_BACKUP_TEST_AUTHORITY_DENIED"); authority = value; }
function authorityInstance() { if (authority === undefined) authority = createFeedbackBackupAuthorityFromEnvironment() ?? undefined; return authority; }
export async function verifyFeedbackBackupStartup() { const instance = authorityInstance(); if (instance) await instance.verifyStartup(); }

export function feedbackBackupBackoffMs(attempt: number) { if (!Number.isSafeInteger(attempt) || attempt < 1) throw backupError("FEEDBACK_BACKUP_ATTEMPT_INVALID"); return Math.min(FEEDBACK_BACKUP_BACKOFF_MAX_MS, FEEDBACK_BACKUP_BACKOFF_BASE_MS * 2 ** Math.min(attempt - 1, 30)); }
export function feedbackBackupFailureState(attempt: number) { if (!Number.isSafeInteger(attempt) || attempt < 1) throw backupError("FEEDBACK_BACKUP_ATTEMPT_INVALID"); return attempt >= FEEDBACK_BACKUP_MAX_ATTEMPTS ? "manual-review" as const : "retry-required" as const; }
function safeErrorCode(error: unknown) { const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : ""; return /^FEEDBACK_BACKUP_[A-Z0-9_]+$/.test(code) ? code : "FEEDBACK_BACKUP_UNAVAILABLE"; }

async function claim(owner: string): Promise<BackupClaim | null> {
  const leaseToken = randomUUID();
  const result = await pool.query<{ id: string; asset_id: number; feedback_id: number; attempts: number; fencing_token: string | number; source_byte_count: string | number; source_sha256: string }>(`
    WITH candidate AS (SELECT id FROM feedback_backup_jobs WHERE state IN ('queued','retry-required','backing-up') AND manual_review_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at<=now()) AND (lease_expires_at IS NULL OR lease_expires_at<=now()) ORDER BY COALESCE(next_attempt_at,created_at),created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
    UPDATE feedback_backup_jobs job SET state='backing-up',attempts=job.attempts+1,next_attempt_at=NULL,lease_owner=$1,lease_token=$2,lease_expires_at=now()+($3::integer*interval '1 millisecond'),fencing_token=job.fencing_token+1,updated_at=now() FROM candidate WHERE job.id=candidate.id
    RETURNING job.id,job.asset_id,job.feedback_id,job.attempts,job.fencing_token,job.source_byte_count,job.source_sha256`, [owner, leaseToken, FEEDBACK_BACKUP_LEASE_MS]);
  const row = result.rows[0]; return row ? Object.freeze({ id: row.id, assetId: row.asset_id, feedbackId: row.feedback_id, attempt: row.attempts, leaseToken, fencingToken: Number(row.fencing_token), sourceByteCount: Number(row.source_byte_count), sourceSha256: row.source_sha256 }) : null;
}

async function settleSuccess(claimed: BackupClaim, actorUserId: number, receipt: FeedbackBackupReceipt) {
  const client = await pool.connect(); try { await client.query("BEGIN");
    const updated = await client.query(`UPDATE feedback_backup_jobs SET state='verified',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,backup_backend_id=$1,backup_object_id=$2,encryption_key_id=$3,ciphertext_byte_count=$4,ciphertext_sha256=$5,verified_at=$6,last_error_code=NULL,manual_review_at=NULL,updated_at=now() WHERE id=$7 AND state='backing-up' AND lease_token=$8 AND fencing_token=$9 RETURNING id`, [receipt.backendId, receipt.objectId, receipt.encryptionKeyId, receipt.ciphertextByteCount, receipt.ciphertextSha256, receipt.verifiedAt, claimed.id, claimed.leaseToken, claimed.fencingToken]);
    if (!updated.rowCount) { await client.query("ROLLBACK"); return false; }
    await client.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state) VALUES($1,$2,'evidence_backup_verified',$3::jsonb)`, [claimed.feedbackId, actorUserId, JSON.stringify({ assetId: claimed.assetId, state: "verified", backendId: receipt.backendId, objectId: receipt.objectId, encryptionKeyId: receipt.encryptionKeyId, sourceByteCount: receipt.sourceByteCount, sourceSha256: receipt.sourceSha256, ciphertextByteCount: receipt.ciphertextByteCount, ciphertextSha256: receipt.ciphertextSha256, verifiedAt: receipt.verifiedAt, attempt: claimed.attempt, fencingToken: claimed.fencingToken, restoreVerification: "exact-bytes-and-sha256", actorType: "worker" })]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

async function settleFailure(claimed: BackupClaim, actorUserId: number, error: unknown) {
  const state = feedbackBackupFailureState(claimed.attempt), delay = state === "retry-required" ? feedbackBackupBackoffMs(claimed.attempt) : null, code = safeErrorCode(error), client = await pool.connect();
  try { await client.query("BEGIN");
    const updated = await client.query(`UPDATE feedback_backup_jobs SET state=$1,next_attempt_at=${delay === null ? "NULL" : `now()+(${delay}::integer*interval '1 millisecond')`},lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,last_error_code=$2,manual_review_at=${state === "manual-review" ? "now()" : "NULL"},updated_at=now() WHERE id=$3 AND state='backing-up' AND lease_token=$4 AND fencing_token=$5 RETURNING next_attempt_at,manual_review_at`, [state, code, claimed.id, claimed.leaseToken, claimed.fencingToken]);
    if (!updated.rowCount) { await client.query("ROLLBACK"); return false; }
    await client.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state) VALUES($1,$2,'evidence_backup_failed',$3::jsonb)`, [claimed.feedbackId, actorUserId, JSON.stringify({ assetId: claimed.assetId, state, attempt: claimed.attempt, nextAttemptAt: updated.rows[0].next_attempt_at?.toISOString?.() ?? null, errorCode: code, fencingToken: claimed.fencingToken, actorType: "worker" })]);
    await client.query("COMMIT"); return true;
  } catch (failure) { await client.query("ROLLBACK").catch(() => undefined); throw failure; } finally { client.release(); }
}

export async function processFeedbackBackupBatch(limit = DEFAULT_BATCH_SIZE) {
  const instance = authorityInstance(); if (!instance) return { attempted: 0, verified: 0, failed: 0, manualReview: 0 };
  let attempted = 0, verified = 0, failed = 0, manualReview = 0;
  for (let slot = 0; slot < boundedLimit(limit); slot += 1) {
    const claimed = await claim(workerOwner); if (!claimed) break; attempted += 1; let actorUserId: number | undefined;
    try {
      const source = await pool.query<{ storage_path: string; byte_size: number; sha256: string; uploaded_by_id: number }>(`SELECT storage_path,byte_size,sha256,uploaded_by_id FROM feedback_assets WHERE id=$1 AND feedback_id=$2`, [claimed.assetId, claimed.feedbackId]);
      const asset = source.rows[0]; if (!asset || Number(asset.byte_size) !== claimed.sourceByteCount || asset.sha256 !== claimed.sourceSha256) throw backupError("FEEDBACK_BACKUP_SOURCE_MISMATCH"); const actor = asset.uploaded_by_id; actorUserId = actor;
      const bytes = await storage.downloadBounded(asset.storage_path, FEEDBACK_MAX_FILE_BYTES); if (bytes.length !== claimed.sourceByteCount || hash(bytes) !== claimed.sourceSha256) throw backupError("FEEDBACK_BACKUP_SOURCE_MISMATCH");
      const receipt = await instance.backup(claimed.assetId, bytes, claimed.sourceSha256); const restored = await instance.restoreVerified(receipt); if (!restored.equals(bytes)) throw backupError("FEEDBACK_BACKUP_RESTORE_MISMATCH");
      if (await settleSuccess(claimed, actor, receipt)) verified += 1;
    } catch (error) { failed += 1; if (actorUserId !== undefined && await settleFailure(claimed, actorUserId, error).catch(() => false) && claimed.attempt >= FEEDBACK_BACKUP_MAX_ATTEMPTS) manualReview += 1; }
  }
  return { attempted, verified, failed, manualReview };
}

export async function feedbackBackupProgress(): Promise<FeedbackBackupProgress> {
  const config = parseFeedbackBackupEnvironment();
  const result = await pool.query<{ queued: string; eligible: string; deferred: string; leased: string; verified: string; manual_review: string; oldest: string | null }>(`SELECT count(*) FILTER(WHERE state='queued')::text queued,count(*) FILTER(WHERE state IN('queued','retry-required','backing-up') AND manual_review_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at<=now()) AND (lease_expires_at IS NULL OR lease_expires_at<=now()))::text eligible,count(*) FILTER(WHERE state='retry-required' AND next_attempt_at>now())::text deferred,count(*) FILTER(WHERE state='backing-up' AND lease_expires_at>now())::text leased,count(*) FILTER(WHERE state='verified')::text verified,count(*) FILTER(WHERE state='manual-review')::text manual_review,extract(epoch FROM now()-min(created_at) FILTER(WHERE state IN('queued','retry-required','backing-up') AND manual_review_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at<=now()) AND (lease_expires_at IS NULL OR lease_expires_at<=now())))::text oldest FROM feedback_backup_jobs`);
  const row = result.rows[0]; return Object.freeze({ configured: config !== null, state: config ? "operational" : "not-configured", queued: Number(row?.queued ?? 0), eligible: Number(row?.eligible ?? 0), deferred: Number(row?.deferred ?? 0), leased: Number(row?.leased ?? 0), verified: Number(row?.verified ?? 0), manualReview: Number(row?.manual_review ?? 0), oldestEligibleAgeSeconds: row?.oldest == null ? null : Math.max(0, Number(row.oldest)), backendId: config?.backendId ?? null, restoreVerification: "exact-bytes-and-sha256" });
}

export function startFeedbackBackupWorker() {
  if (!authorityInstance() || timer) return;
  const run = () => { if (running) return; running = true; void processFeedbackBackupBatch().catch(error => console.error("[feedback] backup worker failed", error instanceof Error ? error.name : "unknown")).finally(() => { running = false; }); };
  run(); timer = setInterval(run, INTERVAL_MS); timer.unref?.();
}
