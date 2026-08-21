import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { feedbackAssetsTable, feedbackAuditEventsTable } from "../../../../lib/db/src/schema/feedback-items";
import { FEEDBACK_MAX_FILE_BYTES, inspectFeedbackEvidence } from "./feedback-evidence-contract";
import { createFeedbackScannerFromEnvironment, type GovernedFeedbackScanner } from "./feedback-scanner";
import { storage } from "./storage-adapter";

const WORKER_INTERVAL_MS = 30_000, DEFAULT_BATCH_SIZE = 10, MAX_BATCH_SIZE = 100;
export const FEEDBACK_SCAN_LEASE_MS = 5 * 60_000;
export const FEEDBACK_SCAN_MAX_ATTEMPTS = 8;
export const FEEDBACK_SCAN_BACKOFF_BASE_MS = 30_000;
export const FEEDBACK_SCAN_BACKOFF_MAX_MS = 6 * 60 * 60_000;
let scanner: GovernedFeedbackScanner | undefined, timer: NodeJS.Timeout | undefined, running = false;
const workerOwner = `feedback-scan:${process.pid}:${randomUUID()}`;

type ScanClaim = Readonly<{ id: number; attempt: number; leaseToken: string; fencingToken: number }>;
export type FeedbackScanScheduleRow = Readonly<{ id: number; createdAtMs: number; nextAttemptAtMs: number | null; leaseExpiresAtMs: number | null; manualReview: boolean }>;
export type FeedbackScanFailureDecision = Readonly<{ state: "retry-required" | "manual-review"; nextAttemptAt: Date | null }>;
export type FeedbackScanBackfillProgress = Readonly<{ quarantined: number; eligible: number; deferred: number; leased: number; manualReview: number; oldestEligibleAgeSeconds: number | null }>;

function configured() { return process.env.BIMLOG_FEEDBACK_SCANNER === "clamav-cli"; }
function scannerInstance() { if (!scanner) scanner = createFeedbackScannerFromEnvironment(process.env); return scanner; }
function boundedLimit(limit: number) { return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, MAX_BATCH_SIZE) : DEFAULT_BATCH_SIZE; }

export function feedbackScanBackoffMs(attempt: number) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("FEEDBACK_SCAN_ATTEMPT_INVALID");
  return Math.min(FEEDBACK_SCAN_BACKOFF_MAX_MS, FEEDBACK_SCAN_BACKOFF_BASE_MS * 2 ** Math.min(attempt - 1, 30));
}

export function feedbackScanFailureDecision(attempt: number, now = new Date()): FeedbackScanFailureDecision {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("FEEDBACK_SCAN_ATTEMPT_INVALID");
  if (attempt >= FEEDBACK_SCAN_MAX_ATTEMPTS) return Object.freeze({ state: "manual-review", nextAttemptAt: null });
  return Object.freeze({ state: "retry-required", nextAttemptAt: new Date(now.getTime() + feedbackScanBackoffMs(attempt)) });
}

/** Pure mirror of the database eligibility/order contract for deterministic scheduling proofs. */
export function selectFeedbackScanScheduleRows(rows: readonly FeedbackScanScheduleRow[], nowMs: number, limit: number) {
  return rows.filter(row => !row.manualReview && (row.nextAttemptAtMs === null || row.nextAttemptAtMs <= nowMs) && (row.leaseExpiresAtMs === null || row.leaseExpiresAtMs <= nowMs))
    .sort((left, right) => (left.nextAttemptAtMs ?? left.createdAtMs) - (right.nextAttemptAtMs ?? right.createdAtMs) || left.createdAtMs - right.createdAtMs || left.id - right.id)
    .slice(0, boundedLimit(limit));
}

export async function verifyFeedbackScannerStartup(): Promise<void> { if (configured()) await scannerInstance().verifyStartup(); }

async function claimFeedbackScanAsset(owner: string): Promise<ScanClaim | null> {
  const leaseToken = randomUUID();
  const result = await pool.query<{ id: number; scan_attempts: number; scan_fencing_token: string | number }>(`
    WITH candidate AS (
      SELECT id FROM feedback_assets
      WHERE scan_state='quarantined' AND scan_manual_review_at IS NULL
        AND (scan_next_attempt_at IS NULL OR scan_next_attempt_at<=now())
        AND (scan_lease_expires_at IS NULL OR scan_lease_expires_at<=now())
      ORDER BY COALESCE(scan_next_attempt_at,created_at),created_at,id
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE feedback_assets asset SET scan_attempts=asset.scan_attempts+1,scan_next_attempt_at=NULL,
      scan_lease_owner=$1,scan_lease_token=$2,scan_lease_expires_at=now()+($3::integer * interval '1 millisecond'),
      scan_fencing_token=asset.scan_fencing_token+1,scan_updated_at=now()
    FROM candidate WHERE asset.id=candidate.id
    RETURNING asset.id,asset.scan_attempts,asset.scan_fencing_token`, [owner, leaseToken, FEEDBACK_SCAN_LEASE_MS]);
  const row = result.rows[0];
  return row ? Object.freeze({ id: row.id, attempt: row.scan_attempts, leaseToken, fencingToken: Number(row.scan_fencing_token) }) : null;
}

