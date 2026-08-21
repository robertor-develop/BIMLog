import { createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { storage } from "./storage-adapter";
import { getTelegramProductConfig, sendVerifiedTelegramDocument, TelegramProductError } from "./telegram-product";

const EVENT = "feedback_telegram_delivery";
const DEFAULT_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | undefined, running = false;

type Candidate = { feedback_id: number; stable_id: string; snapshot_event_id: number; after_state: Record<string, unknown>; recipient_user_id: number };
const artifactFields = {
  docx: { path: "docxStoragePath", bytes: "docxByteCount", hash: "docxSha256", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { path: "workbookStoragePath", bytes: "workbookByteCount", hash: "workbookSha256", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;

async function reserve(candidate: Candidate, artifactKind: keyof typeof artifactFields, attemptId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`feedback-telegram:${candidate.snapshot_event_id}:${candidate.recipient_user_id}:${artifactKind}`]);
    const prior = await client.query(`SELECT after_state->>'state' state FROM feedback_audit_events WHERE feedback_id=$1 AND event_type=$2 AND (after_state->>'snapshotEventId')::integer=$3 AND (after_state->>'recipientUserId')::integer=$4 AND after_state->>'artifactKind'=$5 ORDER BY id DESC LIMIT 1`, [candidate.feedback_id, EVENT, candidate.snapshot_event_id, candidate.recipient_user_id, artifactKind]);
    if (prior.rowCount) { await client.query("ROLLBACK"); return false; }
    await client.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,$4::jsonb,$5)`, [candidate.feedback_id, candidate.recipient_user_id, EVENT, JSON.stringify({ snapshotEventId: candidate.snapshot_event_id, recipientUserId: candidate.recipient_user_id, artifactKind, attemptId, state: "sending" }), "Automatic super-admin feedback package delivery"]);
    await client.query("COMMIT"); return true;
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; }
  finally { client.release(); }
}

async function settle(candidate: Candidate, artifactKind: keyof typeof artifactFields, attemptId: string, state: "delivered" | "failed" | "unknown", providerAcknowledgementId?: string) {
  await pool.query(`INSERT INTO feedback_audit_events(feedback_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,$4::jsonb,$5)`, [candidate.feedback_id, candidate.recipient_user_id, EVENT, JSON.stringify({ snapshotEventId: candidate.snapshot_event_id, recipientUserId: candidate.recipient_user_id, artifactKind, attemptId, state, providerAcknowledgementId: providerAcknowledgementId || null }), state === "delivered" ? "Telegram acknowledged feedback document" : "Telegram feedback document requires review"]);
}

export async function reconcileFeedbackTelegramDeliveriesOnce(limit = 10) {
  const config = getTelegramProductConfig(); if (!config.configured) return { configured: false, inspected: 0, delivered: 0, failed: 0 };
  const rows = await pool.query<Candidate>(`SELECT DISTINCT ON (s.feedback_id,u.id) s.feedback_id,f.stable_id,s.id snapshot_event_id,s.after_state,u.id recipient_user_id
    FROM feedback_audit_events s JOIN feedback_items f ON f.id=s.feedback_id CROSS JOIN users u JOIN notification_channels c ON c.user_id=u.id AND c.adapter_id=$1 AND c.provider='telegram' AND c.status='connected'
    WHERE s.event_type='package_snapshot_created' AND s.after_state->>'visibility'='internal' AND s.after_state->>'docxStoragePath' IS NOT NULL AND s.after_state->>'workbookStoragePath' IS NOT NULL AND u.is_super_admin=true
    ORDER BY s.feedback_id,u.id,s.id DESC LIMIT $2`, [config.adapterId, limit]);
  let delivered = 0, failed = 0;
  for (const candidate of rows.rows) for (const artifactKind of Object.keys(artifactFields) as Array<keyof typeof artifactFields>) {
    const fields = artifactFields[artifactKind], key = String(candidate.after_state[fields.path] || ""), byteCount = Number(candidate.after_state[fields.bytes]), expectedHash = String(candidate.after_state[fields.hash] || ""), attemptId = randomUUID();
    if (!key || !Number.isSafeInteger(byteCount) || byteCount <= 0 || !/^[a-f0-9]{64}$/.test(expectedHash)) continue;
    if (!await reserve(candidate, artifactKind, attemptId)) continue;
    try {
      const bytes = await storage.downloadBounded(key, byteCount); if (bytes.byteLength !== byteCount || createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("FEEDBACK_TELEGRAM_ARTIFACT_INTEGRITY_FAILED");
      const acknowledgement = await sendVerifiedTelegramDocument(candidate.recipient_user_id, { bytes, fileName: `${candidate.stable_id}-${artifactKind === "docx" ? "feedback.docx" : "follow-up.xlsx"}`, contentType: fields.contentType, caption: `BIMLog feedback ${candidate.stable_id} · ${artifactKind === "docx" ? "human report" : "follow-up workbook"}` });
      await settle(candidate, artifactKind, attemptId, "delivered", acknowledgement); delivered += 1;
    } catch (error) { const known = error instanceof TelegramProductError && !["AbortError", "TimeoutError"].includes(error.name); await settle(candidate, artifactKind, attemptId, known ? "failed" : "unknown"); failed += 1; }
  }
  return { configured: true, inspected: rows.rowCount || 0, delivered, failed };
}

export function startFeedbackTelegramDeliveryWorker(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return; const run = () => { if (running) return; running = true; void reconcileFeedbackTelegramDeliveriesOnce().catch(error => console.error("[feedback] Telegram document delivery deferred", error instanceof Error ? error.name : "unknown")).finally(() => { running = false; }); };
  run(); timer = setInterval(run, intervalMs); timer.unref?.();
}
