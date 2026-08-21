import { createHash, randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable, projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { feedbackAssetsTable, feedbackAuditEventsTable, feedbackCaptureConsentsTable, feedbackItemsTable, feedbackRelayCustodyEventsTable, feedbackRelayJobsTable, feedbackTranscriptionJobsTable } from "../../../../lib/db/src/schema/feedback-items";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { boundedMultipart, createMemoryUpload } from "../middlewares/multipart";
import { storage } from "../lib/storage-adapter";
import { FEEDBACK_MAX_FILE_BYTES, FEEDBACK_RELEASE, inspectFeedbackEvidence } from "../lib/feedback-evidence-contract";
import { FeedbackPackageError, FEEDBACK_PACKAGE_MAX_EVENTS } from "../lib/feedback-package";
import { buildFeedbackPackageFromAuthority } from "../lib/feedback-package-source";
import { feedbackEmailCopyEnabled, feedbackEmailCopyHtml, FEEDBACK_CUSTOMER_EVENT_TYPES, FEEDBACK_STAFF_RESPONSE_TYPES } from "../lib/feedback-follow-up";
import { buildFeedbackFollowUpCsv, buildFeedbackFollowUpWorkbook, type FeedbackFollowUpRecord } from "../lib/feedback-follow-up-register";
import { aggregateFeedbackTelegramDelivery, type FeedbackTelegramEvent } from "../lib/feedback-telegram-policy";
import { reviewerScanFailureProjection } from "../lib/feedback-reviewer-projection";
import { sendEmail } from "../lib/email";
import { getTelegramProductConfig, telegramProductHealth } from "../lib/telegram-product";
import { eligibleFeedbackTelegramRecipientIds } from "../lib/feedback-telegram-worker";
import { feedbackScanBackfillProgress } from "../lib/feedback-scan-worker";

const router = Router();
const upload = boundedMultipart(createMemoryUpload({ fileSize: FEEDBACK_MAX_FILE_BYTES, files: 1, fields: 6, parts: 7 }).array("files", 1));
const TYPES = new Set(["bug", "workflow", "idea", "question", "other"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["new", "triaged", "accepted", "in_progress", "blocked", "fixed", "verified", "rejected", "deferred"]);
const TERMINAL = new Set(["verified", "rejected", "deferred"]);
const CAPTURE_NOTICE_VERSION = "feedback-capture-v1";
const ORIGINS_BY_KIND: Record<string, Set<string>> = {
  audio: new Set(["browser-microphone", "user-file-import"]),
  screenshot: new Set(["browser-display-capture", "user-file-import"]),
  attachment: new Set(["user-file-import"]),
};
const localFixture = (value: string | undefined, expected: string) => process.env.NODE_ENV !== "production" && process.env.BIMLOG_FEEDBACK_ALLOW_LOCAL_FIXTURES === "true" && value === expected;
const TRANSITIONS: Record<string, Set<string>> = {
  new: new Set(["triaged", "rejected"]), triaged: new Set(["accepted", "deferred", "rejected"]),
  accepted: new Set(["in_progress", "blocked", "deferred"]), in_progress: new Set(["blocked", "fixed"]),
  blocked: new Set(["in_progress", "deferred"]), fixed: new Set(["verified", "in_progress"]),
  verified: new Set(["triaged"]), rejected: new Set(["triaged"]), deferred: new Set(["triaged"]),
};

const asId = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
const bounded = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const csvCell = (value: unknown) => { const normalized = String(value ?? "").replace(/[\r\n]+/g, " "); const neutral = /^[\s]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized; return `"${neutral.replace(/"/g, '""')}"`; };
const publicBaseUrl = () => { try { const url = new URL(process.env.BIMLOG_PUBLIC_URL || process.env.BIMLOG_URL || process.env.APP_URL || "https://bimlog.app"); if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("HTTPS required"); return url.origin; } catch { return "https://bimlog.app"; } };
const packageSnapshotDto = (state: Record<string, unknown> | undefined) => state ? ({
  state: String(state.state || "unavailable"), sourceEventId: Number(state.sourceEventId) || null, release: String(state.release || FEEDBACK_RELEASE),
  generatedAt: typeof state.generatedAt === "string" ? state.generatedAt : null,
  pdfSha256: typeof state.pdfSha256 === "string" ? state.pdfSha256 : null,
  docxSha256: typeof state.docxSha256 === "string" ? state.docxSha256 : null,
  workbookSha256: typeof state.workbookSha256 === "string" ? state.workbookSha256 : null,
  manifestSha256: typeof state.manifestSha256 === "string" ? state.manifestSha256 : null,
}) : null;
async function latestPackageSnapshot(id: number, visibility: "customer" | "internal") {
  const [event] = await db.select({ afterState: feedbackAuditEventsTable.afterState, createdAt: feedbackAuditEventsTable.createdAt }).from(feedbackAuditEventsTable)
    .where(and(eq(feedbackAuditEventsTable.feedbackId, id), eq(feedbackAuditEventsTable.eventType, "package_snapshot_created"), sql`${feedbackAuditEventsTable.afterState}->>'visibility'=${visibility}`)).orderBy(desc(feedbackAuditEventsTable.id)).limit(1);
  if (!event) return undefined;
  return { ...(event.afterState as Record<string, unknown>), generatedAt: event.createdAt.toISOString() } as Record<string, unknown>;
}
async function loadFeedbackFollowUpRows(): Promise<FeedbackFollowUpRecord[]> {
  const telegramConfig=getTelegramProductConfig(),adapterId=telegramConfig.configured?telegramConfig.adapterId:"__feedback_telegram_unconfigured__";
  const result = await db.execute(sql`SELECT f.id, f.stable_id, f.status, f.priority, f.feedback_type, f.module, f.target_release, f.disposition_reason, f.owner_user_id, f.customer_visible, f.created_at, f.updated_at, f.resolved_at, u.full_name submitter_name, u.email submitter_email, p.code project_code, p.name project_name,
    COALESCE(a.total,0)::integer evidence_total, COALESCE(a.clean,0)::integer evidence_clean, COALESCE(a.quarantined,0)::integer evidence_quarantined, COALESCE(a.rejected,0)::integer evidence_rejected,
    COALESCE(pkg.after_state->>'state','not-generated') package_state, pkg.id package_snapshot_event_id, CASE WHEN alert.event_type='submission_notification_delivery_failed' THEN 'retry-required' ELSE COALESCE(alert.after_state->>'state','pending') END reviewer_alert_state,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',te.id,'afterState',te.after_state) ORDER BY te.id) FROM feedback_audit_events te WHERE te.feedback_id=f.id AND te.event_type='feedback_telegram_delivery' AND te.after_state->>'snapshotEventId' ~ '^[0-9]+$' AND (te.after_state->>'snapshotEventId')::integer=pkg.id),'[]'::jsonb) telegram_events,
    ARRAY(SELECT DISTINCT nc.user_id FROM notification_channels nc JOIN users ru ON ru.id=nc.user_id JOIN notification_preferences np ON np.user_id=ru.id AND np.adapter_id=nc.adapter_id AND np.channel='telegram' AND np.enabled='true' AND np.paused=false AND np.telegram_enabled=true JOIN telegram_notification_module_preferences mp ON mp.user_id=ru.id AND mp.module_key='feedback' AND mp.enabled=true JOIN LATERAL (SELECT consent_version,status FROM consent_records cr WHERE cr.user_id=ru.id AND cr.adapter_id=nc.adapter_id AND cr.channel='telegram' ORDER BY cr.created_at DESC,cr.id DESC LIMIT 1) consent ON consent.status='granted' AND consent.consent_version=${telegramConfig.configured?telegramConfig.consentVersion:"__unconfigured__"} WHERE nc.adapter_id=${adapterId} AND nc.provider='telegram' AND nc.status='connected' AND ru.is_super_admin=true ORDER BY nc.user_id) telegram_recipient_ids,
    e.event_type last_event_type, e.created_at last_event_at
    FROM feedback_items f JOIN users u ON u.id=f.user_id LEFT JOIN projects p ON p.id=f.project_id
    LEFT JOIN LATERAL (SELECT count(*) total,count(*) FILTER(WHERE scan_state='clean') clean,count(*) FILTER(WHERE scan_state NOT IN ('clean','rejected')) quarantined,count(*) FILTER(WHERE scan_state='rejected') rejected FROM feedback_assets WHERE feedback_id=f.id) a ON true
    LEFT JOIN LATERAL (SELECT id,after_state FROM feedback_audit_events WHERE feedback_id=f.id AND event_type='package_snapshot_created' AND after_state->>'visibility'='internal' ORDER BY id DESC LIMIT 1) pkg ON true
    LEFT JOIN LATERAL (SELECT event_type,after_state FROM feedback_audit_events WHERE feedback_id=f.id AND event_type IN ('submission_notification_outbox_settled','submission_notification_delivery_failed') ORDER BY id DESC LIMIT 1) alert ON true
    LEFT JOIN LATERAL (SELECT event_type,created_at FROM feedback_audit_events WHERE feedback_id=f.id ORDER BY created_at DESC,id DESC LIMIT 1) e ON true
    ORDER BY CASE f.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,f.updated_at ASC LIMIT 5000`);
  return (result.rows as FeedbackFollowUpRecord[]).map(row=>{const delivery=aggregateFeedbackTelegramDelivery(Number(row.package_snapshot_event_id)||null,normalizeRecipientIds(row.telegram_recipient_ids),normalizeTelegramEvents(row.telegram_events));return {...row,telegram_delivery_state:delivery.overallState,telegram_delivery_outcomes:delivery.outcomes};});
}
function normalizeRecipientIds(value:unknown){return Array.isArray(value)?value.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0):[];}
function normalizeTelegramEvents(value:unknown):FeedbackTelegramEvent[]{if(!Array.isArray(value))return [];return value.flatMap(item=>{if(!item||typeof item!=="object")return [];const row=item as Record<string,unknown>,state=row.afterState;if(!state||typeof state!=="object"||Array.isArray(state))return [];const after=state as Record<string,unknown>;return [{id:Number(row.id)||0,snapshotEventId:Number(after.snapshotEventId)||0,recipientUserId:after.recipientUserId===null?null:Number(after.recipientUserId)||null,artifactKind:String(after.artifactKind||""),state:String(after.state||""),reasonCode:typeof after.reasonCode==="string"?after.reasonCode:null}];});}
const sanitizedPageUrl = (value: unknown) => {
  try { const url = new URL(bounded(value, 2048), "http://bimlog.local"); return url.pathname.slice(0, 2048) || "/"; }
  catch { return ""; }
};
type CustomerFeedbackRow = Pick<typeof feedbackItemsTable.$inferSelect, "id" | "stableId" | "projectId" | "feedbackType" | "priority" | "module" | "pageUrl" | "message" | "status" | "version" | "targetRelease" | "createdAt" | "updatedAt" | "resolvedAt">;
const customerFeedbackDto = (row: CustomerFeedbackRow) => ({
  id: row.id, stableId: row.stableId, projectId: row.projectId, feedbackType: row.feedbackType, priority: row.priority,
  module: row.module, pageUrl: sanitizedPageUrl(row.pageUrl), message: row.message, status: row.status, version: row.version,
  targetRelease: row.targetRelease, createdAt: row.createdAt,
  updatedAt: row.updatedAt, resolvedAt: row.resolvedAt,
});
const customerEventState = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const allowed = ["status", "version", "count", "scanState", "reviewState", "responseType", "visibility", "receiptId", "release"];
  return Object.fromEntries(allowed.filter(key => key in source).map(key => [key, source[key]]));
};
const CUSTOMER_EVENT_TYPES = new Set(["created", "assets_added", "transcription_requested", "transcription_reviewed", "triage_updated", "reopened", ...FEEDBACK_CUSTOMER_EVENT_TYPES]);
const customerTranscriptionReason = (row: typeof feedbackTranscriptionJobsTable.$inferSelect) => row.state === "blocked" && row.errorCode === "EXTERNAL_TRANSCRIPTION_NOT_ACTIVATED" ? "provider-unavailable" : null;
const transcriptionDto = (row: typeof feedbackTranscriptionJobsTable.$inferSelect) => ({ id: row.id, assetId: row.assetId, state: row.state, result: row.result, reason: customerTranscriptionReason(row), reviewState: row.reviewState, createdAt: row.createdAt, completedAt: row.completedAt });
const customerRelayReason = (state: string) => ({ queued: "awaiting-delivery", transferring: "delivery-in-progress", delivered: "delivery-received", "receipt-verified": "delivery-confirmed", "cleanup-pending": "cleanup-in-progress", "manual-review": "support-review", held: "on-hold", expired: "retention-ended" } as Record<string,string>)[state] ?? null;
function boundedTransformation(value: unknown) { try { const source = typeof value === "string" ? JSON.parse(bounded(value, 2000)) as Record<string, unknown> : value as Record<string, unknown>; if (!source || typeof source !== "object" || Array.isArray(source)) return null; const allowed = ["sourceName", "sourceSha256", "originalWidth", "originalHeight", "capturedAt", "cropPercent", "cropPixels", "outputWidth", "outputHeight", "transformedAt"]; return Object.fromEntries(allowed.filter(key => key in source).map(key => [key, source[key]])); } catch { return null; } }
async function projectAuthorized(projectId: number | null, user: NonNullable<Express.Request["user"]>, companyId: number, reader: Pick<typeof db, "select"> = db) {
  if (!projectId) return true;
  const [project] = await reader.select({ id: projectsTable.id, companyId: usersTable.companyId }).from(projectsTable)
    .innerJoin(usersTable, eq(projectsTable.createdById, usersTable.id)).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.companyId !== companyId) return false;
  const [member] = await reader.select({ id: projectMembersTable.id }).from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.userId), eq(projectMembersTable.status, "active"))).limit(1);
  return !!member;
}
async function accessible(id: number, user: NonNullable<Express.Request["user"]>, reader: Pick<typeof db, "select"> = db) {
  const [row] = await reader.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id, id)).limit(1);
  if (!row) return null;
  const [actor] = await reader.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
  if (!actor || !row.companyId || actor.companyId !== row.companyId || row.userId !== user.userId || !row.customerVisible) return null;
  if (row.projectId && !await projectAuthorized(row.projectId, user, actor.companyId, reader)) return null;
  return row;
}

