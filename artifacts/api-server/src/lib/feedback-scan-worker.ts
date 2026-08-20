import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { feedbackAssetsTable, feedbackAuditEventsTable } from "../../../../lib/db/src/schema/feedback-items";
import { FEEDBACK_MAX_FILE_BYTES, inspectFeedbackEvidence } from "./feedback-evidence-contract";
import { createFeedbackScannerFromEnvironment, type GovernedFeedbackScanner } from "./feedback-scanner";
import { storage } from "./storage-adapter";

const WORKER_INTERVAL_MS = 30_000;
const BATCH_SIZE = 10;
let scanner: GovernedFeedbackScanner | undefined;
let timer: NodeJS.Timeout | undefined;
let running = false;

function configured() { return process.env.BIMLOG_FEEDBACK_SCANNER === "clamav-cli"; }
function scannerInstance() { if (!scanner) scanner = createFeedbackScannerFromEnvironment(process.env); return scanner; }

export async function verifyFeedbackScannerStartup(): Promise<void> {
  if (!configured()) return;
  await scannerInstance().verifyStartup();
}

export async function processFeedbackScanBatch(limit = BATCH_SIZE): Promise<{ inspected: number; clean: number; infected: number; failed: number }> {
  if (!configured()) return { inspected: 0, clean: 0, infected: 0, failed: 0 };
  const candidates = await db.select({ id: feedbackAssetsTable.id }).from(feedbackAssetsTable).where(eq(feedbackAssetsTable.scanState, "quarantined")).orderBy(feedbackAssetsTable.createdAt, feedbackAssetsTable.id).limit(limit);
  let inspected = 0, clean = 0, infected = 0, failed = 0;
  for (const candidate of candidates) {
    const client = await pool.connect(); let locked = false;
    try {
      const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtextextended($1,0)) locked", [`feedback-scan:${candidate.id}`]); locked = lock.rows[0]?.locked === true; if (!locked) continue;
      const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, candidate.id), eq(feedbackAssetsTable.scanState, "quarantined"))).limit(1); if (!asset) continue;
      inspected += 1;
      await db.insert(feedbackAuditEventsTable).values({ feedbackId: asset.feedbackId, actorUserId: asset.uploadedById, eventType: "evidence_scan_started", afterState: { assetId: asset.id, sha256: asset.sha256, byteCount: asset.byteSize, scannerAdapter: "clamav-cli", state: "scanning", actorType: "worker" } });
      const bytes = await storage.downloadBounded(asset.storagePath, FEEDBACK_MAX_FILE_BYTES);
      const inspectedFile = inspectFeedbackEvidence({ originalname: asset.safeName, size: bytes.byteLength, buffer: bytes });
      if (bytes.byteLength !== asset.byteSize || inspectedFile.sha256 !== asset.sha256 || inspectedFile.mediaType !== asset.mediaType || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error("FEEDBACK_SCAN_SOURCE_MISMATCH");
      const receipt = await scannerInstance().scan(bytes, { sha256: asset.sha256, byteCount: asset.byteSize, mediaType: asset.mediaType });
      const nextState = receipt.verdict === "clean" ? "clean" : "rejected";
      const settled = await db.transaction(async tx => {
        const [updated] = await tx.update(feedbackAssetsTable).set({ scanState: nextState, scannerAdapter: receipt.scannerAdapter, scannedAt: new Date(receipt.inspectedAt) }).where(and(eq(feedbackAssetsTable.id, asset.id), eq(feedbackAssetsTable.scanState, "quarantined"), eq(feedbackAssetsTable.sha256, receipt.sha256), eq(feedbackAssetsTable.byteSize, receipt.byteCount))).returning({ id: feedbackAssetsTable.id });
        if (!updated) return false;
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: asset.feedbackId, actorUserId: asset.uploadedById, eventType: nextState === "clean" ? "evidence_scan_clean" : "evidence_scan_rejected", afterState: { assetId: asset.id, state: nextState, scannerAdapter: receipt.scannerAdapter, scannerVersion: receipt.scannerVersion, scannerExecutableSha256: receipt.executableSha256, inspectedAt: receipt.inspectedAt, mediaType: receipt.mediaType, byteCount: receipt.byteCount, sha256: receipt.sha256, threatName: receipt.threatName, actorType: "worker" } });
        return true;
      });
      if (settled && nextState === "clean") clean += 1; else if (settled) infected += 1;
    } catch (error) {
      failed += 1;
      try { const [asset] = await db.select({ feedbackId: feedbackAssetsTable.feedbackId, uploadedById: feedbackAssetsTable.uploadedById }).from(feedbackAssetsTable).where(eq(feedbackAssetsTable.id, candidate.id)).limit(1); if (asset) await db.insert(feedbackAuditEventsTable).values({ feedbackId: asset.feedbackId, actorUserId: asset.uploadedById, eventType: "evidence_scan_failed", afterState: { assetId: candidate.id, state: "retry-required", errorCode: error instanceof Error && /^FEEDBACK_[A-Z0-9_]+$/.test(error.message) ? error.message : "FEEDBACK_SCANNER_UNAVAILABLE", actorType: "worker" } }); } catch { /* the evidence remains quarantined */ }
    } finally {
      if (locked) try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [`feedback-scan:${candidate.id}`]); } catch { /* session close also releases the lock */ }
      client.release();
    }
  }
  return { inspected, clean, infected, failed };
}

export function startFeedbackScanWorker(): void {
  if (!configured() || timer) return;
  const run = () => { if (running) return; running = true; void processFeedbackScanBatch().catch(error => console.error("[feedback] scan worker failed", error instanceof Error ? error.name : "unknown")).finally(() => { running = false; }); };
  run(); timer = setInterval(run, WORKER_INTERVAL_MS); timer.unref?.();
}
