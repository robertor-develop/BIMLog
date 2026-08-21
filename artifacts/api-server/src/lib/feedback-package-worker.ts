import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { feedbackAuditEventsTable, feedbackItemsTable } from "../../../../lib/db/src/schema/feedback-items";
import { FEEDBACK_RELEASE } from "./feedback-evidence-contract";
import { buildFeedbackPackageFromAuthority } from "./feedback-package-source";
import { storage } from "./storage-adapter";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 10;
const SNAPSHOT_EVENT = "package_snapshot_created";
let timer: NodeJS.Timeout | undefined;
let running = false;

type Candidate = { id: number; user_id: number; project_id: number | null; source_event_id: number };
const publicBaseUrl = () => {
  try { const url = new URL(process.env.BIMLOG_PUBLIC_URL || "https://app.bimlog.com"); if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("HTTPS required"); return url.origin; }
  catch { return "https://app.bimlog.com"; }
};

function packageState(manifest: Buffer) {
  const parsed = JSON.parse(manifest.toString("utf8")) as { evidence?: Array<{ included?: boolean; scanState?: string }> };
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  if (!evidence.length) return "metadata-only";
  if (evidence.some(item => item.scanState === "rejected")) return "rejected-evidence";
  return evidence.every(item => item.included === true) ? "ready" : "awaiting-scan";
}

async function latestSnapshot(feedbackId: number, visibility: "customer" | "internal") {
  const [event] = await db.select({ afterState: feedbackAuditEventsTable.afterState }).from(feedbackAuditEventsTable)
    .where(and(eq(feedbackAuditEventsTable.feedbackId, feedbackId), eq(feedbackAuditEventsTable.eventType, SNAPSHOT_EVENT), sql`${feedbackAuditEventsTable.afterState}->>'visibility'=${visibility}`))
    .orderBy(desc(feedbackAuditEventsTable.id)).limit(1);
  return event?.afterState as Record<string, unknown> | undefined;
}

async function snapshotOne(candidate: Candidate, visibility: "customer" | "internal") {
  const prior = await latestSnapshot(candidate.id, visibility);
  if (Number(prior?.sourceEventId) === candidate.source_event_id && typeof prior?.docxStoragePath === "string" && typeof prior?.workbookStoragePath === "string") return false;
  const generated = await buildFeedbackPackageFromAuthority({ feedbackId: candidate.id, visibility, baseUrl: publicBaseUrl() });
  if (!generated) return false;
  const manifestPath = await storage.upload(generated.manifest, candidate.project_id ?? `feedback-${candidate.id}`, `feedback-${candidate.id}-${visibility}.json`);
  let pdfPath: string | undefined, docxPath: string | undefined, workbookPath: string | undefined;
  try {
    pdfPath = await storage.upload(generated.pdf, candidate.project_id ?? `feedback-${candidate.id}`, `feedback-${candidate.id}-${visibility}.pdf`);
    docxPath = await storage.upload(generated.docx, candidate.project_id ?? `feedback-${candidate.id}`, `feedback-${candidate.id}-${visibility}.docx`);
    workbookPath = await storage.upload(generated.workbook, candidate.project_id ?? `feedback-${candidate.id}`, `feedback-${candidate.id}-${visibility}.xlsx`);
    const inserted = await db.transaction(async tx => {
      const latest = await tx.execute(sql`SELECT max(id)::integer source_event_id FROM feedback_audit_events WHERE feedback_id=${candidate.id} AND event_type NOT IN ('package_snapshot_created','feedback_telegram_delivery','admin_package_exported','admin_package_snapshot_exported','admin_exported','admin_follow_up_exported','admin_asset_exported')`);
      if (Number(latest.rows[0]?.source_event_id) !== candidate.source_event_id) return false;
      const [winner] = await tx.select({ id: feedbackAuditEventsTable.id }).from(feedbackAuditEventsTable)
        .where(and(eq(feedbackAuditEventsTable.feedbackId, candidate.id), eq(feedbackAuditEventsTable.eventType, SNAPSHOT_EVENT), sql`${feedbackAuditEventsTable.afterState}->>'visibility'=${visibility}`, sql`${feedbackAuditEventsTable.afterState}->>'sourceEventId'=${String(candidate.source_event_id)}`, sql`${feedbackAuditEventsTable.afterState}->>'docxStoragePath' IS NOT NULL`, sql`${feedbackAuditEventsTable.afterState}->>'workbookStoragePath' IS NOT NULL`)).limit(1);
      if (winner) return false;
      await tx.insert(feedbackAuditEventsTable).values({ feedbackId: candidate.id, actorUserId: candidate.user_id, eventType: SNAPSHOT_EVENT, afterState: {
        schema: "bimlog.feedback-package-snapshot.v1", release: FEEDBACK_RELEASE, visibility, sourceEventId: candidate.source_event_id,
        state: packageState(generated.manifest), manifestStoragePath: manifestPath, manifestByteCount: generated.manifest.byteLength, manifestSha256: generated.manifestSha256,
        pdfStoragePath: pdfPath, pdfByteCount: generated.pdf.byteLength, pdfSha256: createHash("sha256").update(generated.pdf).digest("hex"),
        docxStoragePath: docxPath, docxByteCount: generated.docx.byteLength, docxSha256: createHash("sha256").update(generated.docx).digest("hex"),
        workbookStoragePath: workbookPath, workbookByteCount: generated.workbook.byteLength, workbookSha256: createHash("sha256").update(generated.workbook).digest("hex"),
        archiveSha256: generated.archiveSha256, archiveGeneratedOnDemand: true,
      } });
      return true;
    });
    if (!inserted) { await storage.delete(manifestPath); await storage.delete(pdfPath); await storage.delete(docxPath); await storage.delete(workbookPath); }
    return inserted;
  } catch (error) {
    try { await storage.delete(manifestPath); } catch {}
    if (pdfPath) try { await storage.delete(pdfPath); } catch {}
    if (docxPath) try { await storage.delete(docxPath); } catch {}
    if (workbookPath) try { await storage.delete(workbookPath); } catch {}
    throw error;
  }
}