router.post("/feedback", authMiddleware, async (req, res) => {
  try {
    const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
    const feedbackType = bounded(req.body.feedbackType, 32), priority = bounded(req.body.priority || "normal", 16);
    const message = bounded(req.body.message, 12000), moduleName = bounded(req.body.module, 120), pageUrl = sanitizedPageUrl(req.body.pageUrl);
    const projectId = asId(req.body.projectId), idempotencyKey = bounded(req.get("Idempotency-Key"), 120) || null;
    if (!TYPES.has(feedbackType) || !PRIORITIES.has(priority)) return res.status(400).json({ code: "FEEDBACK_CLASSIFICATION_INVALID", error: "Invalid feedback classification" });
    if (!message || !pageUrl) return res.status(400).json({ code: "FEEDBACK_REQUIRED_FIELDS", error: "Description and page are required" });
    const outcome = await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback:${user.userId}:${idempotencyKey || randomUUID()}`},0))`);
        const [actor] = await tx.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
        if (!actor?.companyId) return { status: 403, code: "COMPANY_ACCESS_DENIED", error: "Current company authority is required" } as const;
        if (!await projectAuthorized(projectId, user, actor.companyId, tx)) return { status: 403, code: "PROJECT_ACCESS_DENIED", error: "You do not have access to this project" } as const;
        const requestHash = createHash("sha256").update(JSON.stringify({ feedbackType, priority, message, moduleName, pageUrl, projectId, companyId: actor.companyId })).digest("hex");
        if (idempotencyKey) { const [prior] = await tx.select().from(feedbackItemsTable).where(and(eq(feedbackItemsTable.userId, user.userId), eq(feedbackItemsTable.idempotencyKey, idempotencyKey))).limit(1); if (prior) return prior.requestHash === requestHash ? { status: 200, row: prior, replayed: true } as const : { status: 409, code: "FEEDBACK_IDEMPOTENCY_CONFLICT", error: "This idempotency key belongs to different feedback" } as const; }
        const [row] = await tx.insert(feedbackItemsTable).values({ userId: user.userId, companyId: actor.companyId, projectId, feedbackType, priority, module: moduleName || null, pageUrl, message,
          status: "new", stableId: `FB-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, idempotencyKey, requestHash,
          metadata: { build: FEEDBACK_RELEASE, userAgent: bounded(req.get("user-agent"), 512), viewport: bounded(req.body.metadata?.viewport, 32), language: bounded(req.body.metadata?.language, 24) } }).returning();
        if (!row) throw new Error("Feedback insert did not return a row");
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.id, actorUserId: user.userId, eventType: "created", afterState: { status: "new", version: 1 } });
        const [acknowledgment] = await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.id, actorUserId: user.userId, eventType: "submission_acknowledged", reason: "Your feedback was received and is ready for review.", afterState: { status: "new", version: 1, receiptId: row.stableId, release: FEEDBACK_RELEASE } }).returning({ id: feedbackAuditEventsTable.id });
        const reviewers = await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isSuperAdmin, true));
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.id, actorUserId: user.userId, eventType: "submission_notification_outbox_created", afterState: { sourceEventId: acknowledgment.id, reviewerUserIds: reviewers.map(reviewer => reviewer.id), customerUserId: user.userId, state: "pending", release: FEEDBACK_RELEASE } });
        return { status: 201, row, replayed: false, acknowledgmentId: acknowledgment.id, reviewerIds: reviewers.map(reviewer => reviewer.id) } as const;
      });
    if (!("row" in outcome)) return res.status(outcome.status).json({ code: outcome.code, error: outcome.error });
    if (!outcome.row) throw new Error("Feedback transaction returned no row");
    let notificationState = outcome.replayed ? "previously-attempted" : "pending";
    if (!outcome.replayed && "acknowledgmentId" in outcome) {
      try {
        await db.transaction(async tx => {
          const [customerNotification] = await tx.insert(notificationsTable).values({ userId: user.userId, projectId: outcome.row.projectId, type: "feedback_acknowledgment", title: `Feedback ${outcome.row.stableId} received`, message: "Your feedback was received and is ready for review.", actionUrl: "/feedback?view=mine" }).returning({ id: notificationsTable.id });
          await tx.insert(feedbackAuditEventsTable).values({ feedbackId: outcome.row.id, actorUserId: user.userId, eventType: "customer_notification_delivery", afterState: { sourceEventId: outcome.acknowledgmentId, notificationId: customerNotification.id, channel: "in_app", state: "created", idempotencyKey: `ack:${outcome.row.id}` } });
          const reviewerIds = outcome.reviewerIds || [];
          if (reviewerIds.length) { const reviewerNotifications = await tx.insert(notificationsTable).values(reviewerIds.map(reviewerId => ({ userId: reviewerId, projectId: outcome.row.projectId, type: "feedback_review_requested", title: `New feedback ${outcome.row.stableId}`, message: `${outcome.row.feedbackType} feedback requires review.`, actionUrl: `/admin?tab=feedback&feedback=${encodeURIComponent(outcome.row.stableId)}` }))).returning({ id: notificationsTable.id }); await tx.insert(feedbackAuditEventsTable).values({ feedbackId: outcome.row.id, actorUserId: user.userId, eventType: "internal_reviewer_notifications_created", afterState: { sourceEventId: outcome.acknowledgmentId, notificationIds: reviewerNotifications.map(item => item.id), reviewerCount: reviewerNotifications.length, state: "created", release: FEEDBACK_RELEASE } }); }
          await tx.insert(feedbackAuditEventsTable).values({ feedbackId: outcome.row.id, actorUserId: user.userId, eventType: "submission_notification_outbox_settled", afterState: { sourceEventId: outcome.acknowledgmentId, state: reviewerIds.length ? "delivered" : "blocked", reasonCode: reviewerIds.length ? null : "no-active-reviewer", reviewerCount: reviewerIds.length, release: FEEDBACK_RELEASE } });
          if (!reviewerIds.length) await tx.insert(feedbackAuditEventsTable).values({ feedbackId: outcome.row.id, actorUserId: user.userId, eventType: "submission_reviewer_escalation_required", afterState: { state: "no-active-reviewer", release: FEEDBACK_RELEASE } });
        });
        notificationState = outcome.reviewerIds?.length ? "delivered" : "blocked";
      } catch (notificationError) {
        notificationState = "retry-required";
        console.error("[feedback] submission notification delivery deferred", notificationError instanceof Error ? notificationError.name : "unknown");
        try { await db.insert(feedbackAuditEventsTable).values({ feedbackId: outcome.row.id, actorUserId: user.userId, eventType: "submission_notification_delivery_failed", afterState: { sourceEventId: outcome.acknowledgmentId, state: "retry-required" } }); } catch { /* canonical intake remains durable even if delivery logging is unavailable */ }
      }
    }
    return res.status(outcome.status).json({ success: true, replayed: outcome.replayed, notificationState, receipt: { id: outcome.row.stableId, acknowledgedAt: outcome.row.createdAt, status: outcome.row.status, release: FEEDBACK_RELEASE }, feedback: customerFeedbackDto(outcome.row) });
  } catch (error) { console.error("[feedback] create failed", error instanceof Error ? error.name : "unknown"); return res.status(500).json({ code: "FEEDBACK_CREATE_FAILED", error: "Failed to submit feedback" }); }
});

router.post("/feedback/capture-consents", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const captureKind = bounded(req.body.captureKind, 20), purpose = bounded(req.body.purpose, 240);
  if (!["audio", "screenshot", "transcription"].includes(captureKind) || !purpose || req.body.accepted !== true) return res.status(400).json({ code: "CAPTURE_CONSENT_INVALID", error: "Explicit capture or processing consent, kind, and purpose are required" });
  const id = randomUUID(); const [consent] = await db.insert(feedbackCaptureConsentsTable).values({ id, actorUserId: user.userId, captureKind, purpose, noticeVersion: CAPTURE_NOTICE_VERSION }).returning();
  return res.status(201).json({ consent: { id: consent.id, captureKind, purpose, noticeVersion: consent.noticeVersion, grantedAt: consent.grantedAt } });
});

router.post("/feedback/capture-consents/:id/revoke", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = bounded(req.params.id, 80); const consent = await db.transaction(async tx => { await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`capture-consent:${id}`},0))`); const [row] = await tx.update(feedbackCaptureConsentsTable).set({ revokedAt: new Date() }).where(and(eq(feedbackCaptureConsentsTable.id, id), eq(feedbackCaptureConsentsTable.actorUserId, user.userId), sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).returning(); if (row?.feedbackId) await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.feedbackId, actorUserId: user.userId, eventType: "capture_consent_revoked", afterState: { captureKind: row.captureKind, noticeVersion: row.noticeVersion } }); return row; });
  if (consent) return res.json({ revoked: true, replayed: false, revokedAt: consent.revokedAt });
  const [prior] = await db.select({ id: feedbackCaptureConsentsTable.id, revokedAt: feedbackCaptureConsentsTable.revokedAt }).from(feedbackCaptureConsentsTable).where(and(eq(feedbackCaptureConsentsTable.id, id), eq(feedbackCaptureConsentsTable.actorUserId, user.userId))).limit(1);
  if (!prior) return res.status(404).json({ code: "CAPTURE_CONSENT_NOT_FOUND", error: "Capture consent not found" });
  return res.json({ revoked: true, replayed: true, revokedAt: prior.revokedAt });
});

