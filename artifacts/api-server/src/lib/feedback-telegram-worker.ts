import { createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { storage } from "./storage-adapter";
import { FEEDBACK_RELEASE } from "./feedback-evidence-contract";
import { feedbackTelegramConfigurationDecision } from "./feedback-telegram-policy";
import { getTelegramProductConfig, sendVerifiedTelegramDocument } from "./telegram-product";

const EVENT = "feedback_telegram_delivery";
const DEFAULT_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | undefined, running = false;
type Snapshot = { feedback_id: number; stable_id: string; snapshot_event_id: number; after_state: Record<string, unknown>; submitter_user_id: number };
type Candidate = Snapshot & { recipient_user_id: number };
const artifactFields = {
  docx: { path: "docxStoragePath", bytes: "docxByteCount", hash: "docxSha256", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { path: "workbookStoragePath", bytes: "workbookByteCount", hash: "workbookSha256", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;
type ArtifactKind = keyof typeof artifactFields;
async function recordSkipped(snapshot: Snapshot, artifactKind: ArtifactKind, reasonCode: "provider-not-configured" | "no-opted-in-reviewer") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`feedback-telegram:${snapshot.snapshot_event_id}:none:${artifactKind}`]);
    const prior = await client.query(`SELECT 1 FROM feedback_audit_events WHERE feedback_id=$1 AND event_type=$2 AND (after_state->>'snapshotEventId')::integer=$3 AND after_state->>'artifactKind'=$4 AND after_state->>'recipientUserId' IS NULL LIMIT 1`, [snapshot.feedback_id, EVENT, snapshot.snapshot_event_id, artifactKind]);
    if (!prior.rowCount) await client.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,$4::jsonb,$5)`, [snapshot.feedback_id, snapshot.submitter_user_id, EVENT, JSON.stringify({ snapshotEventId: snapshot.snapshot_event_id, recipientUserId: null, artifactKind, state: "skipped", reasonCode, release: FEEDBACK_RELEASE }), "Telegram document delivery skipped by governed configuration"]);
    await client.query("COMMIT"); return !prior.rowCount;
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; } finally { client.release(); }
}
async function reserve(candidate: Candidate, artifactKind: ArtifactKind, attemptId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`feedback-telegram:${candidate.snapshot_event_id}:${candidate.recipient_user_id}:${artifactKind}`]);
    const prior = await client.query(`SELECT 1 FROM feedback_audit_events WHERE feedback_id=$1 AND event_type=$2 AND (after_state->>'snapshotEventId')::integer=$3 AND (after_state->>'recipientUserId')::integer=$4 AND after_state->>'artifactKind'=$5 LIMIT 1`, [candidate.feedback_id, EVENT, candidate.snapshot_event_id, candidate.recipient_user_id, artifactKind]);
    if (prior.rowCount) { await client.query("ROLLBACK"); return false; }
    await client.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,$4::jsonb,$5)`, [candidate.feedback_id, candidate.recipient_user_id, EVENT, JSON.stringify({ snapshotEventId: candidate.snapshot_event_id, recipientUserId: candidate.recipient_user_id, artifactKind, attemptId, state: "sending", release: FEEDBACK_RELEASE }), "Automatic opted-in super-admin feedback package delivery"]);
    await client.query("COMMIT"); return true;
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; } finally { client.release(); }
}
async function settle(candidate: Candidate, artifactKind: ArtifactKind, attemptId: string, state: "sent" | "failed", providerAcknowledgementId?: string, reasonCode?: string) {
  await pool.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,$4::jsonb,$5)`, [candidate.feedback_id, candidate.recipient_user_id, EVENT, JSON.stringify({ snapshotEventId: candidate.snapshot_event_id, recipientUserId: candidate.recipient_user_id, artifactKind, attemptId, state, providerAcknowledgementId: providerAcknowledgementId || null, reasonCode: reasonCode || null, release: FEEDBACK_RELEASE }), state === "sent" ? "Telegram acknowledged feedback document" : "Telegram feedback document failed without exposing provider details"]);
}

export async function reconcileFeedbackTelegramDeliveriesOnce(limit = 10) {
  const snapshots = await pool.query<Snapshot>(`SELECT DISTINCT ON (s.feedback_id) s.feedback_id,f.stable_id,s.id snapshot_event_id,s.after_state,f.user_id submitter_user_id FROM feedback_audit_events s JOIN feedback_items f ON f.id=s.feedback_id WHERE s.event_type='package_snapshot_created' AND s.after_state->>'visibility'='internal' AND s.after_state->>'docxStoragePath' IS NOT NULL AND s.after_state->>'workbookStoragePath' IS NOT NULL ORDER BY s.feedback_id,s.id DESC LIMIT $1`, [limit]);
  const config = getTelegramProductConfig();
  if (!config.configured) { const decision=feedbackTelegramConfigurationDecision(false,0); if(decision!=="provider-not-configured") throw new Error("invalid-telegram-policy"); let skipped=0; for(const snapshot of snapshots.rows) for(const kind of Object.keys(artifactFields) as ArtifactKind[]) if(await recordSkipped(snapshot,kind,decision)) skipped++; return { configured:false,inspected:snapshots.rowCount||0,sent:0,failed:0,skipped }; }
  const rows = await pool.query<Candidate>(`SELECT s.feedback_id,s.stable_id,s.snapshot_event_id,s.after_state,s.submitter_user_id,u.id recipient_user_id FROM jsonb_to_recordset($1::jsonb) AS s(feedback_id integer,stable_id text,snapshot_event_id integer,after_state jsonb,submitter_user_id integer) CROSS JOIN users u JOIN notification_channels c ON c.user_id=u.id AND c.adapter_id=$2 AND c.provider='telegram' AND c.status='connected' WHERE u.is_super_admin=true`, [JSON.stringify(snapshots.rows), config.adapterId]);
  const represented = new Set(rows.rows.map(row=>row.snapshot_event_id)); let skipped=0;
  for(const snapshot of snapshots.rows) if(!represented.has(snapshot.snapshot_event_id) && feedbackTelegramConfigurationDecision(true,0)==="no-opted-in-reviewer") for(const kind of Object.keys(artifactFields) as ArtifactKind[]) if(await recordSkipped(snapshot,kind,"no-opted-in-reviewer")) skipped++;
  let sent = 0, failed = 0;
  for (const candidate of rows.rows) for (const artifactKind of Object.keys(artifactFields) as ArtifactKind[]) {
    const fields = artifactFields[artifactKind], key = String(candidate.after_state[fields.path] || ""), byteCount = Number(candidate.after_state[fields.bytes]), expectedHash = String(candidate.after_state[fields.hash] || ""), attemptId = randomUUID();
    if (!await reserve(candidate, artifactKind, attemptId)) continue;
    if (!key || !Number.isSafeInteger(byteCount) || byteCount <= 0 || !/^[a-f0-9]{64}$/.test(expectedHash)) { await settle(candidate,artifactKind,attemptId,"failed",undefined,"invalid-artifact-authority"); failed++; continue; }
    try {
      const bytes = await storage.downloadBounded(key, byteCount); if (bytes.byteLength !== byteCount || createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("artifact-integrity-failed");
      const acknowledgement = await sendVerifiedTelegramDocument(candidate.recipient_user_id, { bytes, fileName: `${candidate.stable_id}-${artifactKind === "docx" ? "feedback.docx" : "follow-up.xlsx"}`, contentType: fields.contentType, caption: `BIMLog feedback ${candidate.stable_id} · ${artifactKind === "docx" ? "human report" : "follow-up workbook"}` });
      await settle(candidate, artifactKind, attemptId, "sent", acknowledgement); sent += 1;
    } catch (error) { await settle(candidate, artifactKind, attemptId, "failed", undefined, error instanceof Error ? error.name.slice(0,80) : "unknown-error"); failed += 1; }
  }
  return { configured:true,inspected:snapshots.rowCount||0,sent,failed,skipped };
}
export function startFeedbackTelegramDeliveryWorker(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return; const run = () => { if (running) return; running = true; void reconcileFeedbackTelegramDeliveriesOnce().catch(error => console.error("[feedback] Telegram document delivery deferred", error instanceof Error ? error.name : "unknown")).finally(() => { running = false; }); };
  run(); timer = setInterval(run, intervalMs); timer.unref?.();
}