export async function reconcileFeedbackPackageSnapshotsOnce(limit = DEFAULT_BATCH_SIZE) {
  const result = await db.execute(sql`SELECT f.id,f.user_id,f.project_id,source.source_event_id
    FROM feedback_items f
    JOIN LATERAL (SELECT max(e.id)::integer source_event_id FROM feedback_audit_events e WHERE e.feedback_id=f.id AND e.event_type NOT IN ('package_snapshot_created','feedback_telegram_delivery','admin_package_exported','admin_package_snapshot_exported','admin_exported','admin_follow_up_exported','admin_asset_exported')) source ON source.source_event_id IS NOT NULL
    WHERE NOT EXISTS (SELECT 1 FROM feedback_audit_events s WHERE s.feedback_id=f.id AND s.event_type='package_snapshot_created' AND (s.after_state->>'sourceEventId')::integer=source.source_event_id AND s.after_state->>'visibility'='customer' AND s.after_state->>'docxStoragePath' IS NOT NULL AND s.after_state->>'workbookStoragePath' IS NOT NULL)
       OR NOT EXISTS (SELECT 1 FROM feedback_audit_events s WHERE s.feedback_id=f.id AND s.event_type='package_snapshot_created' AND (s.after_state->>'sourceEventId')::integer=source.source_event_id AND s.after_state->>'visibility'='internal' AND s.after_state->>'docxStoragePath' IS NOT NULL AND s.after_state->>'workbookStoragePath' IS NOT NULL)
    ORDER BY f.updated_at,f.id LIMIT ${limit}`);
  let generated = 0, failed = 0;
  for (const candidate of result.rows as Candidate[]) {
    const client = await pool.connect(); let locked = false;
    try {
      const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtextextended($1,0)) locked", [`feedback-package:${candidate.id}`]);
      locked = lock.rows[0]?.locked === true; if (!locked) continue;
      if (await snapshotOne(candidate, "customer")) generated += 1;
      if (await snapshotOne(candidate, "internal")) generated += 1;
    } catch (error) {
      failed += 1;
      console.error("[feedback] package snapshot deferred", error instanceof Error ? error.name : "unknown");
    } finally {
      if (locked) try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [`feedback-package:${candidate.id}`]); } catch {}
      client.release();
    }
  }
  return { inspected: result.rows.length, generated, failed };
}

export function startFeedbackPackageSnapshotWorker(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  const run = () => { if (running) return; running = true; void reconcileFeedbackPackageSnapshotsOnce().catch(error => console.error("[feedback] package snapshot worker failed", error instanceof Error ? error.name : "unknown")).finally(() => { running = false; }); };
  run(); timer = setInterval(run, intervalMs); timer.unref?.();
}