router.post("/feedback/:id/assets", authMiddleware, upload, async (req, res) => {
  const stored: string[] = [];
  try {
    const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
    const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
    const files = Array.isArray(req.files) ? req.files : [], requestedKind = bounded(req.body.kind || "attachment", 20), uploadKey = bounded(req.get("Idempotency-Key"), 120), origin = bounded(req.body.origin, 40);
    if (!files.length || files.length !== 1 || !uploadKey || !ORIGINS_BY_KIND[requestedKind]?.has(origin)) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "One supported file, an explicit compatible origin, and a per-file idempotency key are required" });
    const inspected = inspectFeedbackEvidence(files[0]); const mediaClass = inspected.mediaType.startsWith("audio/") ? "audio" : inspected.mediaType.startsWith("image/") ? "image" : "document";
    if ((requestedKind === "audio" && mediaClass !== "audio") || (requestedKind === "screenshot" && mediaClass !== "image") || (requestedKind === "attachment" && mediaClass === "audio")) return res.status(415).json({ code: "FEEDBACK_ASSET_KIND_MISMATCH", error: "Asset kind does not match inspected media" });
    const kind = requestedKind;
    const consentId = bounded(req.body.consentId, 80);
    const captureBundleId = bounded(req.body.captureBundleId, 80), captureRole = bounded(req.body.captureRole, 20);
    const screenshotBundle = origin === "browser-display-capture" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(captureBundleId) && ["original", "marked"].includes(captureRole);
    if (origin === "browser-display-capture" && (!!captureBundleId !== !!captureRole || ((captureBundleId || captureRole) && !screenshotBundle))) return res.status(400).json({ code: "FEEDBACK_CAPTURE_BUNDLE_INVALID", error: "Screenshot bundle identity and role must be a UUID with role original or marked" });
    const transformations = (() => { try { const parsed = JSON.parse(bounded(req.body.transformations, 12000)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } })();
    const transformation = boundedTransformation(transformations[uploadKey] ?? null);
    const requestHash = createHash("sha256").update(JSON.stringify({ feedbackId: id, actorId: user.userId, kind, origin, consentId: bounded(req.body.consentId, 80) || null, captureBundleId: screenshotBundle ? captureBundleId : null, captureRole: screenshotBundle ? captureRole : null, sha256: inspected.sha256, transformation })).digest("hex");
    const scannerAdapter = localFixture(process.env.BIMLOG_FEEDBACK_SCANNER, "fixture-clean") ? "local-fixture" : "default-deny";
    const scanState = scannerAdapter === "local-fixture" ? "clean" : "quarantined";
    const results = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${user.userId}:${uploadKey}`}, 0))`);
      const [actor] = await tx.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
      const [feedback] = await tx.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id, id)).limit(1);
      if (!actor || !feedback || feedback.userId !== user.userId || feedback.companyId !== actor.companyId || !feedback.customerVisible) throw Object.assign(new Error("You cannot add files to this feedback"), { status: 403, code: "FEEDBACK_WRITE_DENIED" });
      if (feedback.projectId && !await projectAuthorized(feedback.projectId, user, actor.companyId, tx)) throw Object.assign(new Error("You cannot add files to this feedback"), { status: 403, code: "FEEDBACK_WRITE_DENIED" });
      let captureConsent: typeof feedbackCaptureConsentsTable.$inferSelect | undefined;
      const captureKind = origin === "browser-microphone" ? "audio" : origin === "browser-display-capture" ? "screenshot" : null;
      if (captureKind) { await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`capture-consent:${consentId}`},0))`); [captureConsent] = await tx.select().from(feedbackCaptureConsentsTable).where(and(eq(feedbackCaptureConsentsTable.id, consentId), eq(feedbackCaptureConsentsTable.actorUserId, user.userId), eq(feedbackCaptureConsentsTable.captureKind, captureKind), sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).limit(1); if (!captureConsent || (captureConsent.feedbackId && captureConsent.feedbackId !== id)) throw Object.assign(new Error("Active matching capture consent is required for browser capture"), { status: 403, code: "FEEDBACK_CAPTURE_CONSENT_REQUIRED" }); }
      else if (consentId) throw Object.assign(new Error("Imported files must not claim browser-capture consent"), { status: 400, code: "FEEDBACK_CAPTURE_CONSENT_NOT_APPLICABLE" });
      const [winner] = await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.feedbackId, id),eq(feedbackAssetsTable.uploadedById,user.userId),eq(feedbackAssetsTable.uploadRequestKey,uploadKey))).limit(1);
      if (winner) { if (winner.uploadRequestHash !== requestHash) throw Object.assign(new Error("This upload key belongs to different evidence"), { status: 409, code: "FEEDBACK_ASSET_IDEMPOTENCY_CONFLICT" }); return [{ id: winner.id, kind: winner.kind, name: winner.safeName, mediaType: winner.mediaType, byteSize: winner.byteSize, sha256: winner.sha256, scanState: winner.scanState, replayed: true }]; }
      const [receipt] = await tx.select({ afterState: feedbackAuditEventsTable.afterState }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, id), eq(feedbackAuditEventsTable.actorUserId, user.userId), eq(feedbackAuditEventsTable.eventType, "asset_upload_receipt"), sql`${feedbackAuditEventsTable.afterState}->>'uploadRequestKey'=${uploadKey}`)).limit(1);
      if (receipt) {
        const state = receipt.afterState as Record<string, unknown>;
        if (state.uploadRequestHash !== requestHash) throw Object.assign(new Error("This upload key belongs to different evidence"), { status: 409, code: "FEEDBACK_ASSET_IDEMPOTENCY_CONFLICT" });
        const [mapped] = await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.feedbackId, id), eq(feedbackAssetsTable.id, Number(state.assetId)))).limit(1);
        if (!mapped) throw Object.assign(new Error("Upload receipt mapping is unavailable"), { status: 409, code: "FEEDBACK_ASSET_RECEIPT_INVALID" });
        return [{ id: mapped.id, kind: mapped.kind, name: mapped.safeName, mediaType: mapped.mediaType, byteSize: mapped.byteSize, sha256: mapped.sha256, scanState: mapped.scanState, replayed: true, deduplicated: true }];
      }
      if(captureConsent){
        const consumed=await tx.select({id:feedbackAssetsTable.id,feedbackId:feedbackAssetsTable.feedbackId,provenance:feedbackAssetsTable.provenance}).from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.uploadedById,user.userId),sql`${feedbackAssetsTable.provenance}->>'consentId'=${captureConsent.id}`)).orderBy(feedbackAssetsTable.id);
        if(consumed.length){
          const validPair=screenshotBundle&&consumed.length===1&&consumed[0].feedbackId===id&&String((consumed[0].provenance as Record<string,unknown>).captureBundleId||"")===captureBundleId&&["original","marked"].includes(String((consumed[0].provenance as Record<string,unknown>).captureRole||""))&&String((consumed[0].provenance as Record<string,unknown>).captureRole)!==captureRole;
          if(!validPair)throw Object.assign(new Error("Capture consent was already consumed by another evidence upload"),{status:409,code:"FEEDBACK_CAPTURE_CONSENT_CONSUMED"});
        }
        if(screenshotBundle){const foreign=await tx.select({id:feedbackAssetsTable.id,provenance:feedbackAssetsTable.provenance}).from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.uploadedById,user.userId),sql`${feedbackAssetsTable.provenance}->>'captureBundleId'=${captureBundleId}`));if(foreign.some(row=>String((row.provenance as Record<string,unknown>).consentId)!==captureConsent!.id||String((row.provenance as Record<string,unknown>).captureRole)===captureRole))throw Object.assign(new Error("Screenshot bundle identity or role was already consumed"),{status:409,code:"FEEDBACK_CAPTURE_BUNDLE_CONSUMED"});}
      }
      if (captureConsent && !captureConsent.feedbackId) { const linked = await tx.update(feedbackCaptureConsentsTable).set({ feedbackId: id }).where(and(eq(feedbackCaptureConsentsTable.id, captureConsent.id), sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).returning({ id: feedbackCaptureConsentsTable.id }); if (!linked.length) throw Object.assign(new Error("Capture consent was revoked"), { status: 403, code: "FEEDBACK_CAPTURE_CONSENT_REQUIRED" }); }
      const [identical] = await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.feedbackId,id),eq(feedbackAssetsTable.sha256,inspected.sha256))).limit(1);
      if (identical) {
        const prior = identical.provenance as Record<string, unknown>;
        const identityMatches = identical.kind === kind && prior.source === origin && prior.consentId === (captureConsent?.id || null) && (prior.captureBundleId ?? null) === (screenshotBundle ? captureBundleId : null) && (prior.captureRole ?? null) === (screenshotBundle ? captureRole : null) && JSON.stringify(prior.transformation ?? null) === JSON.stringify(transformation);
        if (!identityMatches) throw Object.assign(new Error("Identical bytes already exist with different evidence provenance"), { status: 409, code: "FEEDBACK_ASSET_PROVENANCE_CONFLICT" });
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "asset_upload_receipt", afterState: { assetId: identical.id, uploadRequestKey: uploadKey, uploadRequestHash: requestHash } });
        return [{ id: identical.id, kind: identical.kind, name: identical.safeName, mediaType: identical.mediaType, byteSize: identical.byteSize, sha256: identical.sha256, scanState: identical.scanState, replayed: true, deduplicated: true }];
      }
      const file = files[0], storagePath = await storage.upload(file.buffer, feedback.projectId ?? `feedback-${id}`, inspected.name); stored.push(storagePath);
      const [asset] = await tx.insert(feedbackAssetsTable).values({ feedbackId: id, projectId: feedback.projectId, uploadedById: user.userId, kind,
          originalName: bounded(file.originalname, 255), safeName: inspected.name, mediaType: inspected.mediaType, byteSize: file.size,
          sha256: inspected.sha256, storagePath, uploadRequestKey:uploadKey,uploadRequestHash:requestHash,scanState, scannerAdapter, scannedAt: scanState === "clean" ? new Date() : null,
          provenance: { source: origin, uploadRequestKey: uploadKey, uploadRequestHash: requestHash, consentId: captureConsent?.id || null, consentNoticeVersion: captureConsent?.noticeVersion || null, purpose: captureConsent?.purpose || null, captureBundleId: screenshotBundle ? captureBundleId : null, captureRole: screenshotBundle ? captureRole : null, actorUserId: user.userId, grantedAt: captureConsent?.grantedAt?.toISOString() || null, receivedAt: new Date().toISOString(), transformation } }).returning();
      await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "assets_added", afterState: { count: 1, scannerAdapter, scanState } });
      return [{ id: asset.id, kind, name: asset.safeName, mediaType: asset.mediaType, byteSize: asset.byteSize, sha256: asset.sha256, scanState }];
    });
    const replayed = results.some(row => "replayed" in row && row.replayed === true);
    const deduplicated = results.some(row => "deduplicated" in row && row.deduplicated === true);
    return res.status(replayed ? 200 : 201).json({ replayed, deduplicated, consent: origin === "user-file-import" ? { required: false, state: "not-applicable" } : { required: true, state: "consumed", id: consentId }, assets: results.map(row => ({ id: row.id, kind: row.kind, name: row.name, mediaType: row.mediaType, byteSize: row.byteSize, sha256: row.sha256, scanState: row.scanState })), scanner: scannerAdapter === "local-fixture" ? "local-fixture" : "activation-required" });
  } catch (error) {
    const cleanupFailures = [];
    const userId = req.user?.userId, uploadKey = bounded(req.get("Idempotency-Key"), 120);
    for (const item of stored) { try { const referenced = await db.transaction(async tx => { if (userId && uploadKey) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${uploadKey}`}, 0))`); const [row] = await tx.select({ id: feedbackAssetsTable.id }).from(feedbackAssetsTable).where(eq(feedbackAssetsTable.storagePath, item)).limit(1); return !!row; }); if (!referenced) await storage.delete(item); } catch { cleanupFailures.push(item); } }
    const known = error as Error & { status?: number; code?: string };
    if (cleanupFailures.length) return res.status(500).json({ code: "FEEDBACK_STORAGE_COMPENSATION_FAILED", error: "Upload failed and quarantined storage cleanup requires operator review" });
    return res.status(known.status || 500).json({ code: known.code || "FEEDBACK_UPLOAD_FAILED", error: known.status ? known.message : "Upload failed safely" });
  }
});

router.post("/feedback/:id/transcription", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), assetId = asId(req.body.assetId), retryOfJobId = asId(req.body.retryOfJobId); if (!id || !assetId) return res.status(400).json({ code: "TRANSCRIPTION_INPUT_INVALID", error: "Feedback and audio asset are required" });
  const consentId = bounded(req.body.consentId, 80), requestKey = bounded(req.get("Idempotency-Key"), 120);
  if (!consentId || !requestKey) return res.status(400).json({ code: "TRANSCRIPTION_CONSENT_REQUIRED", error: "Capture consent and idempotency key are required" });
  const fixture = localFixture(process.env.BIMLOG_FEEDBACK_TRANSCRIPTION_ADAPTER, "local-fixture");
  const provider = fixture ? "local-fixture" : "none", model = fixture ? "deterministic-fixture" : "none", adapterVersion = "feedback-transcription-v1";
  const result = fixture ? "Local transcription fixture result." : null, outputSha256 = result ? createHash("sha256").update(result).digest("hex") : null;
  try { const outcome = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`capture-consent:${consentId}`},0))`); await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`transcription:${user.userId}:${requestKey}`},0))`);
    const fresh=await accessible(id,user,tx); const [asset]=await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id,assetId),eq(feedbackAssetsTable.feedbackId,id),eq(feedbackAssetsTable.uploadedById,user.userId),eq(feedbackAssetsTable.kind,"audio"),eq(feedbackAssetsTable.scanState,"clean"),sql`${feedbackAssetsTable.scannedAt} is not null`)).limit(1);
    const audioOrigin=asset?(asset.provenance as Record<string,unknown>).source:null,consentKind=audioOrigin==="user-file-import"?"transcription":"audio";
    const [activeConsent]=await tx.select().from(feedbackCaptureConsentsTable).where(and(eq(feedbackCaptureConsentsTable.id,consentId),eq(feedbackCaptureConsentsTable.actorUserId,user.userId),eq(feedbackCaptureConsentsTable.captureKind,consentKind),sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).limit(1);
    if(!fresh||!asset||!activeConsent||(activeConsent.feedbackId&&activeConsent.feedbackId!==id))throw Object.assign(new Error("Active applicable consent and a currently clean owned audio asset are required"),{status:403,code:"TRANSCRIPTION_DENIED"});
    const requestHash=createHash("sha256").update(JSON.stringify({feedbackId:id,assetId,consentId,sourceSha256:asset.sha256,provider,model,adapterVersion,retryOfJobId})).digest("hex"); const [winner]=await tx.select().from(feedbackTranscriptionJobsTable).where(and(eq(feedbackTranscriptionJobsTable.requestedById,user.userId),eq(feedbackTranscriptionJobsTable.requestKey,requestKey))).limit(1);
    if(winner){if(winner.requestHash!==requestHash)throw Object.assign(new Error("This idempotency key belongs to a different request"),{status:409,code:"TRANSCRIPTION_IDEMPOTENCY_CONFLICT"});return {row:winner,replayed:true};}
    const [latest]=await tx.select().from(feedbackTranscriptionJobsTable).where(and(eq(feedbackTranscriptionJobsTable.feedbackId,id),eq(feedbackTranscriptionJobsTable.assetId,assetId),eq(feedbackTranscriptionJobsTable.requestedById,user.userId))).orderBy(desc(feedbackTranscriptionJobsTable.createdAt),desc(feedbackTranscriptionJobsTable.id)).limit(1);
    if(latest?.state==="blocked"){if(retryOfJobId!==latest.id)throw Object.assign(new Error("A blocked transcription requires an explicit successor request"),{status:409,code:"TRANSCRIPTION_SUCCESSOR_REQUIRED"});if(latest.provider===provider&&latest.model===model&&latest.adapterVersion===adapterVersion)throw Object.assign(new Error("The governed transcription adapter has not changed"),{status:409,code:"TRANSCRIPTION_ADAPTER_UNCHANGED"});}
    else if(retryOfJobId)throw Object.assign(new Error("The requested predecessor is not the current blocked transcription"),{status:409,code:"TRANSCRIPTION_SUCCESSOR_INVALID"});
    if(!activeConsent.feedbackId){const linked=await tx.update(feedbackCaptureConsentsTable).set({feedbackId:id}).where(and(eq(feedbackCaptureConsentsTable.id,consentId),sql`${feedbackCaptureConsentsTable.feedbackId} is null`,sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).returning({id:feedbackCaptureConsentsTable.id});if(!linked.length)throw Object.assign(new Error("Processing consent changed before it could be consumed"),{status:409,code:"TRANSCRIPTION_CONSENT_CONFLICT"});}
    const [row] = await tx.insert(feedbackTranscriptionJobsTable).values({ feedbackId:id,assetId,requestedById:user.userId,adapter:fixture?"local-fixture":"default-deny",state:fixture?"completed":"blocked",result,errorCode:fixture?null:"EXTERNAL_TRANSCRIPTION_NOT_ACTIVATED",attempts:1,requestKey,requestHash,consentId,provider,model,adapterVersion,sourceSha256:asset.sha256,outputSha256,completedAt:fixture?new Date():null }).returning();
    await tx.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:user.userId,eventType:"transcription_requested",afterState:{state:row.state}});return {row,replayed:false}; });
    return res.status(outcome.replayed?(outcome.row.state==="blocked"?424:200):(fixture?201:424)).json({replayed:outcome.replayed,job:transcriptionDto(outcome.row),originalAudioRetained:true});
  } catch(cause){const known=cause as Error&{status?:number;code?:string};return res.status(known.status||500).json({code:known.code||"TRANSCRIPTION_FAILED",error:known.status?known.message:"Transcription failed safely"});}
});

router.post("/feedback/:id/transcription/:jobId/review", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), jobId = asId(req.params.jobId), reviewState = bounded(req.body.reviewState, 20), reason = bounded(req.body.reason, 2000);
  if (!id || !jobId || !["accepted", "rejected"].includes(reviewState) || (reviewState === "rejected" && !reason)) return res.status(400).json({ code: "TRANSCRIPTION_REVIEW_INVALID", error: "A valid review decision and rejection reason are required" });
  const job = await db.transaction(async tx => { await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`review:${id}:${jobId}`},0))`); if(!await accessible(id,user,tx))return undefined; const [row] = await tx.update(feedbackTranscriptionJobsTable).set({ reviewState, reviewedById: user.userId, reviewedAt: new Date(), reviewReason: reason || null }).where(and(eq(feedbackTranscriptionJobsTable.id, jobId), eq(feedbackTranscriptionJobsTable.feedbackId, id), eq(feedbackTranscriptionJobsTable.state, "completed"), eq(feedbackTranscriptionJobsTable.reviewState, "pending"))).returning(); if (!row) return null; await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "transcription_reviewed", afterState: { jobId, reviewState, outputSha256: row.outputSha256 }, reason: reason || null }); return row; });
  if(job===undefined)return res.status(403).json({code:"TRANSCRIPTION_REVIEW_DENIED",error:"Review authority changed"});
  if (!job) return res.status(409).json({ code: "TRANSCRIPTION_REVIEW_CONFLICT", error: "Transcription is unavailable or already reviewed" }); return res.json({ job: transcriptionDto(job) });
});

