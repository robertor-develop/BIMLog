import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { feedbackAssetsTable, feedbackAuditEventsTable, feedbackCaptureConsentsTable, feedbackItemsTable, feedbackTranscriptionJobsTable } from "../../../../lib/db/src/schema/feedback-items";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { boundedMultipart, createMemoryUpload } from "../middlewares/multipart";
import { storage } from "../lib/storage-adapter";
import { FEEDBACK_MAX_FILE_BYTES, inspectFeedbackEvidence } from "../lib/feedback-evidence-contract";

const router = Router();
const upload = boundedMultipart(createMemoryUpload({ fileSize: FEEDBACK_MAX_FILE_BYTES, files: 1, fields: 4, parts: 5 }).array("files", 1));
const TYPES = new Set(["bug", "workflow", "idea", "question", "other"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["new", "triaged", "accepted", "in_progress", "blocked", "fixed", "verified", "rejected", "deferred"]);
const TERMINAL = new Set(["verified", "rejected", "deferred"]);
const CAPTURE_NOTICE_VERSION = "feedback-capture-v1";
const localFixture = (value: string | undefined, expected: string) => process.env.NODE_ENV !== "production" && process.env.BIMLOG_FEEDBACK_ALLOW_LOCAL_FIXTURES === "true" && value === expected;
const TRANSITIONS: Record<string, Set<string>> = {
  new: new Set(["triaged", "rejected"]), triaged: new Set(["accepted", "deferred", "rejected"]),
  accepted: new Set(["in_progress", "blocked", "deferred"]), in_progress: new Set(["blocked", "fixed"]),
  blocked: new Set(["in_progress", "deferred"]), fixed: new Set(["verified", "in_progress"]),
  verified: new Set(["triaged"]), rejected: new Set(["triaged"]), deferred: new Set(["triaged"]),
};

const asId = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
const bounded = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const sanitizedPageUrl = (value: unknown) => {
  try { const url = new URL(bounded(value, 2048), "http://bimlog.local"); return `${url.origin === "http://bimlog.local" ? "" : url.origin}${url.pathname}`.slice(0, 2048) || "/"; }
  catch { return ""; }
};
type CustomerFeedbackRow = Pick<typeof feedbackItemsTable.$inferSelect, "id" | "stableId" | "projectId" | "feedbackType" | "priority" | "module" | "pageUrl" | "message" | "status" | "version" | "targetRelease" | "dispositionReason" | "createdAt" | "updatedAt" | "resolvedAt">;
const customerFeedbackDto = (row: CustomerFeedbackRow) => ({
  id: row.id, stableId: row.stableId, projectId: row.projectId, feedbackType: row.feedbackType, priority: row.priority,
  module: row.module, pageUrl: sanitizedPageUrl(row.pageUrl), message: row.message, status: row.status, version: row.version,
  targetRelease: row.targetRelease, dispositionReason: row.dispositionReason, createdAt: row.createdAt,
  updatedAt: row.updatedAt, resolvedAt: row.resolvedAt,
});
const customerEventState = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const allowed = ["status", "version", "count", "scanState", "reviewState"];
  return Object.fromEntries(allowed.filter(key => key in source).map(key => [key, source[key]]));
};
const CUSTOMER_EVENT_TYPES = new Set(["created", "assets_added", "transcription_requested", "transcription_reviewed", "triage_updated", "reopened"]);
const transcriptionDto = (row: typeof feedbackTranscriptionJobsTable.$inferSelect) => ({ id: row.id, state: row.state, result: row.result, errorCode: row.errorCode, reviewState: row.reviewState, createdAt: row.createdAt, completedAt: row.completedAt });
function boundedTransformation(value: unknown) { try { const source = JSON.parse(bounded(value, 2000)) as Record<string, unknown>; if (!source || typeof source !== "object" || Array.isArray(source)) return null; const allowed = ["origin", "sourceName", "sourceSha256", "originalWidth", "originalHeight", "capturedAt", "cropPercent", "cropPixels", "outputWidth", "outputHeight", "transformedAt"]; return Object.fromEntries(allowed.filter(key => key in source).map(key => [key, source[key]])); } catch { return null; } }
async function projectAuthorized(projectId: number | null, user: NonNullable<Express.Request["user"]>, companyId: number) {
  if (!projectId) return true;
  const [project] = await db.select({ id: projectsTable.id, companyId: usersTable.companyId }).from(projectsTable)
    .innerJoin(usersTable, eq(projectsTable.createdById, usersTable.id)).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.companyId !== companyId) return false;
  if (user.isSuperAdmin) return true;
  const [member] = await db.select({ id: projectMembersTable.id }).from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.userId), eq(projectMembersTable.status, "active"))).limit(1);
  return !!member;
}
async function accessible(id: number, user: NonNullable<Express.Request["user"]>) {
  const [row] = await db.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id, id)).limit(1);
  if (!row) return null;
  if (user.isSuperAdmin) return row;
  const [actor] = await db.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
  if (!actor || !row.companyId || actor.companyId !== row.companyId || row.userId !== user.userId || !row.customerVisible) return null;
  if (row.projectId && !await projectAuthorized(row.projectId, { ...user, isSuperAdmin: false }, actor.companyId)) return null;
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
    const [actor] = await db.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
    if (!actor?.companyId) return res.status(403).json({ code: "COMPANY_ACCESS_DENIED", error: "Current company authority is required" });
    if (!await projectAuthorized(projectId, user, actor.companyId)) return res.status(403).json({ code: "PROJECT_ACCESS_DENIED", error: "You do not have access to this project" });
    const requestHash = createHash("sha256").update(JSON.stringify({ feedbackType, priority, message, moduleName, pageUrl, projectId, companyId: actor.companyId })).digest("hex");
    if (idempotencyKey) {
      const [prior] = await db.select().from(feedbackItemsTable).where(and(eq(feedbackItemsTable.userId, user.userId), eq(feedbackItemsTable.idempotencyKey, idempotencyKey))).limit(1);
      if (prior) return prior.requestHash === requestHash ? res.json({ success: true, replayed: true, feedback: customerFeedbackDto(prior) }) : res.status(409).json({ code: "FEEDBACK_IDEMPOTENCY_CONFLICT", error: "This idempotency key belongs to different feedback" });
    }
    let created;
    try {
      created = await db.transaction(async tx => {
        const [row] = await tx.insert(feedbackItemsTable).values({ userId: user.userId, companyId: actor.companyId, projectId, feedbackType, priority, module: moduleName || null, pageUrl, message,
          status: "new", stableId: `FB-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, idempotencyKey, requestHash,
          metadata: { build: "v F-1.60.35.8", userAgent: bounded(req.get("user-agent"), 512), viewport: bounded(req.body.metadata?.viewport, 32), language: bounded(req.body.metadata?.language, 24) } }).returning();
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.id, actorUserId: user.userId, eventType: "created", afterState: { status: "new", version: 1 } });
        return row;
      });
    } catch (cause) {
      if (idempotencyKey) {
        const [winner] = await db.select().from(feedbackItemsTable).where(and(eq(feedbackItemsTable.userId, user.userId), eq(feedbackItemsTable.idempotencyKey, idempotencyKey))).limit(1);
        if (winner) return winner.requestHash === requestHash ? res.json({ success: true, replayed: true, feedback: customerFeedbackDto(winner) }) : res.status(409).json({ code: "FEEDBACK_IDEMPOTENCY_CONFLICT", error: "This idempotency key belongs to different feedback" });
      }
      throw cause;
    }
    return res.status(201).json({ success: true, replayed: false, feedback: customerFeedbackDto(created) });
  } catch (error) { console.error("[feedback] create failed", error instanceof Error ? error.name : "unknown"); return res.status(500).json({ code: "FEEDBACK_CREATE_FAILED", error: "Failed to submit feedback" }); }
});

router.post("/feedback/capture-consents", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const captureKind = bounded(req.body.captureKind, 20), purpose = bounded(req.body.purpose, 240);
  if (!["audio", "screenshot"].includes(captureKind) || !purpose || req.body.accepted !== true) return res.status(400).json({ code: "CAPTURE_CONSENT_INVALID", error: "Explicit capture consent, kind, and purpose are required" });
  const id = randomUUID(); const [consent] = await db.insert(feedbackCaptureConsentsTable).values({ id, actorUserId: user.userId, captureKind, purpose, noticeVersion: CAPTURE_NOTICE_VERSION }).returning();
  return res.status(201).json({ consent: { id: consent.id, captureKind, purpose, noticeVersion: consent.noticeVersion, grantedAt: consent.grantedAt } });
});

router.post("/feedback/capture-consents/:id/revoke", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = bounded(req.params.id, 80); const consent = await db.transaction(async tx => { const [row] = await tx.update(feedbackCaptureConsentsTable).set({ revokedAt: new Date() }).where(and(eq(feedbackCaptureConsentsTable.id, id), eq(feedbackCaptureConsentsTable.actorUserId, user.userId), sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).returning(); if (row?.feedbackId) await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.feedbackId, actorUserId: user.userId, eventType: "capture_consent_revoked", afterState: { captureKind: row.captureKind, noticeVersion: row.noticeVersion } }); return row; });
  if (!consent) return res.status(404).json({ code: "CAPTURE_CONSENT_NOT_FOUND", error: "Capture consent not found" });
  return res.json({ revoked: true });
});

router.post("/feedback/:id/assets", authMiddleware, upload, async (req, res) => {
  const stored: string[] = [];
  try {
    const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
    const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
    const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_WRITE_DENIED", error: "You cannot add files to this feedback" });
    const files = Array.isArray(req.files) ? req.files : [], requestedKind = bounded(req.body.kind || "attachment", 20), uploadKey = bounded(req.get("Idempotency-Key"), 120);
    if (!files.length || files.length !== 1 || !uploadKey || !["attachment", "screenshot", "audio"].includes(requestedKind)) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "One supported file and a per-file idempotency key are required" });
    const inspected = inspectFeedbackEvidence(files[0]); const mediaClass = inspected.mediaType.startsWith("audio/") ? "audio" : inspected.mediaType.startsWith("image/") ? "image" : "document";
    if ((requestedKind === "audio" && mediaClass !== "audio") || (requestedKind === "screenshot" && mediaClass !== "image") || (requestedKind === "attachment" && mediaClass === "audio")) return res.status(415).json({ code: "FEEDBACK_ASSET_KIND_MISMATCH", error: "Asset kind does not match inspected media" });
    const kind = requestedKind;
    const consentId = bounded(req.body.consentId, 80); let captureConsent: typeof feedbackCaptureConsentsTable.$inferSelect | undefined;
    if (["audio", "screenshot"].includes(kind)) {
      [captureConsent] = await db.select().from(feedbackCaptureConsentsTable).where(and(eq(feedbackCaptureConsentsTable.id, consentId), eq(feedbackCaptureConsentsTable.actorUserId, user.userId), eq(feedbackCaptureConsentsTable.captureKind, kind))).limit(1);
      if (!captureConsent || captureConsent.revokedAt || (captureConsent.feedbackId && captureConsent.feedbackId !== id)) return res.status(403).json({ code: "FEEDBACK_CAPTURE_CONSENT_REQUIRED", error: "Active matching capture consent is required" });
    }
    const transformations = (() => { try { const parsed = JSON.parse(bounded(req.body.transformations, 12000)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } })();
    const requestHash = createHash("sha256").update(JSON.stringify({ feedbackId: id, actorId: user.userId, kind, sha256: inspected.sha256, transformation: transformations[uploadKey] ?? null })).digest("hex");
    const [prior] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.feedbackId, id), sql`${feedbackAssetsTable.provenance}->>'uploadRequestKey' = ${uploadKey}`)).limit(1);
    if (prior) return (prior.provenance?.uploadRequestHash === requestHash) ? res.json({ replayed: true, assets: [{ id: prior.id, kind: prior.kind, name: prior.safeName, mediaType: prior.mediaType, byteSize: prior.byteSize, sha256: prior.sha256, scanState: prior.scanState }] }) : res.status(409).json({ code: "FEEDBACK_ASSET_IDEMPOTENCY_CONFLICT", error: "This upload key belongs to different evidence" });
    const pending: Array<{ storagePath: string; checked: ReturnType<typeof inspectFeedbackEvidence>; file: Express.Multer.File }> = [];
    for (const file of files) {
      const checked = inspectFeedbackEvidence(file), storagePath = await storage.upload(file.buffer, feedback.projectId ?? `feedback-${id}`, checked.name); stored.push(storagePath); pending.push({ storagePath, checked, file });
    }
    const scannerAdapter = localFixture(process.env.BIMLOG_FEEDBACK_SCANNER, "fixture-clean") ? "local-fixture" : "default-deny";
    const scanState = scannerAdapter === "local-fixture" ? "clean" : "quarantined";
    const results = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${user.userId}:${uploadKey}`}, 0))`);
      const [winner] = await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.feedbackId, id), sql`${feedbackAssetsTable.provenance}->>'uploadRequestKey' = ${uploadKey}`)).limit(1);
      if (winner) { if (winner.provenance?.uploadRequestHash !== requestHash) throw Object.assign(new Error("This upload key belongs to different evidence"), { status: 409, code: "FEEDBACK_ASSET_IDEMPOTENCY_CONFLICT" }); return [{ id: winner.id, kind: winner.kind, name: winner.safeName, mediaType: winner.mediaType, byteSize: winner.byteSize, sha256: winner.sha256, scanState: winner.scanState, replayed: true }]; }
      const rows = [];
      for (const item of pending) {
        const [asset] = await tx.insert(feedbackAssetsTable).values({ feedbackId: id, projectId: feedback.projectId, uploadedById: user.userId, kind,
          originalName: bounded(item.file.originalname, 255), safeName: item.checked.name, mediaType: item.checked.mediaType, byteSize: item.file.size,
          sha256: item.checked.sha256, storagePath: item.storagePath, scanState, scannerAdapter, scannedAt: scanState === "clean" ? new Date() : null,
          provenance: { source: kind === "screenshot" ? "browser-display-capture" : kind === "audio" ? "browser-microphone" : "user-file-import", uploadRequestKey: uploadKey, uploadRequestHash: requestHash, consentId: captureConsent?.id || null, consentNoticeVersion: captureConsent?.noticeVersion || null, purpose: captureConsent?.purpose || null, actorUserId: user.userId, grantedAt: captureConsent?.grantedAt?.toISOString() || null, receivedAt: new Date().toISOString(), transformation: boundedTransformation(JSON.stringify(transformations[uploadKey] ?? null)) } }).returning();
        rows.push({ id: asset.id, kind, name: asset.safeName, mediaType: asset.mediaType, byteSize: asset.byteSize, sha256: asset.sha256, scanState });
      }
      await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "assets_added", afterState: { count: rows.length, scannerAdapter, scanState } });
      if (captureConsent && !captureConsent.feedbackId) await tx.update(feedbackCaptureConsentsTable).set({ feedbackId: id }).where(eq(feedbackCaptureConsentsTable.id, captureConsent.id));
      return rows;
    });
    const replayed = results.some(row => "replayed" in row && row.replayed === true);
    return res.status(replayed ? 200 : 201).json({ replayed, assets: results.map(row => ({ id: row.id, kind: row.kind, name: row.name, mediaType: row.mediaType, byteSize: row.byteSize, sha256: row.sha256, scanState: row.scanState })), scanner: scannerAdapter === "local-fixture" ? "local-fixture" : "activation-required" });
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
  const id = asId(req.params.id), assetId = asId(req.body.assetId); if (!id || !assetId) return res.status(400).json({ code: "TRANSCRIPTION_INPUT_INVALID", error: "Feedback and audio asset are required" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "TRANSCRIPTION_DENIED", error: "Transcription is not authorized" });
  const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, assetId), eq(feedbackAssetsTable.feedbackId, id))).limit(1);
  if (!asset || asset.kind !== "audio") return res.status(404).json({ code: "AUDIO_ASSET_NOT_FOUND", error: "Audio asset not found" });
  if (asset.scanState !== "clean") return res.status(423).json({ code: "AUDIO_ASSET_QUARANTINED", error: "Audio must pass governed scanning before transcription" });
  const consentId = bounded(req.body.consentId, 80), requestKey = bounded(req.get("Idempotency-Key"), 120);
  if (!consentId || !requestKey) return res.status(400).json({ code: "TRANSCRIPTION_CONSENT_REQUIRED", error: "Capture consent and idempotency key are required" });
  const [consent] = await db.select().from(feedbackCaptureConsentsTable).where(and(eq(feedbackCaptureConsentsTable.id, consentId), eq(feedbackCaptureConsentsTable.actorUserId, user.userId), eq(feedbackCaptureConsentsTable.captureKind, "audio"), eq(feedbackCaptureConsentsTable.feedbackId, id))).limit(1);
  if (!consent || consent.revokedAt) return res.status(403).json({ code: "TRANSCRIPTION_CONSENT_INVALID", error: "Active linked audio consent is required" });
  const fixture = localFixture(process.env.BIMLOG_FEEDBACK_TRANSCRIPTION_ADAPTER, "local-fixture");
  const provider = fixture ? "local-fixture" : "none", model = fixture ? "deterministic-fixture" : "none", adapterVersion = "feedback-transcription-v1";
  const requestHash = createHash("sha256").update(JSON.stringify({ feedbackId: id, assetId, consentId, sourceSha256: asset.sha256, provider, model, adapterVersion })).digest("hex");
  const [prior] = await db.select().from(feedbackTranscriptionJobsTable).where(and(eq(feedbackTranscriptionJobsTable.requestedById, user.userId), eq(feedbackTranscriptionJobsTable.requestKey, requestKey))).limit(1);
  if (prior) return prior.requestHash === requestHash ? res.status(prior.state === "blocked" ? 424 : 200).json({ replayed: true, job: transcriptionDto(prior), originalAudioRetained: true }) : res.status(409).json({ code: "TRANSCRIPTION_IDEMPOTENCY_CONFLICT", error: "This idempotency key belongs to a different request" });
  const result = fixture ? "Local transcription fixture result." : null, outputSha256 = result ? createHash("sha256").update(result).digest("hex") : null;
  let job; try { job = await db.transaction(async tx => { const [row] = await tx.insert(feedbackTranscriptionJobsTable).values({ feedbackId: id, assetId, requestedById: user.userId, adapter: fixture ? "local-fixture" : "default-deny",
    state: fixture ? "completed" : "blocked", result, errorCode: fixture ? null : "EXTERNAL_TRANSCRIPTION_NOT_ACTIVATED", attempts: 1, requestKey, requestHash, consentId, provider, model, adapterVersion, sourceSha256: asset.sha256, outputSha256, completedAt: fixture ? new Date() : null }).returning();
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "transcription_requested", afterState: { state: row.state } }); return row; }); } catch (cause) { const [winner] = await db.select().from(feedbackTranscriptionJobsTable).where(and(eq(feedbackTranscriptionJobsTable.requestedById, user.userId), eq(feedbackTranscriptionJobsTable.requestKey, requestKey))).limit(1); if (!winner) throw cause; if (winner.requestHash !== requestHash) return res.status(409).json({ code: "TRANSCRIPTION_IDEMPOTENCY_CONFLICT", error: "This idempotency key belongs to a different request" }); return res.status(winner.state === "blocked" ? 424 : 200).json({ replayed: true, job: transcriptionDto(winner), originalAudioRetained: true }); }
  return res.status(fixture ? 201 : 424).json({ replayed: false, job: transcriptionDto(job), originalAudioRetained: true });
});

router.post("/feedback/:id/transcription/:jobId/review", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), jobId = asId(req.params.jobId), reviewState = bounded(req.body.reviewState, 20), reason = bounded(req.body.reason, 2000);
  if (!id || !jobId || !["accepted", "rejected"].includes(reviewState) || (reviewState === "rejected" && !reason)) return res.status(400).json({ code: "TRANSCRIPTION_REVIEW_INVALID", error: "A valid review decision and rejection reason are required" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "TRANSCRIPTION_REVIEW_DENIED", error: "Review access is denied" });
  const job = await db.transaction(async tx => { const [row] = await tx.update(feedbackTranscriptionJobsTable).set({ reviewState, reviewedById: user.userId, reviewedAt: new Date(), reviewReason: reason || null }).where(and(eq(feedbackTranscriptionJobsTable.id, jobId), eq(feedbackTranscriptionJobsTable.feedbackId, id), eq(feedbackTranscriptionJobsTable.state, "completed"), eq(feedbackTranscriptionJobsTable.reviewState, "pending"))).returning(); if (!row) return null; await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "transcription_reviewed", afterState: { jobId, reviewState, outputSha256: row.outputSha256 }, reason: reason || null }); return row; });
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
  for (const projectId of projectIds) if (await projectAuthorized(projectId, { ...user, isSuperAdmin: false }, actor.companyId)) active.add(projectId);
  return res.json({ feedback: rows.filter(row => !row.projectId || active.has(row.projectId)).map(customerFeedbackDto) });
});

router.post("/feedback/:id/reopen", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), observedVersion = asId(req.body.observedVersion), reason = bounded(req.body.reason, 2000);
  if (!id || !observedVersion || !reason) return res.status(400).json({ code: "FEEDBACK_REOPEN_INVALID", error: "Current version and a reopen reason are required" });
  const before = await accessible(id, user); if (!before) return res.status(403).json({ code: "FEEDBACK_REOPEN_DENIED", error: "Reopen access is denied" });
  if (!TERMINAL.has(before.status)) return res.status(409).json({ code: "FEEDBACK_REOPEN_STATE_INVALID", error: "Only closed feedback can be reopened" });
  const updated = await db.transaction(async tx => {
    const [row] = await tx.update(feedbackItemsTable).set({ status: "triaged", dispositionReason: reason, version: before.version + 1, updatedAt: new Date(), resolvedAt: null })
      .where(and(eq(feedbackItemsTable.id, id), eq(feedbackItemsTable.version, observedVersion))).returning();
    if (!row) return null;
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "reopened", beforeState: { status: before.status, version: before.version }, afterState: { status: row.status, version: row.version }, reason });
    return row;
  });
  if (!updated) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before reopening" });
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
    afterState: customerEventState(event.afterState), createdAt: event.createdAt,
  })) });
});

router.get("/feedback/:id/assets", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_ASSET_LIST_DENIED", error: "Evidence access is denied" });
  const assets = await db.select({ id: feedbackAssetsTable.id, kind: feedbackAssetsTable.kind, name: feedbackAssetsTable.safeName, mediaType: feedbackAssetsTable.mediaType, byteSize: feedbackAssetsTable.byteSize, sha256: feedbackAssetsTable.sha256, scanState: feedbackAssetsTable.scanState, createdAt: feedbackAssetsTable.createdAt })
    .from(feedbackAssetsTable).where(eq(feedbackAssetsTable.feedbackId, id)).orderBy(feedbackAssetsTable.createdAt);
  return res.json({ assets: assets.map(asset => ({ ...asset, downloadUrl: asset.scanState === "clean" ? `/api/v1/feedback/${id}/assets/${asset.id}/download` : null })) });
});

router.post("/feedback/:id/comments", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), comment = bounded(req.body.comment, 4000); if (!id || !comment) return res.status(400).json({ code: "FEEDBACK_COMMENT_INVALID", error: "A bounded comment is required" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_COMMENT_DENIED", error: "Comment access is denied" });
  const [event] = await db.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "commented", reason: comment }).returning();
  return res.status(201).json({ comment: { id: event.id, text: event.reason, createdAt: event.createdAt } });
});

router.get("/feedback/:id/assets/:assetId/download", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), assetId = asId(req.params.assetId); if (!id || !assetId) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "Invalid asset" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_DOWNLOAD_DENIED", error: "Download access is denied" });
  const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, assetId), eq(feedbackAssetsTable.feedbackId, id))).limit(1);
  if (!asset) return res.status(404).json({ code: "FEEDBACK_ASSET_NOT_FOUND", error: "Asset not found" });
  if (asset.scanState !== "clean") return res.status(423).json({ code: "FEEDBACK_ASSET_QUARANTINED", error: "This file remains quarantined and cannot be downloaded" });
  const bytes = await storage.download(asset.storagePath); if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) return res.status(409).json({ code: "FEEDBACK_ASSET_INTEGRITY_FAILED", error: "Stored file integrity check failed" });
  res.setHeader("Content-Type", asset.mediaType); res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(asset.safeName)}`);
  res.setHeader("X-Content-Type-Options", "nosniff"); return res.send(bytes);
});