function safeScannerErrorCode(error: unknown) {
  const candidate = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : error instanceof Error ? error.message : "";
  return /^FEEDBACK_[A-Z0-9_]+$/.test(candidate) ? candidate : "FEEDBACK_SCANNER_UNAVAILABLE";
}

async function settleFeedbackScanFailure(claim: ScanClaim, feedbackId: number, uploadedById: number, error: unknown) {
  const decision = feedbackScanFailureDecision(claim.attempt), errorCode = safeScannerErrorCode(error);
  const delayMs = decision.state === "retry-required" ? feedbackScanBackoffMs(claim.attempt) : null;
  return db.transaction(async tx => {
    const [updated] = await tx.update(feedbackAssetsTable).set({ scanNextAttemptAt: delayMs === null ? null : sql`now()+(${delayMs}::integer * interval '1 millisecond')`, scanLeaseOwner: null, scanLeaseToken: null,
      scanLeaseExpiresAt: null, scanLastErrorCode: errorCode, scanManualReviewAt: decision.state === "manual-review" ? sql`now()` : null, scanUpdatedAt: sql`now()`,
    }).where(and(eq(feedbackAssetsTable.id, claim.id), eq(feedbackAssetsTable.scanState, "quarantined"), eq(feedbackAssetsTable.scanLeaseToken, claim.leaseToken), eq(feedbackAssetsTable.scanFencingToken, claim.fencingToken))).returning({ id: feedbackAssetsTable.id, nextAttemptAt: feedbackAssetsTable.scanNextAttemptAt });
    if (!updated) return false;
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId, actorUserId: uploadedById, eventType: "evidence_scan_failed", afterState: {
      assetId: claim.id, state: decision.state, attempt: claim.attempt, nextAttemptAt: updated.nextAttemptAt?.toISOString() ?? null, errorCode, actorType: "worker",
    } });
    return true;
  });
}