router.get("/feedback/mine", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const [actor] = await db.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
  if (!actor) return res.status(403).json({ code: "COMPANY_ACCESS_DENIED", error: "Current company authority is required" });
  const rows = await db.select({ id: feedbackItemsTable.id, stableId: feedbackItemsTable.stableId, userId: feedbackItemsTable.userId,
    companyId: feedbackItemsTable.companyId, projectId: feedbackItemsTable.projectId, feedbackType: feedbackItemsTable.feedbackType,
    priority: feedbackItemsTable.priority, module: feedbackItemsTable.module, pageUrl: feedbackItemsTable.pageUrl,
    message: feedbackItemsTable.message, status: feedbackItemsTable.status, version: feedbackItemsTable.version,
    targetRelease: feedbackItemsTable.targetRelease, dispositionReason: feedbackItemsTable.dispositionReason,
    customerVisible: feedbackItemsTable.customerVisible, createdAt: feedbackItemsTable.createdAt,
    updatedAt: feedbackItemsTable.updatedAt, resolvedAt: feedbackItemsTable.resolvedAt })
    .from(feedbackItemsTable).where(and(eq(feedbackItemsTable.userId, user.userId), eq(feedbackItemsTable.companyId, actor.companyId), eq(feedbackItemsTable.customerVisible, true)))
    .orderBy(desc(feedbackItemsTable.createdAt)).limit(200);
  const projectIds = [...new Set(rows.flatMap(row => row.projectId ? [row.projectId] : []))];
  const active = new Set<number>();
  for (const projectId of projectIds) if (await projectAuthorized(projectId, user, actor.companyId)) active.add(projectId);
  const visible=rows.filter(row=>!row.projectId||active.has(row.projectId)),ids=visible.map(row=>row.id);
  const transcriptions=ids.length?await db.select().from(feedbackTranscriptionJobsTable).where(and(inArray(feedbackTranscriptionJobsTable.feedbackId,ids),eq(feedbackTranscriptionJobsTable.requestedById,user.userId))).orderBy(desc(feedbackTranscriptionJobsTable.createdAt)):[];
  const relays=ids.length?await db.select({id:feedbackRelayJobsTable.id,feedbackId:feedbackRelayJobsTable.feedbackId,assetId:feedbackRelayJobsTable.assetId,lineageId:feedbackRelayJobsTable.lineageId,state:feedbackRelayJobsTable.state,version:feedbackRelayJobsTable.version,createdAt:feedbackRelayJobsTable.createdAt,updatedAt:feedbackRelayJobsTable.updatedAt}).from(feedbackRelayJobsTable).where(and(inArray(feedbackRelayJobsTable.feedbackId,ids),eq(feedbackRelayJobsTable.companyId,actor.companyId))).orderBy(feedbackRelayJobsTable.feedbackId,feedbackRelayJobsTable.assetId,feedbackRelayJobsTable.lineageId,desc(feedbackRelayJobsTable.version),desc(feedbackRelayJobsTable.updatedAt),desc(feedbackRelayJobsTable.id)):[];
  const currentByLineage=new Map<string,(typeof relays)[number]>();for(const relay of relays){const key=`${relay.feedbackId}:${relay.assetId}:${relay.lineageId}`;if(!currentByLineage.has(key))currentByLineage.set(key,relay);}const relaysByFeedback=new Map<number,Array<(typeof relays)[number]>>();for(const relay of currentByLineage.values()){const entries=relaysByFeedback.get(relay.feedbackId)||[];entries.push(relay);relaysByFeedback.set(relay.feedbackId,entries);}for(const entries of relaysByFeedback.values())entries.sort((left,right)=>left.assetId-right.assetId||right.updatedAt.getTime()-left.updatedAt.getTime()||right.version-left.version);
  const relayIds=[...currentByLineage.values()].map(relay=>relay.id);const custody=relayIds.length?await db.select({jobId:feedbackRelayCustodyEventsTable.jobId,sequence:feedbackRelayCustodyEventsTable.sequence,state:feedbackRelayCustodyEventsTable.toState,occurredAt:feedbackRelayCustodyEventsTable.occurredAt}).from(feedbackRelayCustodyEventsTable).where(inArray(feedbackRelayCustodyEventsTable.jobId,relayIds)).orderBy(feedbackRelayCustodyEventsTable.jobId,feedbackRelayCustodyEventsTable.sequence,feedbackRelayCustodyEventsTable.occurredAt):[];
  const snapshotEvents=ids.length?await db.select({feedbackId:feedbackAuditEventsTable.feedbackId,afterState:feedbackAuditEventsTable.afterState,createdAt:feedbackAuditEventsTable.createdAt}).from(feedbackAuditEventsTable).where(and(inArray(feedbackAuditEventsTable.feedbackId,ids),eq(feedbackAuditEventsTable.eventType,"package_snapshot_created"),sql`${feedbackAuditEventsTable.afterState}->>'visibility'='customer'`)).orderBy(desc(feedbackAuditEventsTable.id)):[];
  const snapshotByFeedback=new Map<number,Record<string,unknown>>();for(const event of snapshotEvents)if(!snapshotByFeedback.has(event.feedbackId))snapshotByFeedback.set(event.feedbackId,{...(event.afterState as Record<string,unknown>),generatedAt:event.createdAt.toISOString()});
  const transcriptionByFeedback=new Map<number,typeof feedbackTranscriptionJobsTable.$inferSelect>();for(const job of transcriptions)if(!transcriptionByFeedback.has(job.feedbackId))transcriptionByFeedback.set(job.feedbackId,job);
  return res.json({feedback:visible.map(row=>({...customerFeedbackDto(row),packageSnapshot:packageSnapshotDto(snapshotByFeedback.get(row.id)),transcription:transcriptionByFeedback.has(row.id)?transcriptionDto(transcriptionByFeedback.get(row.id)!):null,relays:(relaysByFeedback.get(row.id)||[]).map(relay=>({assetId:relay.assetId,state:relay.state,version:relay.version,createdAt:relay.createdAt,updatedAt:relay.updatedAt,reason:customerRelayReason(relay.state),history:custody.filter(event=>event.jobId===relay.id).map(event=>({sequence:event.sequence,state:event.state,at:event.occurredAt,reason:customerRelayReason(event.state)}))}))}))});
});