router.get("/feedback/admin", authMiddleware, isSuperAdminMiddleware, async (_req, res) => {
  const rows = await db.select({ id: feedbackItemsTable.id, stableId: feedbackItemsTable.stableId, version: feedbackItemsTable.version, userId: feedbackItemsTable.userId,
    userEmail: usersTable.email, userFullName: usersTable.fullName, projectId: feedbackItemsTable.projectId, projectName: projectsTable.name, projectCode: projectsTable.code,
    feedbackType: feedbackItemsTable.feedbackType, priority: feedbackItemsTable.priority, module: feedbackItemsTable.module, pageUrl: feedbackItemsTable.pageUrl,
    message: feedbackItemsTable.message, status: feedbackItemsTable.status, targetRelease: feedbackItemsTable.targetRelease,
    dispositionReason: feedbackItemsTable.dispositionReason, customerVisible: feedbackItemsTable.customerVisible,
    createdAt: feedbackItemsTable.createdAt, updatedAt: feedbackItemsTable.updatedAt, resolvedAt: feedbackItemsTable.resolvedAt })
    .from(feedbackItemsTable).leftJoin(usersTable, eq(feedbackItemsTable.userId, usersTable.id)).leftJoin(projectsTable, eq(feedbackItemsTable.projectId, projectsTable.id))
    .orderBy(desc(feedbackItemsTable.createdAt)).limit(500);
  return res.json({ feedback: rows });
});

