import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { feedbackAssetsTable, feedbackAuditEventsTable, feedbackItemsTable, feedbackTranscriptionJobsTable } from "../../../../lib/db/src/schema/feedback-items";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { boundedMultipart, createMemoryUpload } from "../middlewares/multipart";
import { storage } from "../lib/storage-adapter";
import { FEEDBACK_MAX_FILE_BYTES, inspectFeedbackEvidence } from "../lib/feedback-evidence-contract";

const router = Router();
const upload = boundedMultipart(createMemoryUpload({ fileSize: FEEDBACK_MAX_FILE_BYTES, files: 10, fields: 1, parts: 11 }).array("files", 10));
const TYPES = new Set(["bug", "workflow", "idea", "question", "other"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["new", "triaged", "accepted", "in_progress", "blocked", "fixed", "verified", "rejected", "deferred"]);
const TERMINAL = new Set(["verified", "rejected", "deferred"]);

const asId = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
const bounded = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
async function accessible(id: number, user: NonNullable<Express.Request["user"]>) {
  const [row] = await db.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id, id)).limit(1);
  if (!row || (!user.isSuperAdmin && row.userId !== user.userId)) return null;
  return row;
}

router.post("/feedback", authMiddleware, async (req, res) => {
  try {
    const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
    const feedbackType = bounded(req.body.feedbackType, 32), priority = bounded(req.body.priority || "normal", 16);
    const message = bounded(req.body.message, 12000), moduleName = bounded(req.body.module, 120), pageUrl = bounded(req.body.pageUrl, 2048);
    const projectId = asId(req.body.projectId), idempotencyKey = bounded(req.get("Idempotency-Key"), 120) || null;
    if (!TYPES.has(feedbackType) || !PRIORITIES.has(priority)) return res.status(400).json({ code: "FEEDBACK_CLASSIFICATION_INVALID", error: "Invalid feedback classification" });
    if (!message || !pageUrl) return res.status(400).json({ code: "FEEDBACK_REQUIRED_FIELDS", error: "Description and page are required" });
    if (projectId && !user.isSuperAdmin) {
      const member = await db.select({ id: projectMembersTable.id }).from(projectMembersTable).where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.userId))).limit(1);
      if (!member.length) return res.status(403).json({ code: "PROJECT_ACCESS_DENIED", error: "You do not have access to this project" });
    }
    if (idempotencyKey) {
      const [prior] = await db.select().from(feedbackItemsTable).where(and(eq(feedbackItemsTable.userId, user.userId), eq(feedbackItemsTable.idempotencyKey, idempotencyKey))).limit(1);
      if (prior) return res.json({ success: true, replayed: true, feedback: prior });
    }
    const metadata = req.body.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata) ? req.body.metadata : {};
    const [created] = await db.insert(feedbackItemsTable).values({ userId: user.userId, projectId, feedbackType, priority, module: moduleName || null, pageUrl, message,
      status: "new", stableId: `FB-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, idempotencyKey,
      metadata: { ...metadata, build: "v F-1.60.35.8", userAgent: req.get("user-agent") || null } }).returning();
    await db.insert(feedbackAuditEventsTable).values({ feedbackId: created.id, actorUserId: user.userId, eventType: "created", afterState: { status: "new", version: 1 } });
    return res.status(201).json({ success: true, replayed: false, feedback: created });
  } catch (error) { console.error("[feedback] create failed", error instanceof Error ? error.name : "unknown"); return res.status(500).json({ code: "FEEDBACK_CREATE_FAILED", error: "Failed to submit feedback" }); }
});

router.post("/feedback/:id/assets", authMiddleware, upload, async (req, res) => {
  const stored: string[] = [];
  try {
    const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
    const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
    const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_WRITE_DENIED", error: "You cannot add files to this feedback" });
    const files = Array.isArray(req.files) ? req.files : [], kind = bounded(req.body.kind || "attachment", 20);
    if (!files.length || !["attachment", "screenshot", "audio"].includes(kind)) return res.status(400).json({ code: "FEEDBACK_ASSET_INVALID", error: "Supported files and a valid asset kind are required" });
    const results = [];
    for (const file of files) {
      const checked = inspectFeedbackEvidence(file), storagePath = await storage.upload(file.buffer, feedback.projectId ?? `feedback-${id}`, checked.name); stored.push(storagePath);
      const scanState = process.env.BIMLOG_FEEDBACK_SCANNER === "fixture-clean" ? "clean" : "quarantined";
      const [asset] = await db.insert(feedbackAssetsTable).values({ feedbackId: id, projectId: feedback.projectId, uploadedById: user.userId, kind,
        originalName: bounded(file.originalname, 255), safeName: checked.name, mediaType: bounded(file.mimetype || "application/octet-stream", 120), byteSize: file.size,
        sha256: checked.sha256, storagePath, scanState }).returning();
      results.push({ id: asset.id, kind, name: asset.safeName, mediaType: asset.mediaType, byteSize: asset.byteSize, sha256: asset.sha256, scanState });
    }
    await db.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "assets_added", afterState: { count: results.length } });
    return res.status(201).json({ assets: results, scanner: process.env.BIMLOG_FEEDBACK_SCANNER === "fixture-clean" ? "local-fixture" : "activation-required" });
  } catch (error) {
    for (const item of stored) await storage.delete(item).catch(() => undefined);
    const known = error as Error & { status?: number; code?: string };
    return res.status(known.status || 500).json({ code: known.code || "FEEDBACK_UPLOAD_FAILED", error: known.status ? known.message : "Upload failed safely" });
  }
});

router.post("/feedback/:id/transcription", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), assetId = asId(req.body.assetId); if (!id || !assetId) return res.status(400).json({ code: "TRANSCRIPTION_INPUT_INVALID", error: "Feedback and audio asset are required" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "TRANSCRIPTION_DENIED", error: "Transcription is not authorized" });
  const [asset] = await db.select().from(feedbackAssetsTable).where(and(eq(feedbackAssetsTable.id, assetId), eq(feedbackAssetsTable.feedbackId, id))).limit(1);
  if (!asset || asset.kind !== "audio") return res.status(404).json({ code: "AUDIO_ASSET_NOT_FOUND", error: "Audio asset not found" });
  const fixture = process.env.BIMLOG_FEEDBACK_TRANSCRIPTION_ADAPTER === "local-fixture";
  const [job] = await db.insert(feedbackTranscriptionJobsTable).values({ feedbackId: id, assetId, requestedById: user.userId, adapter: fixture ? "local-fixture" : "default-deny",
    state: fixture ? "completed" : "blocked", result: fixture ? bounded(req.body.fixtureTranscript || "Local transcription fixture result.", 12000) : null,
    errorCode: fixture ? null : "EXTERNAL_TRANSCRIPTION_NOT_ACTIVATED", attempts: 1 }).returning();
  return res.status(fixture ? 201 : 424).json({ job: { id: job.id, state: job.state, result: job.result, errorCode: job.errorCode, adapter: job.adapter }, originalAudioRetained: true });
});

router.get("/feedback/mine", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const rows = await db.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.userId, user.userId)).orderBy(desc(feedbackItemsTable.createdAt)).limit(200);
  return res.json({ feedback: rows });
});

router.get("/feedback/:id/history", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id); if (!id) return res.status(400).json({ code: "FEEDBACK_ID_INVALID", error: "Invalid feedback id" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_HISTORY_DENIED", error: "History is not authorized" });
  const history = await db.select({ id: feedbackAuditEventsTable.id, eventType: feedbackAuditEventsTable.eventType,
    actorUserId: feedbackAuditEventsTable.actorUserId, beforeState: feedbackAuditEventsTable.beforeState,
    afterState: feedbackAuditEventsTable.afterState, reason: feedbackAuditEventsTable.reason, createdAt: feedbackAuditEventsTable.createdAt })
    .from(feedbackAuditEventsTable).where(eq(feedbackAuditEventsTable.feedbackId, id)).orderBy(feedbackAuditEventsTable.createdAt);
  return res.json({ feedback: { id: feedback.id, stableId: feedback.stableId, version: feedback.version }, history });
});

router.post("/feedback/:id/comments", authMiddleware, async (req, res) => {
  const user = req.user; if (!user) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Unauthorized" });
  const id = asId(req.params.id), comment = bounded(req.body.comment, 4000); if (!id || !comment) return res.status(400).json({ code: "FEEDBACK_COMMENT_INVALID", error: "A bounded comment is required" });
  const feedback = await accessible(id, user); if (!feedback) return res.status(403).json({ code: "FEEDBACK_COMMENT_DENIED", error: "Comment access is denied" });
  const [event] = await db.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "commented", reason: comment }).returning();
  return res.status(201).json({ comment: { id: event.id, actorUserId: event.actorUserId, text: event.reason, createdAt: event.createdAt } });
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
    dispositionReason: feedbackItemsTable.dispositionReason, customerVisible: feedbackItemsTable.customerVisible, metadata: feedbackItemsTable.metadata,
    createdAt: feedbackItemsTable.createdAt, updatedAt: feedbackItemsTable.updatedAt, resolvedAt: feedbackItemsTable.resolvedAt })
    .from(feedbackItemsTable).leftJoin(usersTable, eq(feedbackItemsTable.userId, usersTable.id)).leftJoin(projectsTable, eq(feedbackItemsTable.projectId, projectsTable.id))
    .orderBy(desc(feedbackItemsTable.createdAt)).limit(500);
  return res.json({ feedback: rows });
});

router.get("/feedback/admin/export.csv", authMiddleware, isSuperAdminMiddleware, async (_req, res) => {
  const rows = await db.select().from(feedbackItemsTable).orderBy(desc(feedbackItemsTable.createdAt)).limit(5000);
  const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
  const header = ["Feedback ID", "Created", "Type", "Priority", "State", "Module", "Description", "Target release", "Decision reason", "Customer visible"];
  const lines = [header.map(cell).join(","), ...rows.map(row => [row.stableId, row.createdAt.toISOString(), row.feedbackType, row.priority, row.status, row.module, row.message, row.targetRelease, row.dispositionReason, row.customerVisible].map(cell).join(","))];
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
  if ((TERMINAL.has(status) || status === "blocked") && !reason) return res.status(400).json({ code: "FEEDBACK_REASON_REQUIRED", error: "A reason is required for this state" });
  const [updated] = await db.update(feedbackItemsTable).set({ status, dispositionReason: reason || before.dispositionReason,
    targetRelease: bounded(req.body.targetRelease, 80) || before.targetRelease, customerVisible: req.body.customerVisible === undefined ? before.customerVisible : req.body.customerVisible === true,
    version: before.version + 1, updatedAt: new Date(), resolvedAt: TERMINAL.has(status) ? new Date() : null })
    .where(and(eq(feedbackItemsTable.id, id), eq(feedbackItemsTable.version, observedVersion))).returning();
  if (!updated) return res.status(409).json({ code: "FEEDBACK_STALE", error: "Feedback changed; reload before updating" });
  await db.insert(feedbackAuditEventsTable).values({ feedbackId: id, actorUserId: user.userId, eventType: "triage_updated", beforeState: { status: before.status, version: before.version }, afterState: { status: updated.status, version: updated.version }, reason: reason || null });
  return res.json({ success: true, feedback: updated });
});

export default router;