router.post("/feedback/:id/reopen", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), observedVersion = asId(req.body.observedVersion), reason = bounded(req.body.reason, 2000);
  if (!id || !observedVersion || !reason) return res.status(400).json({ code: "FEEDBACK_REOPEN_INVALID", error: "Current version and a reopen reason are required" });
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`reopen:${id}`},0))`); const fresh=await accessible(id,user,tx);if(!fresh)return undefined;
    if(!TERMINAL.has(fresh.status))return "invalid" as const;
    const [row] = await tx.update(feedbackItemsTable).set({ status: "triaged", dispositionReason: reason, version: fresh.version + 1, updatedAt: new Date(), resolvedAt: null })
      .where(and(eq(feedbackItemsTable.id, id), eq(feedbackItemsTable.version, observedVersion))).returning();
    if (!row) return null;
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "reopened", beforeState: { status: fresh.status, version: fresh.version }, afterState: { status: row.status, version: row.version }, reason });
    return row;
  });
  if(updated===undefined)return res.status(403).json({code:"FEEDBACK_REOPEN_DENIED",error:"Reopen authority changed"}); if(updated==="invalid")return res.status(409).json({code:"FEEDBACK_REOPEN_STATE_INVALID",error:"Only closed feedback can be reopened"}); if (!updated) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before reopening" });
  return res.json({ success: true, feedback: customerFeedbackDto(updated) });
});

router.get("/feedback/:id/history", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_HISTORY_DENIED", error: "History is not authorized" });
  const history = await db.select({ id: feedbackAuditEventsTable.id, eventType: feedbackAuditEventsTable.eventType,
    beforeState: feedbackAuditEventsTable.beforeState,
    afterState: feedbackAuditEventsTable.afterState, reason: feedbackAuditEventsTable.reason, createdAt: feedbackAuditEventsTable.createdAt })
    .from(feedbackAuditEventsTable).where(eq(feedbackAuditEventsTable.feedbackId, id)).orderBy(feedbackAuditEventsTable.createdAt);
  return res.json({ feedback: { id: feedback.id, stableId: feedback.stableId, version: feedback.version }, history: history.filter(event => CUSTOMER_EVENT_TYPES.has(event.eventType)).map(event => ({
    id: event.id, eventType: event.eventType, visibility: "customer", beforeState: customerEventState(event.beforeState),
    afterState: customerEventState(event.afterState), message: FEEDBACK_CUSTOMER_EVENT_TYPES.has(event.eventType) ? event.reason : null, createdAt: event.createdAt,
  })) });
});

router.get("/feedback/:id/assets", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_ASSET_LIST_DENIED", error: "Evidence access is denied" });
  const assets = await db.select({ id: feedbackAssetsTable.id, kind: feedbackAssetsTable.kind, name: feedbackAssetsTable.safeName, mediaType: feedbackAssetsTable.mediaType, byteSize: feedbackAssetsTable.byteSize, sha256: feedbackAssetsTable.sha256, scanState: feedbackAssetsTable.scanState, provenance:feedbackAssetsTable.provenance,createdAt: feedbackAssetsTable.createdAt })
    .from(feedbackAssetsTable).where(eq(feedbackAssetsTable.feedbackId, id)).orderBy(feedbackAssetsTable.createdAt);
  return res.json({ assets: assets.map(asset => { const provenance=asset.provenance as Record<string,unknown>;return { id:asset.id,kind:asset.kind,name:asset.name,mediaType:asset.mediaType,byteSize:asset.byteSize,sha256:asset.sha256,scanState:asset.scanState,createdAt:asset.createdAt,origin:provenance.source||null,transcriptionConsentId:asset.kind==="audio"&&provenance.source==="browser-microphone"?provenance.consentId||null:null,downloadUrl:asset.scanState === "clean" ? `/api/v1/feedback/${id}/assets/${asset.id}/download` : null }; }) });
});

router.post("/feedback/:id/comments", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), comment = bounded(req.body.comment, 4000); if (!id || !comment) return res.status(400).json({ code: "FEEDBACK_COMMENT_INVALID", error: "A bounded comment is required" });
  const event = await db.transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`comment:${id}`},0))`);if(!await accessible(id,user,tx))return null;const [row]=await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "commented", reason: comment }).returning();return row;}); if(!event)return res.status(403).json({code:"FEEDBACK_COMMENT_DENIED",error:"Comment access is denied"});
  return res.status(201).json({ comment: { id: event.id, text: event.reason, createdAt: event.createdAt } });
});

router.get("/feedback/notifications", authMiddleware, async (req, res) => {
  const user=req.user;if(!user)return res.status(401).json({code:"AUTH_REQUIRED",error:"Unauthorized"});
  const rows=await db.select({eventId:feedbackAuditEventsTable.id,feedbackId:feedbackAuditEventsTable.feedbackId,eventType:feedbackAuditEventsTable.eventType,message:feedbackAuditEventsTable.reason,afterState:feedbackAuditEventsTable.afterState,createdAt:feedbackAuditEventsTable.createdAt,stableId:feedbackItemsTable.stableId})
    .from(feedbackAuditEventsTable).innerJoin(feedbackItemsTable,and(eq(feedbackAuditEventsTable.feedbackId,feedbackItemsTable.id),eq(feedbackItemsTable.userId,user.userId),eq(feedbackItemsTable.customerVisible,true)))
    .where(inArray(feedbackAuditEventsTable.eventType,[...FEEDBACK_CUSTOMER_EVENT_TYPES])).orderBy(desc(feedbackAuditEventsTable.createdAt)).limit(200);
  const authorized=[];for(const row of rows){if(await accessible(row.feedbackId,user))authorized.push(row);}
  const eventIds=authorized.map(row=>row.eventId),feedbackIds=[...new Set(authorized.map(row=>row.feedbackId))];const deliveries=eventIds.length?await db.select({feedbackId:feedbackAuditEventsTable.feedbackId,afterState:feedbackAuditEventsTable.afterState,createdAt:feedbackAuditEventsTable.createdAt}).from(feedbackAuditEventsTable).where(and(inArray(feedbackAuditEventsTable.feedbackId,feedbackIds),eq(feedbackAuditEventsTable.eventType,"customer_notification_delivery"),sql`${feedbackAuditEventsTable.afterState}->>'channel'='in_app'`)).orderBy(desc(feedbackAuditEventsTable.createdAt)):[];const latest=new Map<number,{notificationId:number,state:string}>();for(const delivery of deliveries){const state=delivery.afterState as Record<string,unknown>,source=Number(state.sourceEventId);if(eventIds.includes(source)&&!latest.has(source))latest.set(source,{notificationId:Number(state.notificationId),state:String(state.state)});}
  return res.json({notifications:authorized.map(row=>({eventId:row.eventId,feedbackId:row.feedbackId,stableId:row.stableId,type:row.eventType==="submission_acknowledged"?"acknowledgment":row.eventType.replace(/^staff_/,""),message:row.message,createdAt:row.createdAt,delivery:{channel:"in_app",state:latest.get(row.eventId)?.state??"unavailable",notificationId:latest.get(row.eventId)?.notificationId??null}}))});
});

router.post("/feedback/notifications/:eventId/read", authMiddleware, async (req,res)=>{
  const user=req.user,eventId=asId(req.params.eventId);if(!user)return res.status(401).json({code:"AUTH_REQUIRED",error:"Unauthorized"});if(!eventId)return res.status(400).json({code:"FEEDBACK_NOTIFICATION_INVALID",error:"Invalid notification"});
  const result=await db.transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback-notification:${user.userId}:${eventId}`},0))`);const [event]=await tx.select({feedbackId:feedbackAuditEventsTable.feedbackId,eventType:feedbackAuditEventsTable.eventType}).from(feedbackAuditEventsTable).innerJoin(feedbackItemsTable,and(eq(feedbackItemsTable.id,feedbackAuditEventsTable.feedbackId),eq(feedbackItemsTable.userId,user.userId),eq(feedbackItemsTable.customerVisible,true))).where(eq(feedbackAuditEventsTable.id,eventId)).limit(1);if(!event||!FEEDBACK_CUSTOMER_EVENT_TYPES.has(event.eventType)||!await accessible(event.feedbackId,user,tx))return null;const [delivery]=await tx.select({notificationId:sql<number>`${feedbackAuditEventsTable.afterState}->>'notificationId'`,state:sql<string>`${feedbackAuditEventsTable.afterState}->>'state'`}).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId,event.feedbackId),eq(feedbackAuditEventsTable.eventType,"customer_notification_delivery"),sql`${feedbackAuditEventsTable.afterState}->>'sourceEventId'=${String(eventId)}`)).orderBy(desc(feedbackAuditEventsTable.createdAt)).limit(1);if(!delivery?.notificationId)return null;if(delivery.state==="read")return {replayed:true};await tx.update(notificationsTable).set({isRead:true}).where(and(eq(notificationsTable.id,Number(delivery.notificationId)),eq(notificationsTable.userId,user.userId)));await tx.insert(feedbackAuditEventsTable).values({feedbackId:event.feedbackId,actorUserId:user.userId,eventType:"customer_notification_delivery",afterState:{sourceEventId:eventId,notificationId:Number(delivery.notificationId),channel:"in_app",state:"read",idempotencyKey:`read:${user.userId}:${eventId}`}});return {replayed:false};});if(!result)return res.status(403).json({code:"FEEDBACK_NOTIFICATION_DENIED",error:"Notification access is denied"});return res.json({read:true,replayed:result.replayed});
});