export async function processFeedbackScanBatch(limit = DEFAULT_BATCH_SIZE): Promise<{ inspected: number; clean: number; infected: number; failed: number; manualReview: number }> {
  if (!configured()) return { inspected: 0, clean: 0, infected: 0, failed: 0, manualReview: 0 };
  let inspected = 0, clean = 0, infected = 0, failed = 0, manualReview = 0;
  for (let slot = 0; slot < boundedLimit(limit); slot += 1) {
    const claim = await claimFeedbackScanAsset(workerOwner); if (!claim) break;
    let feedbackId: number | undefined, uploadedById: number | undefined;
    try {
      const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, claim.id), eq(feedbackAssetsTable.scanState, "quarantined"), eq(feedbackAssetsTable.scanLeaseToken, claim.leaseToken), eq(feedbackAssetsTable.scanFencingToken, claim.fencingToken))).limit(1);
      if (!asset) continue;
      feedbackId = asset.feedbackId; uploadedById = asset.uploadedById; inspected += 1;
      await db.insert(feedbackAuditEventsTable).values({ feedbackId, actorUserId: uploadedById, eventType: "evidence_scan_started", afterState: { assetId: asset.id, sha256: asset.sha256, byteCount: asset.byteSize, scannerAdapter: "clamav-cli", state: "scanning", attempt: claim.attempt, fencingToken: claim.fencingToken, actorType: "worker" } });
      const bytes = await storage.downloadBounded(asset.storagePath, FEEDBACK_MAX_FILE_BYTES);
      const inspectedFile = inspectFeedbackEvidence({ originalname: asset.safeName, size: bytes.byteLength, buffer: bytes });
      if (bytes.byteLength !== asset.byteSize || inspectedFile.sha256 !== asset.sha256 || inspectedFile.mediaType !== asset.mediaType || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error("FEEDBACK_SCAN_SOURCE_MISMATCH");
      const receipt = await scannerInstance().scan(bytes, { sha256: asset.sha256, byteCount: asset.byteSize, mediaType: asset.mediaType });
      const nextState = receipt.verdict === "clean" ? "clean" : "rejected";
      const settled = await db.transaction(async tx => {
        const [updated] = await tx.update(feedbackAssetsTable).set({ scanState: nextState, scannerAdapter: receipt.scannerAdapter, scannedAt: new Date(receipt.inspectedAt), scanNextAttemptAt: null,
          scanLeaseOwner: null, scanLeaseToken: null, scanLeaseExpiresAt: null, scanLastErrorCode: null, scanManualReviewAt: null, scanUpdatedAt: new Date(receipt.inspectedAt),
        }).where(and(eq(feedbackAssetsTable.id, asset.id), eq(feedbackAssetsTable.scanState, "quarantined"), eq(feedbackAssetsTable.sha256, receipt.sha256), eq(feedbackAssetsTable.byteSize, receipt.byteCount), eq(feedbackAssetsTable.scanLeaseToken, claim.leaseToken), eq(feedbackAssetsTable.scanFencingToken, claim.fencingToken))).returning({ id: feedbackAssetsTable.id });
        if (!updated) return false;
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: asset.feedbackId, actorUserId: asset.uploadedById, eventType: nextState === "clean" ? "evidence_scan_clean" : "evidence_scan_rejected", afterState: { assetId: asset.id, state: nextState, scannerAdapter: receipt.scannerAdapter, scannerVersion: receipt.scannerVersion, scannerExecutableSha256: receipt.executableSha256, inspectedAt: receipt.inspectedAt, mediaType: receipt.mediaType, byteCount: receipt.byteCount, sha256: receipt.sha256, threatName: receipt.threatName, attempt: claim.attempt, fencingToken: claim.fencingToken, actorType: "worker" } });
        return true;
      });
      if (settled && nextState === "clean") clean += 1; else if (settled) infected += 1;
    } catch (error) {
      failed += 1;
      if (feedbackId !== undefined && uploadedById !== undefined) {
        const settled = await settleFeedbackScanFailure(claim, feedbackId, uploadedById, error).catch(() => false);
        if (settled && claim.attempt >= FEEDBACK_SCAN_MAX_ATTEMPTS) manualReview += 1;
      }
      // Before authoritative reload, an abandoned lease remains quarantined and is reclaimed only after expiry.
    }
  }
  return { inspected, clean, infected, failed, manualReview };
}

export async function feedbackScanBackfillProgress(): Promise<FeedbackScanBackfillProgress> {
  const result = await pool.query<{ quarantined: string; eligible: string; deferred: string; leased: string; manual_review: string; oldest_eligible_age_seconds: string | null }>(`
    SELECT count(*) FILTER (WHERE scan_state='quarantined')::text quarantined,
      count(*) FILTER (WHERE scan_state='quarantined' AND scan_manual_review_at IS NULL AND (scan_next_attempt_at IS NULL OR scan_next_attempt_at<=now()) AND (scan_lease_expires_at IS NULL OR scan_lease_expires_at<=now()))::text eligible,
      count(*) FILTER (WHERE scan_state='quarantined' AND scan_manual_review_at IS NULL AND scan_next_attempt_at>now())::text deferred,
      count(*) FILTER (WHERE scan_state='quarantined' AND scan_manual_review_at IS NULL AND scan_lease_expires_at>now())::text leased,
      count(*) FILTER (WHERE scan_state='quarantined' AND scan_manual_review_at IS NOT NULL)::text manual_review,
      extract(epoch FROM now()-min(created_at) FILTER (WHERE scan_state='quarantined' AND scan_manual_review_at IS NULL AND (scan_next_attempt_at IS NULL OR scan_next_attempt_at<=now()) AND (scan_lease_expires_at IS NULL OR scan_lease_expires_at<=now())))::text oldest_eligible_age_seconds
    FROM feedback_assets`);
  const row = result.rows[0];
  return Object.freeze({ quarantined: Number(row?.quarantined ?? 0), eligible: Number(row?.eligible ?? 0), deferred: Number(row?.deferred ?? 0), leased: Number(row?.leased ?? 0), manualReview: Number(row?.manual_review ?? 0), oldestEligibleAgeSeconds: row?.oldest_eligible_age_seconds == null ? null : Math.max(0, Number(row.oldest_eligible_age_seconds)) });
}

export function startFeedbackScanWorker(): void {
  if (!configured() || timer) return;
  const run = () => { if (running) return; running = true; void processFeedbackScanBatch().catch(error => console.error("[feedback] scan worker failed", error instanceof Error ? error.name : "unknown")).finally(() => { running = false; }); };
  run(); timer = setInterval(run, WORKER_INTERVAL_MS); timer.unref?.();
}