router.get("/feedback/admin/export.csv", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const reason = bounded(req.get("X-Export-Reason"), 500); if (!reason) return res.status(400).json({ code: "FEEDBACK_EXPORT_REASON_REQUIRED", error: "An export reason is required" });
  const rows = await db.select().from(feedbackItemsTable).orderBy(desc(feedbackItemsTable.createdAt)).limit(5000);
  const cell = (value: unknown) => { const normalized = String(value ?? "").replace(/[\r\n]+/g, " "); const neutral = /^[\s]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized; return `"${neutral.replace(/"/g, '""')}"`; };
  const header = ["Feedback ID", "Created", "Type", "Priority", "State", "Module", "Description", "Target release", "Decision reason", "Customer visible"];
  const lines = [header.map(cell).join(","), ...rows.map(row => [row.stableId, row.createdAt.toISOString(), row.feedbackType, row.priority, row.status, row.module, row.message, row.targetRelease, row.dispositionReason, row.customerVisible].map(cell).join(","))];
  if (rows.length) await db.insert(feedbackAuditEventsTable).values(rows.map(row => ({ feedbackId: row.id, actorUserId: req.user!.userId, eventType: "admin_exported", afterState: { scope: "all", release: "v F-1.60.35.8" }, reason })));
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=feedback-review-v-F-1.60.35.8.csv");
  return res.send(`\uFEFF${lines.join("\r\n")}\r\n`);
});