router.get("/feedback/:id/assets/:assetId/download", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), assetId = asId(req.params.assetId); if (!id || !assetId) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "Invalid asset" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_DOWNLOAD_DENIED", error: "Download access is denied" });
  const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, assetId), eq(feedbackAssetsTable.feedbackId, id))).limit(1);
  if (!asset) return res.status(404).json({ code: "FEEDBACK_ASSET_NOT_FOUND", error: "Asset not found" });
  if (asset.scanState !== "clean") return res.status(423).json({ code: "FEEDBACK_ASSET_QUARANTINED", error: "This file remains quarantined and cannot be downloaded" });
  if (asset.byteSize > FEEDBACK_MAX_FILE_BYTES) return res.status(413).json({ code: "FEEDBACK_DOWNLOAD_TOO_LARGE", error: "Stored file exceeds the governed download bound" });
  const boundedStorage=storage as typeof storage&{downloadBounded?:(key:string,maxBytes:number)=>Promise<Buffer>};if(!boundedStorage.downloadBounded)return res.status(503).json({code:"FEEDBACK_BOUNDED_DOWNLOAD_UNAVAILABLE",error:"Safe bounded download is temporarily unavailable"});
  let bytes:Buffer;try{bytes=await boundedStorage.downloadBounded(asset.storagePath,FEEDBACK_MAX_FILE_BYTES);}catch(cause){const code=(cause as Error&{code?:string}).code;return res.status(code==="STORAGE_OBJECT_TOO_LARGE"?413:502).json({code:code==="STORAGE_OBJECT_TOO_LARGE"?"FEEDBACK_DOWNLOAD_TOO_LARGE":"FEEDBACK_STORAGE_READ_FAILED",error:code==="STORAGE_OBJECT_TOO_LARGE"?"Stored file exceeds the governed download bound":"Stored file could not be read safely"});}if(bytes.byteLength !== asset.byteSize || bytes.byteLength > FEEDBACK_MAX_FILE_BYTES || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) return res.status(409).json({ code: "FEEDBACK_ASSET_INTEGRITY_FAILED", error: "Stored file integrity check failed" });
  res.setHeader("Content-Type", asset.mediaType); res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(asset.safeName)}`);
  res.setHeader("X-Content-Type-Options", "nosniff"); return res.send(bytes);
});

async function packageSource(id: number, visibility: "customer" | "internal", customerUser?: NonNullable<Express.Request["user"]>) {
  return buildFeedbackPackageFromAuthority({ feedbackId: id, visibility, baseUrl: publicBaseUrl(), authorize: visibility === "customer" ? async reader => !!customerUser && !!await accessible(id, customerUser, reader) : undefined });
}

router.get("/feedback/:id/package.zip", authMiddleware, async (req, res) => {
  const user = req.user, id = asId(req.params.id); if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" }); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_PACKAGE_DENIED", error: "Package access is denied" });
  try { const result = await packageSource(id, "customer", user); if (!result) return res.status(403).json({ code: "FEEDBACK_PACKAGE_DENIED", error: "Package access changed" }); res.setHeader("Content-Type", "application/zip"); res.setHeader("Content-Disposition", `attachment; filename="${feedback.stableId}-feedback-package.zip"`); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Feedback-Package-SHA256", result.archiveSha256); return res.send(result.archive); }
  catch (error) { const known = error instanceof FeedbackPackageError; return res.status(known && error.code === "PACKAGE_LIMIT" ? 413 : 409).json({ code: known ? `FEEDBACK_${error.code}` : "FEEDBACK_PACKAGE_FAILED", error: "Feedback package could not be generated safely" }); }
});

router.get("/feedback/admin/:id/package.zip", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const id = asId(req.params.id), reason = bounded(req.get("X-Export-Reason"), 500); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" }); if (!reason) return res.status(400).json({ code: "FEEDBACK_EXPORT_REASON_REQUIRED", error: "An export reason is required" });
  try { const result = await packageSource(id, "internal"); if (!result) return res.status(404).json({ code: "FEEDBACK_NOT_FOUND", error: "Feedback not found" }); await db.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: req.user!.userId, eventType: "admin_package_exported", afterState: { release: FEEDBACK_RELEASE, manifestSha256: result.manifestSha256, archiveSha256: result.archiveSha256 }, reason }); res.setHeader("Content-Type", "application/zip"); res.setHeader("Content-Disposition", `attachment; filename="feedback-${id}-internal-package.zip"`); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Feedback-Package-SHA256", result.archiveSha256); return res.send(result.archive); }
  catch (error) { const known = error instanceof FeedbackPackageError; return res.status(known && error.code === "PACKAGE_LIMIT" ? 413 : 409).json({ code: known ? `FEEDBACK_${error.code}` : "FEEDBACK_PACKAGE_FAILED", error: "Feedback package could not be generated safely" }); }
});

async function sendPackageSnapshot(res: Response, id: number, visibility: "customer" | "internal", format: "pdf" | "json" | "docx" | "xlsx", customerUser?: NonNullable<Express.Request["user"]>) {
  let generated; try { generated = await packageSource(id, visibility, customerUser); } catch { return res.status(502).json({ code: "FEEDBACK_PACKAGE_CURRENT_BUILD_FAILED", error: "The current feedback report could not be generated safely" }); }
  if (!generated) return res.status(404).json({ code: "FEEDBACK_NOT_FOUND", error: "Feedback not found" });
  const bytes = format === "pdf" ? generated.pdf : format === "docx" ? generated.docx : format === "xlsx" ? generated.workbook : generated.manifest;
  const expectedSha256 = createHash("sha256").update(bytes).digest("hex");
  const mediaType = format === "pdf" ? "application/pdf" : format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/json; charset=utf-8";
  res.setHeader("Content-Type", mediaType); res.setHeader("Content-Disposition", `attachment; filename="feedback-${id}-current.${format}"`); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Feedback-Snapshot-SHA256", expectedSha256); res.setHeader("X-Feedback-Snapshot-Source", "current-authority"); return res.send(bytes);
}

router.get("/feedback/:id/package-snapshot.pdf", authMiddleware, async (req, res) => { const user=req.user,id=asId(req.params.id);if(!user)return res.status(401).json({code:"AUTH_REQUIRED",error:"Unauthorized"});if(!id||!await accessible(id,user))return res.status(403).json({code:"FEEDBACK_PACKAGE_DENIED",error:"Package access is denied"});return sendPackageSnapshot(res,id,"customer","pdf",user); });
router.get("/feedback/:id/package-snapshot.json", authMiddleware, async (req, res) => { const user=req.user,id=asId(req.params.id);if(!user)return res.status(401).json({code:"AUTH_REQUIRED",error:"Unauthorized"});if(!id||!await accessible(id,user))return res.status(403).json({code:"FEEDBACK_PACKAGE_DENIED",error:"Package access is denied"});return sendPackageSnapshot(res,id,"customer","json",user); });
router.get("/feedback/admin/:id/package-snapshot.pdf", authMiddleware, isSuperAdminMiddleware, async (req,res)=>{const id=asId(req.params.id),reason=bounded(req.get("X-Export-Reason"),500);if(!id||!reason)return res.status(400).json({code:"FEEDBACK_EXPORT_REASON_REQUIRED",error:"Feedback and an export reason are required"});await db.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:req.user!.userId,eventType:"admin_package_snapshot_exported",afterState:{format:"pdf",release:FEEDBACK_RELEASE},reason});return sendPackageSnapshot(res,id,"internal","pdf");});
router.get("/feedback/admin/:id/package-snapshot.json", authMiddleware, isSuperAdminMiddleware, async (req,res)=>{const id=asId(req.params.id),reason=bounded(req.get("X-Export-Reason"),500);if(!id||!reason)return res.status(400).json({code:"FEEDBACK_EXPORT_REASON_REQUIRED",error:"Feedback and an export reason are required"});await db.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:req.user!.userId,eventType:"admin_package_snapshot_exported",afterState:{format:"json",release:FEEDBACK_RELEASE},reason});return sendPackageSnapshot(res,id,"internal","json");});
router.get("/feedback/admin/:id/package-snapshot.docx", authMiddleware, isSuperAdminMiddleware, async (req,res)=>{const id=asId(req.params.id),reason=bounded(req.get("X-Export-Reason"),500);if(!id||!reason)return res.status(400).json({code:"FEEDBACK_EXPORT_REASON_REQUIRED",error:"Feedback and an export reason are required"});await db.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:req.user!.userId,eventType:"admin_package_snapshot_exported",afterState:{format:"docx",release:FEEDBACK_RELEASE},reason});return sendPackageSnapshot(res,id,"internal","docx");});
router.get("/feedback/admin/:id/package-snapshot.xlsx", authMiddleware, isSuperAdminMiddleware, async (req,res)=>{const id=asId(req.params.id),reason=bounded(req.get("X-Export-Reason"),500);if(!id||!reason)return res.status(400).json({code:"FEEDBACK_EXPORT_REASON_REQUIRED",error:"Feedback and an export reason are required"});await db.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:req.user!.userId,eventType:"admin_package_snapshot_exported",afterState:{format:"xlsx",release:FEEDBACK_RELEASE},reason});return sendPackageSnapshot(res,id,"internal","xlsx");});

router.get("/feedback/admin/:id/assets/:assetId/download", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const id = asId(req.params.id), assetId = asId(req.params.assetId), reason = bounded(req.get("X-Export-Reason"), 500); if (!id || !assetId) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "Invalid asset" }); if (!reason) return res.status(400).json({ code: "FEEDBACK_EXPORT_REASON_REQUIRED", error: "An export reason is required" });
  const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, assetId), eq(feedbackAssetsTable.feedbackId, id))).limit(1); if (!asset) return res.status(404).json({ code: "FEEDBACK_ASSET_NOT_FOUND", error: "Asset not found" }); if (asset.scanState !== "clean" || !asset.scannedAt) return res.status(423).json({ code: "FEEDBACK_ASSET_QUARANTINED", error: "This file remains quarantined" });
  const boundedStorage=storage as typeof storage&{downloadBounded?:(key:string,maxBytes:number)=>Promise<Buffer>}; if(!boundedStorage.downloadBounded)return res.status(503).json({code:"FEEDBACK_BOUNDED_DOWNLOAD_UNAVAILABLE",error:"Safe bounded download is temporarily unavailable"}); let bytes:Buffer; try { bytes=await boundedStorage.downloadBounded(asset.storagePath,FEEDBACK_MAX_FILE_BYTES); } catch { return res.status(502).json({ code: "FEEDBACK_STORAGE_READ_FAILED", error: "Stored file could not be read safely" }); } if(bytes.byteLength!==asset.byteSize||bytes.byteLength>FEEDBACK_MAX_FILE_BYTES||createHash("sha256").update(bytes).digest("hex")!==asset.sha256)return res.status(409).json({code:"FEEDBACK_ASSET_INTEGRITY_FAILED",error:"Stored file integrity check failed"});
  await db.insert(feedbackAuditEventsTable).values({ feedbackId:id,actorUserId:req.user!.userId,eventType:"admin_asset_exported",afterState:{assetId,sha256:asset.sha256,release:FEEDBACK_RELEASE},reason }); res.setHeader("Content-Type",asset.mediaType);res.setHeader("Content-Disposition",`attachment; filename*=UTF-8''${encodeURIComponent(asset.safeName)}`);res.setHeader("X-Content-Type-Options","nosniff");return res.send(bytes);
});

router.get("/feedback/admin", authMiddleware, isSuperAdminMiddleware, async (_req, res) => {
  const rows = await db.select({ id: feedbackItemsTable.id, stableId: feedbackItemsTable.stableId, version: feedbackItemsTable.version, userId: feedbackItemsTable.userId,
    userEmail: usersTable.email, userFullName: usersTable.fullName, projectId: feedbackItemsTable.projectId, projectName: projectsTable.name, projectCode: projectsTable.code,
    feedbackType: feedbackItemsTable.feedbackType, priority: feedbackItemsTable.priority, module: feedbackItemsTable.module, pageUrl: feedbackItemsTable.pageUrl,
    message: feedbackItemsTable.message, status: feedbackItemsTable.status, targetRelease: feedbackItemsTable.targetRelease,
    dispositionReason: feedbackItemsTable.dispositionReason, customerVisible: feedbackItemsTable.customerVisible, ownerUserId: feedbackItemsTable.ownerUserId,
    createdAt: feedbackItemsTable.createdAt, updatedAt: feedbackItemsTable.updatedAt, resolvedAt: feedbackItemsTable.resolvedAt })
    .from(feedbackItemsTable).leftJoin(usersTable, eq(feedbackItemsTable.userId, usersTable.id)).leftJoin(projectsTable, eq(feedbackItemsTable.projectId, projectsTable.id))
    .orderBy(desc(feedbackItemsTable.createdAt)).limit(500);
  const feedbackIds = rows.map(row => row.id);
  const assets = feedbackIds.length ? await db.select({ feedbackId: feedbackAssetsTable.feedbackId, scanState: feedbackAssetsTable.scanState })
    .from(feedbackAssetsTable).where(inArray(feedbackAssetsTable.feedbackId, feedbackIds)) : [];
  const snapshots=feedbackIds.length?await db.select({id:feedbackAuditEventsTable.id,feedbackId:feedbackAuditEventsTable.feedbackId,afterState:feedbackAuditEventsTable.afterState,createdAt:feedbackAuditEventsTable.createdAt}).from(feedbackAuditEventsTable).where(and(inArray(feedbackAuditEventsTable.feedbackId,feedbackIds),eq(feedbackAuditEventsTable.eventType,"package_snapshot_created"),sql`${feedbackAuditEventsTable.afterState}->>'visibility'='internal'`)).orderBy(desc(feedbackAuditEventsTable.id)):[];
  const snapshotByFeedback=new Map<number,{id:number;state:Record<string,unknown>}>();for(const event of snapshots)if(!snapshotByFeedback.has(event.feedbackId))snapshotByFeedback.set(event.feedbackId,{id:event.id,state:{...(event.afterState as Record<string,unknown>),generatedAt:event.createdAt.toISOString()}});
  const currentSnapshotIds=[...snapshotByFeedback.values()].map(snapshot=>snapshot.id);const telegramEvents=currentSnapshotIds.length?await db.select({id:feedbackAuditEventsTable.id,feedbackId:feedbackAuditEventsTable.feedbackId,afterState:feedbackAuditEventsTable.afterState}).from(feedbackAuditEventsTable).where(and(inArray(feedbackAuditEventsTable.feedbackId,feedbackIds),eq(feedbackAuditEventsTable.eventType,"feedback_telegram_delivery"),sql`${feedbackAuditEventsTable.afterState}->>'snapshotEventId' ~ '^[0-9]+$'`,inArray(sql<number>`(${feedbackAuditEventsTable.afterState}->>'snapshotEventId')::integer`,currentSnapshotIds))).orderBy(feedbackAuditEventsTable.id):[];
  const telegramConfig=getTelegramProductConfig();const recipientIds=telegramConfig.configured?await eligibleFeedbackTelegramRecipientIds():[];
  const telegramByFeedback=new Map<number,ReturnType<typeof aggregateFeedbackTelegramDelivery>>();for(const feedbackId of feedbackIds){const snapshot=snapshotByFeedback.get(feedbackId);telegramByFeedback.set(feedbackId,aggregateFeedbackTelegramDelivery(snapshot?.id??null,recipientIds,telegramEvents.filter(event=>event.feedbackId===feedbackId).flatMap(event=>normalizeTelegramEvents([{id:event.id,afterState:event.afterState}]))));}
  const alertEvents=feedbackIds.length?await db.select({feedbackId:feedbackAuditEventsTable.feedbackId,eventType:feedbackAuditEventsTable.eventType,afterState:feedbackAuditEventsTable.afterState,createdAt:feedbackAuditEventsTable.createdAt}).from(feedbackAuditEventsTable).where(and(inArray(feedbackAuditEventsTable.feedbackId,feedbackIds),inArray(feedbackAuditEventsTable.eventType,["submission_notification_outbox_settled","submission_notification_delivery_failed"]))).orderBy(desc(feedbackAuditEventsTable.id)):[];
  const alertByFeedback=new Map<number,{state:string;reasonCode:string|null;reconciledAt:string}>();for(const event of alertEvents)if(!alertByFeedback.has(event.feedbackId)){const state=event.afterState as Record<string,unknown>|null;alertByFeedback.set(event.feedbackId,{state:event.eventType==="submission_notification_delivery_failed"?"retry-required":String(state?.state||"unknown"),reasonCode:typeof state?.reasonCode==="string"?state.reasonCode:event.eventType==="submission_notification_delivery_failed"?"notification-write-failed":null,reconciledAt:event.createdAt.toISOString()});}
  const evidence = new Map<number, { total: number; clean: number; quarantined: number; rejected: number }>();
  for (const asset of assets) { const current = evidence.get(asset.feedbackId) || { total: 0, clean: 0, quarantined: 0, rejected: 0 }; current.total += 1; if (asset.scanState === "clean") current.clean += 1; else if (asset.scanState === "rejected") current.rejected += 1; else current.quarantined += 1; evidence.set(asset.feedbackId, current); }
  return res.json({ feedback: rows.map(row => { const counts = evidence.get(row.id) || { total: 0, clean: 0, quarantined: 0, rejected: 0 },snapshot=snapshotByFeedback.get(row.id),telegram=telegramByFeedback.get(row.id)!,reviewerAlert=alertByFeedback.get(row.id)||{state:"pending",reasonCode:null,reconciledAt:""}; return { ...row, evidence: counts, packageState: counts.total === 0 ? "metadata-only" : counts.clean === counts.total ? "ready" : counts.rejected > 0 ? "rejected-evidence" : "awaiting-scan",packageSnapshot:packageSnapshotDto(snapshot?.state),reviewerAlertState:reviewerAlert.state,reviewerAlert,telegramDeliveryState:telegram.overallState,telegramDelivery:telegram,reviewUrl:`/admin?tab=feedback&feedback=${encodeURIComponent(row.stableId)}` }; }) });
});

router.get("/feedback/admin/:id/detail", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const [feedback] = await db.select({ id: feedbackItemsTable.id, stableId: feedbackItemsTable.stableId, status: feedbackItemsTable.status, version: feedbackItemsTable.version, ownerUserId: feedbackItemsTable.ownerUserId, targetRelease: feedbackItemsTable.targetRelease, dispositionReason: feedbackItemsTable.dispositionReason, createdAt: feedbackItemsTable.createdAt, updatedAt: feedbackItemsTable.updatedAt }).from(feedbackItemsTable).where(eq(feedbackItemsTable.id, id)).limit(1);
  if (!feedback) return res.status(404).json({ code: "FEEDBACK_NOT_FOUND", error: "Feedback not found" });
  const assets = await db.select({ id: feedbackAssetsTable.id, kind: feedbackAssetsTable.kind, name: feedbackAssetsTable.safeName, mediaType: feedbackAssetsTable.mediaType, byteSize: feedbackAssetsTable.byteSize, sha256: feedbackAssetsTable.sha256, scanState: feedbackAssetsTable.scanState, scannerAdapter: feedbackAssetsTable.scannerAdapter, scannedAt: feedbackAssetsTable.scannedAt, createdAt: feedbackAssetsTable.createdAt }).from(feedbackAssetsTable).where(eq(feedbackAssetsTable.feedbackId, id)).orderBy(feedbackAssetsTable.createdAt, feedbackAssetsTable.id);
  const history = await db.select({ id: feedbackAuditEventsTable.id, eventType: feedbackAuditEventsTable.eventType, afterState: feedbackAuditEventsTable.afterState, reason: feedbackAuditEventsTable.reason, createdAt: feedbackAuditEventsTable.createdAt }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, id),sql`${feedbackAuditEventsTable.eventType} NOT IN ('evidence_scan_started','evidence_scan_failed')`)).orderBy(feedbackAuditEventsTable.createdAt, feedbackAuditEventsTable.id).limit(FEEDBACK_PACKAGE_MAX_EVENTS);
  const scanResult=await db.execute(sql`SELECT DISTINCT ON (after_state->>'assetId') id,event_type,after_state,created_at FROM feedback_audit_events WHERE feedback_id=${id} AND event_type IN ('evidence_scan_started','evidence_scan_failed','evidence_scan_clean','evidence_scan_rejected') AND after_state ? 'assetId' ORDER BY after_state->>'assetId',id DESC`);const scanEvents=scanResult.rows.map((event:any)=>({id:Number(event.id),eventType:String(event.event_type),afterState:event.after_state,createdAt:event.created_at instanceof Date?event.created_at:new Date(String(event.created_at))}));
  const latestScanByAsset=new Map<number,typeof scanEvents[number]>();for(const event of scanEvents){const state=event.afterState as Record<string,unknown>|null,assetId=Number(state?.assetId);if(Number.isSafeInteger(assetId)&&assetId>0&&!latestScanByAsset.has(assetId))latestScanByAsset.set(assetId,event);}const scanFailures=[...latestScanByAsset.values()].map(reviewerScanFailureProjection).filter((failure):failure is NonNullable<ReturnType<typeof reviewerScanFailureProjection>>=>!!failure);
  const packageSnapshot=packageSnapshotDto(await latestPackageSnapshot(id,"internal"));
  return res.json({ feedback, assets, history, scanFailures, packageState: assets.length === 0 ? "metadata-only" : assets.every(asset => asset.scanState === "clean" && asset.scannedAt) ? "ready" : assets.some(asset => asset.scanState === "rejected") ? "rejected-evidence" : "awaiting-scan",packageSnapshot });
});

router.get("/feedback/admin/export.csv", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const reason = bounded(req.get("X-Export-Reason"), 500); if (!reason) return res.status(400).json({ code: "FEEDBACK_EXPORT_REASON_REQUIRED", error: "An export reason is required" });
  const rows = await db.select().from(feedbackItemsTable).orderBy(desc(feedbackItemsTable.createdAt)).limit(5000);
  const header = ["Feedback ID", "Created", "Type", "Priority", "State", "Module", "Description", "Target release", "Decision reason", "Customer visible"];
  const lines = [header.map(csvCell).join(","), ...rows.map(row => [row.stableId, row.createdAt.toISOString(), row.feedbackType, row.priority, row.status, row.module, row.message, row.targetRelease, row.dispositionReason, row.customerVisible].map(csvCell).join(","))];
  if (rows.length) await db.insert(feedbackAuditEventsTable).values(rows.map(row => ({ feedbackId: row.id, actorUserId: req.user!.userId, eventType: "admin_exported", afterState: { scope: "all", release: FEEDBACK_RELEASE }, reason })));
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=feedback-review-v1.60.35.11-F.csv");
  return res.send(`\uFEFF${lines.join("\r\n")}\r\n`);
});

router.get("/feedback/admin/follow-up.csv", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const reason = bounded(req.get("X-Export-Reason"), 500); if (!reason) return res.status(400).json({ code: "FEEDBACK_EXPORT_REASON_REQUIRED", error: "An export reason is required" });
  const rows = await loadFeedbackFollowUpRows();
  const feedbackIds = rows.map(row => Number(row.id)).filter(Number.isInteger); if (feedbackIds.length) await db.insert(feedbackAuditEventsTable).values(feedbackIds.map(feedbackId => ({ feedbackId, actorUserId: req.user!.userId, eventType: "admin_follow_up_exported", afterState: { scope: "postgresql-register", release: FEEDBACK_RELEASE }, reason })));
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=feedback-follow-up-v1.60.35.11-F.csv"); return res.send(buildFeedbackFollowUpCsv(rows,publicBaseUrl()));
});

router.get("/feedback/admin/operations-status", authMiddleware, isSuperAdminMiddleware, async (_req, res) => {
  const storageHealth = await storage.health(),telegram=telegramProductHealth(),scanBackfill=await feedbackScanBackfillProgress(),eligibleTelegramRecipients=await eligibleFeedbackTelegramRecipientIds();
  const scanEvents=await db.execute(sql`SELECT max(created_at) FILTER(WHERE event_type IN ('evidence_scan_clean','evidence_scan_rejected')) last_success_at,max(created_at) FILTER(WHERE event_type='evidence_scan_failed') last_failure_at,count(*) FILTER(WHERE event_type='evidence_scan_failed' AND created_at>=now()-interval '1 hour')::integer recent_failures FROM feedback_audit_events`);
  const notifications=await db.execute(sql`SELECT count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM feedback_audit_events e WHERE e.feedback_id=f.id AND e.event_type='internal_reviewer_notifications_created'))::integer pending,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM feedback_audit_events e WHERE e.feedback_id=f.id AND e.event_type='submission_notification_outbox_settled' AND e.after_state->>'state'='blocked'))::integer blocked,extract(epoch FROM now()-min(f.created_at) FILTER(WHERE NOT EXISTS(SELECT 1 FROM feedback_audit_events e WHERE e.feedback_id=f.id AND e.event_type='internal_reviewer_notifications_created')))::integer oldest_pending_age_seconds FROM feedback_items f`);
  const telegramAttempts=await db.execute(sql`WITH latest AS(SELECT DISTINCT ON (after_state->>'snapshotEventId',after_state->>'recipientUserId',after_state->>'artifactKind') after_state,created_at FROM feedback_audit_events WHERE event_type='feedback_telegram_delivery' ORDER BY after_state->>'snapshotEventId',after_state->>'recipientUserId',after_state->>'artifactKind',id DESC) SELECT count(*) FILTER(WHERE after_state->>'state'='failed')::integer failed,count(*) FILTER(WHERE after_state->>'state'='unknown')::integer manual_review,count(*) FILTER(WHERE after_state->>'state'='sending')::integer sending,count(*) FILTER(WHERE after_state->>'state'='sent')::integer sent,min(created_at) FILTER(WHERE after_state->>'state' IN ('failed','unknown')) oldest_actionable_at FROM latest`);
  const scanRow=scanEvents.rows[0] as Record<string,unknown>|undefined,notificationRow=notifications.rows[0] as Record<string,unknown>|undefined,telegramRow=telegramAttempts.rows[0] as Record<string,unknown>|undefined;
  return res.json({
    storage: { backend: storageHealth.backendId, location: storageHealth.backendType === "replit-app-storage" && storageHealth.backendId === "bimlog-feedback-replit" ? "Private Replit App Storage bucket bimlog-feedback-temporary" : `Private ${storageHealth.backendType} backend ${storageHealth.backendId}`, metadataAuthority: "PostgreSQL", healthy: storageHealth.healthy, capabilities: storageHealth.capabilities, maxReadBytes: storageHealth.maxReadBytes },
    scanner: { configured: process.env.BIMLOG_FEEDBACK_SCANNER === "clamav-cli", mode: process.env.BIMLOG_FEEDBACK_SCANNER === "clamav-cli" ? "governed-clamav" : "quarantine-only",state:process.env.BIMLOG_FEEDBACK_SCANNER!=="clamav-cli"?"not-configured":scanBackfill.manualReview>0?"manual-review":scanBackfill.eligible>0||scanBackfill.deferred>0?"processing-backlog":"ready",backfill:scanBackfill,lastSuccessfulScanAt:scanRow?.last_success_at||null,lastFailureAt:scanRow?.last_failure_at||null,recentFailures:Number(scanRow?.recent_failures||0) },
    reviewerNotifications:{state:Number(notificationRow?.pending||0)>0?"reconciling":"settled",pending:Number(notificationRow?.pending||0),blocked:Number(notificationRow?.blocked||0),oldestPendingAgeSeconds:notificationRow?.oldest_pending_age_seconds==null?null:Number(notificationRow.oldest_pending_age_seconds)},
    telegramDocuments: { configured: telegram.configured, mode: telegram.configured ? "explicit-opt-in-feedback-package-delivery" : "not-configured",eligibleRecipients:eligibleTelegramRecipients.length,sent:Number(telegramRow?.sent||0),sending:Number(telegramRow?.sending||0),failed:Number(telegramRow?.failed||0),manualReview:Number(telegramRow?.manual_review||0),oldestActionableAt:telegramRow?.oldest_actionable_at||null },
    permanentComputerReceiver: { connected: false, root: "F:\\BIMLog\\Feedback", state: "not-mounted", explanation: "Replit cannot write to a private Windows drive until the governed receiver has a reachable TLS endpoint." },
    release: FEEDBACK_RELEASE,
  });
});

router.get("/feedback/admin/follow-up.xlsx", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const reason = bounded(req.get("X-Export-Reason"), 500); if (!reason) return res.status(400).json({ code: "FEEDBACK_EXPORT_REASON_REQUIRED", error: "An export reason is required" });
  const rows = await loadFeedbackFollowUpRows(), bytes = buildFeedbackFollowUpWorkbook(rows,publicBaseUrl());
  const feedbackIds = rows.map(row => Number(row.id)).filter(Number.isInteger); if (feedbackIds.length) await db.insert(feedbackAuditEventsTable).values(feedbackIds.map(feedbackId => ({ feedbackId, actorUserId: req.user!.userId, eventType: "admin_follow_up_exported", afterState: { scope: "postgresql-register-xlsx", release: FEEDBACK_RELEASE }, reason })));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", "attachment; filename=bimlog-feedback-follow-up.xlsx"); res.setHeader("X-Content-Type-Options", "nosniff"); return res.send(bytes);
});

router.post("/feedback/admin/:id/events",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const user=req.user!,id=asId(req.params.id),responseType=bounded(req.body.responseType,20),visibility=bounded(req.body.visibility,20),message=bounded(req.body.message,8000),idempotencyKey=bounded(req.get("Idempotency-Key"),120);
  if(!id||!message||!idempotencyKey||!FEEDBACK_STAFF_RESPONSE_TYPES.has(responseType)||!["customer","internal"].includes(visibility))return res.status(400).json({code:"FEEDBACK_RESPONSE_INVALID",error:"Feedback, response type, visibility, message, and idempotency key are required"});
  const requestHash=createHash("sha256").update(JSON.stringify({id,responseType,visibility,message})).digest("hex"),eventType=visibility==="customer"?`staff_${responseType}`:"internal_note";
  const outcome=await db.transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback-response:${id}:${idempotencyKey}`},0))`);const [feedback]=await tx.select({id:feedbackItemsTable.id,stableId:feedbackItemsTable.stableId,userId:feedbackItemsTable.userId,projectId:feedbackItemsTable.projectId,customerVisible:feedbackItemsTable.customerVisible,email:usersTable.email,preferences:usersTable.notificationPreferences}).from(feedbackItemsTable).innerJoin(usersTable,eq(feedbackItemsTable.userId,usersTable.id)).where(eq(feedbackItemsTable.id,id)).limit(1);if(!feedback)return {status:404,code:"FEEDBACK_NOT_FOUND",error:"Feedback not found"} as const;const [prior]=await tx.select().from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId,id),sql`${feedbackAuditEventsTable.afterState}->>'idempotencyKey'=${idempotencyKey}`)).limit(1);if(prior){const state=prior.afterState as Record<string,unknown>;if(state.requestHash!==requestHash)return {status:409,code:"FEEDBACK_RESPONSE_IDEMPOTENCY_CONFLICT",error:"This idempotency key belongs to another response"} as const;const [delivery]=await tx.select({afterState:feedbackAuditEventsTable.afterState}).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId,id),eq(feedbackAuditEventsTable.eventType,"customer_notification_delivery"),sql`${feedbackAuditEventsTable.afterState}->>'sourceEventId'=${String(prior.id)}`,sql`${feedbackAuditEventsTable.afterState}->>'channel'='email_copy'`)).orderBy(desc(feedbackAuditEventsTable.id)).limit(1);const deliveryState=String((delivery?.afterState as Record<string,unknown>|undefined)?.state||"disabled"),retryEmail=visibility==="customer"&&feedbackEmailCopyEnabled(feedback.preferences)&&deliveryState!=="sent";return {status:200,event:prior,replayed:true,email:retryEmail?{to:feedback.email,stableId:feedback.stableId,responseType,message}:null,emailState:deliveryState} as const;}
    if(visibility==="customer"&&!feedback.customerVisible)return {status:409,code:"FEEDBACK_CUSTOMER_VISIBILITY_DISABLED",error:"Customer-visible responses require customer visibility"} as const;const [event]=await tx.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:user.userId,eventType,reason:message,afterState:{responseType,visibility,idempotencyKey,requestHash,release:FEEDBACK_RELEASE,deliveryState:visibility==="customer"?"pending":"internal-only"}}).returning();if(visibility==="internal")return {status:201,event,replayed:false,email:null,emailState:"disabled"} as const;
    const [notification]=await tx.insert(notificationsTable).values({userId:feedback.userId,projectId:feedback.projectId,type:`feedback_${responseType}`,title:`Feedback ${feedback.stableId}: ${responseType}`,message,actionUrl:"/feedback?view=mine"}).returning({id:notificationsTable.id});await tx.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:user.userId,eventType:"customer_notification_delivery",afterState:{sourceEventId:event.id,notificationId:notification.id,channel:"in_app",state:"created",idempotencyKey:`notify:${event.id}`}});
    const emailEnabled=feedbackEmailCopyEnabled(feedback.preferences);await tx.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:user.userId,eventType:"customer_notification_delivery",afterState:{sourceEventId:event.id,channel:"email_copy",state:emailEnabled?"queued":"disabled",idempotencyKey:`email:${event.id}`,provider:emailEnabled?"approved-sendgrid":null}});return {status:201,event,replayed:false,email:emailEnabled?{to:feedback.email,stableId:feedback.stableId,responseType,message}:null,emailState:emailEnabled?"queued":"disabled"} as const;});
  if("code" in outcome)return res.status(outcome.status).json({code:outcome.code,error:outcome.error});let emailCopy=outcome.emailState;if(outcome.email){emailCopy=await sendEmail({to:outcome.email.to,subject:`BIMLog feedback ${outcome.email.stableId}: ${outcome.email.responseType}`,html:feedbackEmailCopyHtml(outcome.email.stableId,outcome.email.responseType,outcome.email.message,`${publicBaseUrl()}/feedback?view=mine`),triggerType:"feedback_customer_copy"});await db.insert(feedbackAuditEventsTable).values({feedbackId:id,actorUserId:user.userId,eventType:"customer_notification_delivery",afterState:{sourceEventId:outcome.event.id,channel:"email_copy",state:emailCopy,idempotencyKey:`email-result:${outcome.event.id}:${emailCopy}`,provider:"approved-sendgrid"}});}return res.status(outcome.status).json({event:{id:outcome.event.id,type:outcome.event.eventType,message:outcome.event.reason,createdAt:outcome.event.createdAt},replayed:outcome.replayed,emailCopy});
});

router.patch("/feedback/admin/:id", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const user = req.user!; const id = asId(req.params.id), observedVersion = asId(req.body.observedVersion);
  if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback-admin:${id}`},0))`);const [before]=await tx.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id,id)).limit(1);if(!before)return {error:"FEEDBACK_NOT_FOUND",status:404,message:"Feedback not found"} as const;if(observedVersion!==before.version)return {error:"FEEDBACK_STALE",status:409,message:"Feedback changed; reload before updating"} as const;
    const status=bounded(req.body.status||before.status,32),reason=bounded(req.body.reason,2000);if(!STATUSES.has(status))return {error:"FEEDBACK_STATUS_INVALID",status:400,message:"Invalid feedback status"} as const;if(status!==before.status&&!TRANSITIONS[before.status]?.has(status))return {error:"FEEDBACK_TRANSITION_INVALID",status:409,message:"This state transition is not allowed"} as const;if((TERMINAL.has(status)||status==="blocked")&&!reason)return {error:"FEEDBACK_REASON_REQUIRED",status:400,message:"A reason is required for this state"} as const;
    const [row] = await tx.update(feedbackItemsTable).set({ status, dispositionReason: reason || before.dispositionReason, ownerUserId: req.body.claimToMe === true ? user.userId : before.ownerUserId,
      targetRelease: bounded(req.body.targetRelease, 80) || before.targetRelease, customerVisible: req.body.customerVisible === undefined ? before.customerVisible : req.body.customerVisible === true,
      version: before.version + 1, updatedAt: new Date(), resolvedAt: TERMINAL.has(status) ? new Date() : null })
      .where(and(eq(feedbackItemsTable.id, id), eq(feedbackItemsTable.version, observedVersion))).returning();
    if (!row) return null;
    const changes=[];if(row.ownerUserId!==before.ownerUserId)changes.push("owner");if(row.status!==before.status)changes.push("status");if(row.targetRelease!==before.targetRelease)changes.push("targetRelease");if(row.customerVisible!==before.customerVisible)changes.push("customerVisible");if(row.dispositionReason!==before.dispositionReason)changes.push("dispositionReason");
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: TERMINAL.has(before.status) && status === "triaged" ? "reopened" : changes.length===1&&changes[0]==="owner" ? "claimed" : "triage_updated", beforeState: { status: before.status, version: before.version, ownerUserId: before.ownerUserId, targetRelease: before.targetRelease, dispositionReason: before.dispositionReason, customerVisible: before.customerVisible }, afterState: { status: row.status, version: row.version, ownerUserId: row.ownerUserId, targetRelease: row.targetRelease, dispositionReason: row.dispositionReason, customerVisible: row.customerVisible, changes, release: FEEDBACK_RELEASE }, reason: reason || null });
    return row;
  });
  if (!updated) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before updating" });
  if("error" in updated)return res.status(updated.status).json({code:updated.error,error:updated.message});
  return res.json({ success: true, feedback: { ...customerFeedbackDto(updated), ownerUserId: updated.ownerUserId, dispositionReason: updated.dispositionReason, customerVisible: updated.customerVisible } });
});

export default router;
