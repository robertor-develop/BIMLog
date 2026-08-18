import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { feedbackAssetsTable, feedbackAuditEventsTable, feedbackCaptureConsentsTable, feedbackItemsTable, feedbackRelayCustodyEventsTable, feedbackRelayJobsTable, feedbackTranscriptionJobsTable } from "../../../../lib/db/src/schema/feedback-items";
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
const sanitizedPageUrl = (value: unknown) => {
  try { const url = new URL(bounded(value, 2048), "http://bimlog.local"); return url.pathname.slice(0, 2048) || "/"; }
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
          metadata: { build: "v F-1.60.35.8", userAgent: bounded(req.get("user-agent"), 512), viewport: bounded(req.body.metadata?.viewport, 32), language: bounded(req.body.metadata?.language, 24) } }).returning();
        if (!row) throw new Error("Feedback insert did not return a row");
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: row.id, actorUserId: user.userId, eventType: "created", afterState: { status: "new", version: 1 } });
        return { status: 201, row, replayed: false } as const;
      });
    if (!("row" in outcome)) return res.status(outcome.status).json({ code: outcome.code, error: outcome.error });
    if (!outcome.row) throw new Error("Feedback transaction returned no row");
    return res.status(outcome.status).json({ success: true, replayed: outcome.replayed, feedback: customerFeedbackDto(outcome.row) });
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
    const transformations = (() => { try { const parsed = JSON.parse(bounded(req.body.transformations, 12000)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } })();
    const transformation = boundedTransformation(transformations[uploadKey] ?? null);
    const requestHash = createHash("sha256").update(JSON.stringify({ feedbackId: id, actorId: user.userId, kind, origin, consentId: bounded(req.body.consentId, 80) || null, sha256: inspected.sha256, transformation })).digest("hex");
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
      if (captureConsent && !captureConsent.feedbackId) { const linked = await tx.update(feedbackCaptureConsentsTable).set({ feedbackId: id }).where(and(eq(feedbackCaptureConsentsTable.id, captureConsent.id), sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).returning({ id: feedbackCaptureConsentsTable.id }); if (!linked.length) throw Object.assign(new Error("Capture consent was revoked"), { status: 403, code: "FEEDBACK_CAPTURE_CONSENT_REQUIRED" }); }
      const [identical] = await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.feedbackId,id),eq(feedbackAssetsTable.sha256,inspected.sha256))).limit(1);
      if (identical) {
        const prior = identical.provenance as Record<string, unknown>;
        const identityMatches = identical.kind === kind && prior.source === origin && prior.consentId === (captureConsent?.id || null) && JSON.stringify(prior.transformation ?? null) === JSON.stringify(transformation);
        if (!identityMatches) throw Object.assign(new Error("Identical bytes already exist with different evidence provenance"), { status: 409, code: "FEEDBACK_ASSET_PROVENANCE_CONFLICT" });
        await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "asset_upload_receipt", afterState: { assetId: identical.id, uploadRequestKey: uploadKey, uploadRequestHash: requestHash } });
        return [{ id: identical.id, kind: identical.kind, name: identical.safeName, mediaType: identical.mediaType, byteSize: identical.byteSize, sha256: identical.sha256, scanState: identical.scanState, replayed: true, deduplicated: true }];
      }
      const file = files[0], storagePath = await storage.upload(file.buffer, feedback.projectId ?? `feedback-${id}`, inspected.name); stored.push(storagePath);
      const [asset] = await tx.insert(feedbackAssetsTable).values({ feedbackId: id, projectId: feedback.projectId, uploadedById: user.userId, kind,
          originalName: bounded(file.originalname, 255), safeName: inspected.name, mediaType: inspected.mediaType, byteSize: file.size,
          sha256: inspected.sha256, storagePath, uploadRequestKey:uploadKey,uploadRequestHash:requestHash,scanState, scannerAdapter, scannedAt: scanState === "clean" ? new Date() : null,
          provenance: { source: origin, uploadRequestKey: uploadKey, uploadRequestHash: requestHash, consentId: captureConsent?.id || null, consentNoticeVersion: captureConsent?.noticeVersion || null, purpose: captureConsent?.purpose || null, actorUserId: user.userId, grantedAt: captureConsent?.grantedAt?.toISOString() || null, receivedAt: new Date().toISOString(), transformation } }).returning();
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
  const id = asId(req.params.id), assetId = asId(req.body.assetId); if (!id || !assetId) return res.status(400).json({ code: "TRANSCRIPTION_INPUT_INVALID", error: "Feedback and audio asset are required" });
  const consentId = bounded(req.body.consentId, 80), requestKey = bounded(req.get("Idempotency-Key"), 120);
  if (!consentId || !requestKey) return res.status(400).json({ code: "TRANSCRIPTION_CONSENT_REQUIRED", error: "Capture consent and idempotency key are required" });
  const fixture = localFixture(process.env.BIMLOG_FEEDBACK_TRANSCRIPTION_ADAPTER, "local-fixture");
  const provider = fixture ? "local-fixture" : "none", model = fixture ? "deterministic-fixture" : "none", adapterVersion = "feedback-transcription-v1";
  const result = fixture ? "Local transcription fixture result." : null, outputSha256 = result ? createHash("sha256").update(result).digest("hex") : null;
  try { const outcome = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`capture-consent:${consentId}`},0))`); await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`transcription:${user.userId}:${requestKey}`},0))`);
    const fresh=await accessible(id,user,tx); const [asset]=await tx.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id,assetId),eq(feedbackAssetsTable.feedbackId,id),eq(feedbackAssetsTable.uploadedById,user.userId),eq(feedbackAssetsTable.kind,"audio"),eq(feedbackAssetsTable.scanState,"clean"),sql`${feedbackAssetsTable.scannedAt} is not null`)).limit(1);
    const [activeConsent]=await tx.select({id:feedbackCaptureConsentsTable.id}).from(feedbackCaptureConsentsTable).where(and(eq(feedbackCaptureConsentsTable.id,consentId),eq(feedbackCaptureConsentsTable.actorUserId,user.userId),eq(feedbackCaptureConsentsTable.captureKind,"audio"),eq(feedbackCaptureConsentsTable.feedbackId,id),sql`${feedbackCaptureConsentsTable.revokedAt} is null`)).limit(1);
    if(!fresh||!asset||!activeConsent)throw Object.assign(new Error("Active linked consent and a currently clean owned audio asset are required"),{status:403,code:"TRANSCRIPTION_DENIED"});
    const requestHash=createHash("sha256").update(JSON.stringify({feedbackId:id,assetId,consentId,sourceSha256:asset.sha256,provider,model,adapterVersion})).digest("hex"); const [winner]=await tx.select().from(feedbackTranscriptionJobsTable).where(and(eq(feedbackTranscriptionJobsTable.requestedById,user.userId),eq(feedbackTranscriptionJobsTable.requestKey,requestKey))).limit(1);
    if(winner){if(winner.requestHash!==requestHash)throw Object.assign(new Error("This idempotency key belongs to a different request"),{status:409,code:"TRANSCRIPTION_IDEMPOTENCY_CONFLICT"});return {row:winner,replayed:true};}
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
  const relays=ids.length?await db.select({id:feedbackRelayJobsTable.id,feedbackId:feedbackRelayJobsTable.feedbackId,state:feedbackRelayJobsTable.state,version:feedbackRelayJobsTable.version,createdAt:feedbackRelayJobsTable.createdAt,updatedAt:feedbackRelayJobsTable.updatedAt,reason:feedbackRelayJobsTable.lastErrorCode,expiryOutcome:feedbackRelayJobsTable.expiryOutcome}).from(feedbackRelayJobsTable).where(and(inArray(feedbackRelayJobsTable.feedbackId,ids),eq(feedbackRelayJobsTable.companyId,actor.companyId))).orderBy(desc(feedbackRelayJobsTable.createdAt)):[];
  const relayIds=relays.map(relay=>relay.id);const custody=relayIds.length?await db.select({jobId:feedbackRelayCustodyEventsTable.jobId,sequence:feedbackRelayCustodyEventsTable.sequence,state:feedbackRelayCustodyEventsTable.toState,reason:feedbackRelayCustodyEventsTable.reasonCode,occurredAt:feedbackRelayCustodyEventsTable.occurredAt}).from(feedbackRelayCustodyEventsTable).where(inArray(feedbackRelayCustodyEventsTable.jobId,relayIds)).orderBy(feedbackRelayCustodyEventsTable.sequence):[];
  const transcriptionByFeedback=new Map<number,typeof feedbackTranscriptionJobsTable.$inferSelect>();for(const job of transcriptions)if(!transcriptionByFeedback.has(job.feedbackId))transcriptionByFeedback.set(job.feedbackId,job);const relayByFeedback=new Map<number,(typeof relays)[number]>();for(const relay of relays)if(!relayByFeedback.has(relay.feedbackId))relayByFeedback.set(relay.feedbackId,relay);
  return res.json({feedback:visible.map(row=>{const relay=relayByFeedback.get(row.id);return {...customerFeedbackDto(row),transcription:transcriptionByFeedback.has(row.id)?transcriptionDto(transcriptionByFeedback.get(row.id)!):null,relay:relay?{state:relay.state,version:relay.version,createdAt:relay.createdAt,updatedAt:relay.updatedAt,reason:relay.reason||relay.expiryOutcome||null,history:custody.filter(event=>event.jobId===relay.id).map(event=>({sequence:event.sequence,state:event.state,at:event.occurredAt,reason:event.reason||null}))}:null};})});
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
    afterState: customerEventState(event.afterState), createdAt: event.createdAt,
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