router.patch("/feedback/admin/:id", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const user = req.user!; const id = asId(req.params.id), observedVersion = asId(req.body.observedVersion);
  if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const [before] = await db.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id, id)).limit(1);
  if (!before) return res.status(404).json({ code: "FEEDBACK_NOT_FOUND", error: "Feedback not found" });
  if (observedVersion !== before.version) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before updating", currentVersion: before.version });
  const status = bounded(req.body.status || before.status, 32), reason = bounded(req.body.reason, 2000);
  if (!STATUSES.has(status)) return res.status(400).json({ code: "FEEDBACK_STATUS_INVALID", error: "Invalid feedback status" });
  if (status !== before.status && !TRANSITIONS[before.status]?.has(status)) return res.status(409).json({ code: "FEEDBACK_TRANSITION_INVALID", error: "This state transition is not allowed" });
  if ((TERMINAL.has(status) || status === "blocked") && !reason) return res.status(400).json({ code: "FEEDBACK_REASON_REQUIRED", error: "A reason is required for this state" });
  const updated = await db.transaction(async tx => {
    const [row] = await tx.update(feedbackItemsTable).set({ status, dispositionReason: reason || before.dispositionReason,
      targetRelease: bounded(req.body.targetRelease, 80) || before.targetRelease, customerVisible: req.body.customerVisible === undefined ? before.customerVisible : req.body.customerVisible === true,
      version: before.version + 1, updatedAt: new Date(), resolvedAt: TERMINAL.has(status) ? new Date() : null })
      .where(and(eq(feedbackItemsTable.id, id), eq(feedbackItemsTable.version, observedVersion))).returning();
    if (!row) return null;
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: TERMINAL.has(before.status) && status === "triaged" ? "reopened" : "triage_updated", beforeState: { status: before.status, version: before.version }, afterState: { status: row.status, version: row.version }, reason: reason || null });
    return row;
  });
  if (!updated) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before updating" });
  return res.json({ success: true, feedback: customerFeedbackDto(updated) });
});

export default router;