router.get("/feedback/:id/assets/:assetId/download", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), assetId = asId(req.params.assetId); if (!id || !assetId) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "Invalid asset" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_DOWNLOAD_DENIED", error: "Download access is denied" });
  const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, assetId), eq(feedbackAssetsTable.feedbackId, id))).limit(1);
  if (!asset) return res.status(404).json({ code: "FEEDBACK_ASSET_NOT_FOUND", error: "Asset not found" });
  if (asset.scanState !== "clean") return res.status(423).json({ code: "FEEDBACK_ASSET_QUARANTINED", error: "This file remains quarantined and cannot be downloaded" });
  if (asset.byteSize > FEEDBACK_MAX_FILE_BYTES) return res.status(413).json({ code: "FEEDBACK_DOWNLOAD_TOO_LARGE", error: "Stored file exceeds the governed download bound" });
  const bytes = await storage.download(asset.storagePath); if (bytes.byteLength !== asset.byteSize || bytes.byteLength > FEEDBACK_MAX_FILE_BYTES || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) return res.status(409).json({ code: "FEEDBACK_ASSET_INTEGRITY_FAILED", error: "Stored file integrity check failed" });
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
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback-admin:${id}`},0))`);const [before]=await tx.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id,id)).limit(1);if(!before)return {error:"FEEDBACK_NOT_FOUND",status:404,message:"Feedback not found"} as const;if(observedVersion!==before.version)return {error:"FEEDBACK_STALE",status:409,message:"Feedback changed; reload before updating"} as const;
    const status=bounded(req.body.status||before.status,32),reason=bounded(req.body.reason,2000);if(!STATUSES.has(status))return {error:"FEEDBACK_STATUS_INVALID",status:400,message:"Invalid feedback status"} as const;if(status!==before.status&&!TRANSITIONS[before.status]?.has(status))return {error:"FEEDBACK_TRANSITION_INVALID",status:409,message:"This state transition is not allowed"} as const;if((TERMINAL.has(status)||status==="blocked")&&!reason)return {error:"FEEDBACK_REASON_REQUIRED",status:400,message:"A reason is required for this state"} as const;
    const [row] = await tx.update(feedbackItemsTable).set({ status, dispositionReason: reason || before.dispositionReason,
      targetRelease: bounded(req.body.targetRelease, 80) || before.targetRelease, customerVisible: req.body.customerVisible === undefined ? before.customerVisible : req.body.customerVisible === true,
      version: before.version + 1, updatedAt: new Date(), resolvedAt: TERMINAL.has(status) ? new Date() : null })
      .where(and(eq(feedbackItemsTable.id, id), eq(feedbackItemsTable.version, observedVersion))).returning();
    if (!row) return null;
    await tx.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: TERMINAL.has(before.status) && status === "triaged" ? "reopened" : "triage_updated", beforeState: { status: before.status, version: before.version }, afterState: { status: row.status, version: row.version }, reason: reason || null });
    return row;
  });
  if (!updated) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before updating" });
  if("error" in updated)return res.status(updated.status).json({code:updated.error,error:updated.message});
  return res.json({ success: true, feedback: customerFeedbackDto(updated) });
});

export default router;
