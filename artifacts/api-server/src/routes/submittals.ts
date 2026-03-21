import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  submittalsTable, usersTable, activityLogTable, projectsTable,
  projectMembersTable, companiesTable, rfisTable,
  submittalRegisterTable, submittalViewEventsTable,
} from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { ListSubmittalsParams, UpdateSubmittalParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

// ─── PDF constants ────────────────────────────────────────────────────────────
const LETTER_HEIGHT = 792;
const LETTER_WIDTH  = 612;
const MARGIN        = 50;
const CONTENT_W     = LETTER_WIDTH - MARGIN * 2;
const CONTENT_BOT   = LETTER_HEIGHT - 65;

// Landscape log constants
const LOG_MARGIN     = 36;
const LOG_W          = 792;
const LOG_H          = 612;
const LOG_CONTENT_W  = LOG_W - LOG_MARGIN * 2;
const LOG_CONTENT_BOT = LOG_H - 50;

function drawFooter(doc: PDFKit.PDFDocument, text: string) {
  const orig = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(7).fillColor("#94A3B8").font("Helvetica")
    .text(text, MARGIN, LETTER_HEIGHT - 30, { width: CONTENT_W, align: "center", lineBreak: false });
  doc.page.margins.bottom = orig;
}

function fmtD(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function fmtTs(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function subToJson(s: typeof submittalsTable.$inferSelect, extras: Record<string, unknown> = {}) {
  return {
    ...s,
    ...extras,
    dueDate: s.dueDate?.toISOString(),
    dateSubmitted: s.dateSubmitted?.toISOString(),
    dateRequired: s.dateRequired?.toISOString(),
    reviewedAt: s.reviewedAt?.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ─── GET /projects/:projectId/submittals ──────────────────────────────────────
router.get("/projects/:projectId/submittals", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListSubmittalsParams.parse({ projectId: req.params.projectId });
    const submittals = await db.select().from(submittalsTable)
      .where(eq(submittalsTable.projectId, projectId))
      .orderBy(submittalsTable.createdAt);

    const results = await Promise.all(submittals.map(async (s) => {
      const submitter = await db.select().from(usersTable).where(eq(usersTable.id, s.submittedById)).limit(1);
      let assignedToName: string | undefined;
      if (s.assignedToId) {
        const assignee = await db.select().from(usersTable).where(eq(usersTable.id, s.assignedToId)).limit(1);
        assignedToName = assignee[0]?.fullName;
      }
      return { ...subToJson(s), submittedByName: submitter[0]?.fullName || "", assignedToName };
    }));

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/submittals ─────────────────────────────────────
router.post("/projects/:projectId/submittals", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListSubmittalsParams.parse({ projectId: req.params.projectId });
    const body = req.body as Record<string, unknown>;

    if (!body.title || typeof body.title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const [submittalCount] = await db.select({ count: count() }).from(submittalsTable)
      .where(eq(submittalsTable.projectId, projectId));
    const number = `SUB-${String((submittalCount.count as number) + 1).padStart(4, "0")}`;

    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const company = user[0]?.companyId
      ? await db.select().from(companiesTable).where(eq(companiesTable.id, user[0].companyId)).limit(1)
      : [];

    const [submittal] = await db.insert(submittalsTable).values({
      projectId,
      number,
      title: body.title as string,
      description: (body.description as string) || null,
      status: "pending",
      submittalType: (body.submittalType as string) || "shop_drawing",
      submittalCategory: (body.submittalCategory as string) || null,
      specSection: (body.specSection as string) || null,
      drawingNumber: (body.drawingNumber as string) || null,
      drawingTitle: (body.drawingTitle as string) || null,
      submittedById: req.user!.userId,

      submittedByCompany: (body.submittedByCompany as string) || company[0]?.name || req.user!.companyName || null,
      submittedByPerson: (body.submittedByPerson as string) || req.user!.fullName || null,
      submittedByEmail: (body.submittedByEmail as string) || user[0]?.email || null,
      submittedByPhone: (body.submittedByPhone as string) || null,
      submittedByAddress: (body.submittedByAddress as string) || null,

      submittedToCompany: (body.submittedToCompany as string) || null,
      submittedToPerson: (body.submittedToPerson as string) || null,
      submittedToEmail: (body.submittedToEmail as string) || null,
      submittedToExternal: (body.submittedToExternal as boolean) || false,

      manufacturer: (body.manufacturer as string) || null,
      modelNumber: (body.modelNumber as string) || null,
      dateSubmitted: body.dateSubmitted ? new Date(body.dateSubmitted as string) : new Date(),
      dateRequired: body.dateRequired ? new Date(body.dateRequired as string) : null,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : null,

      procurementStatus: (body.procurementStatus as string) || "not_ordered",
      ballInCourt: (body.submittedToCompany as string) || null,

      linkedRfiId: (body.linkedRfiId as number) || null,
      parentSubmittalId: (body.parentSubmittalId as number) || null,
      revisionNumber: (body.revisionNumber as number) || 0,

      distributionList: (body.distributionList as string[]) || [],
      attachmentsJson: (body.attachmentsJson as string[]) || [],
    }).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "submittal",
      entityId: submittal.id,
      details: `Created submittal ${number}: ${body.title}`,
    });

    res.status(201).json({ ...subToJson(submittal), submittedByName: req.user!.fullName });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Bad request" });
  }
});

// ─── GET /projects/:projectId/submittals/export-all (REMOVED — Excel is client-side) ─
router.get("/projects/:projectId/submittals/export-all", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const subs = await db.select().from(submittalsTable)
      .where(eq(submittalsTable.projectId, projectId))
      .orderBy(submittalsTable.createdAt);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const doc = new PDFDocument({ margin: LOG_MARGIN, size: "LETTER", layout: "landscape", autoFirstPage: true });
    doc.page.margins.bottom = 0;
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Submittal-Log-${project?.name || projectId}.pdf"`);
      res.setHeader("Content-Length", buf.length);
      res.send(buf);
    });

    let y = LOG_MARGIN;

    // Header band
    doc.rect(0, 0, LOG_W, 52).fill("#1E3A5F");
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
      .text("SUBMITTAL LOG", LOG_MARGIN, 12, { width: LOG_CONTENT_W, lineBreak: false });
    doc.fillColor("#93C5FD").fontSize(9).font("Helvetica")
      .text(`${project?.name || "Project"} · Generated ${new Date().toLocaleDateString()}`, LOG_MARGIN, 32, { width: LOG_CONTENT_W, lineBreak: false });
    doc.fillColor("white").fontSize(9)
      .text(`${subs.length} submittals · BIMLog by IgniteSmart`, LOG_MARGIN + LOG_CONTENT_W - 200, 32, { width: 200, align: "right", lineBreak: false });
    y = 62;

    // Column defs (landscape 792-72=720 content)
    const COLS = [
      { label: "Number",        w: 65 },
      { label: "Title",         w: 130 },
      { label: "Type",          w: 70 },
      { label: "Status",        w: 75 },
      { label: "Submitted By",  w: 85 },
      { label: "Submitted To",  w: 85 },
      { label: "Date Submitted",w: 72 },
      { label: "Date Required", w: 72 },
      { label: "Days Out",      w: 46 },
      { label: "Ball in Court", w: LOG_CONTENT_W - (65+130+70+75+85+85+72+72+46) },
    ];

    // Column header row
    doc.rect(LOG_MARGIN, y, LOG_CONTENT_W, 16).fill("#EFF6FF");
    let cx = LOG_MARGIN;
    COLS.forEach(col => {
      doc.fillColor("#1E3A5F").fontSize(7).font("Helvetica-Bold")
        .text(col.label, cx + 3, y + 4, { width: col.w - 4, lineBreak: false });
      cx += col.w;
    });
    doc.rect(LOG_MARGIN, y, LOG_CONTENT_W, 16).stroke("#BFDBFE");
    y += 16;

    const STATUS_COLORS: Record<string, string> = {
      approved: "#15803D", approved_as_noted: "#1D4ED8", rejected: "#DC2626",
      revise_resubmit: "#EA580C", under_review: "#B45309", submitted: "#374151", pending: "#9CA3AF",
    };

    subs.forEach((sub, idx) => {
      const rowH = 15;
      if (y + rowH > LOG_CONTENT_BOT) {
        doc.addPage(); doc.page.margins.bottom = 0; y = LOG_MARGIN;
      }
      const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
      doc.rect(LOG_MARGIN, y, LOG_CONTENT_W, rowH).fill(bg);

      const days = sub.dateRequired
        ? Math.ceil((new Date(sub.dateRequired).getTime() - Date.now()) / 86400000)
        : null;
      const daysStr = days !== null ? (days < 0 ? `${Math.abs(days)}d over` : `${days}d`) : "—";

      const vals = [
        sub.number,
        sub.title,
        (sub.submittalCategory || sub.submittalType || "").replace("_", " "),
        sub.status || "—",
        sub.submittedByCompany || "—",
        sub.submittedToCompany || "—",
        sub.dateSubmitted ? new Date(sub.dateSubmitted).toLocaleDateString() : "—",
        sub.dateRequired ? new Date(sub.dateRequired).toLocaleDateString() : "—",
        daysStr,
        sub.ballInCourt || "—",
      ];

      cx = LOG_MARGIN;
      COLS.forEach((col, ci) => {
        const color = ci === 3 ? (STATUS_COLORS[vals[ci]] || "#374151") : "#374151";
        doc.fillColor(color).fontSize(6.5).font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
          .text(vals[ci], cx + 3, y + 4, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      doc.rect(LOG_MARGIN, y, LOG_CONTENT_W, rowH).stroke("#F1F5F9");
      y += rowH;
    });

    // Footer
    doc.page.margins.bottom = 0;
    doc.fontSize(7).fillColor("#94A3B8").font("Helvetica")
      .text(`Submittal Log · ${project?.name || ""} · BIMLog by IgniteSmart`, LOG_MARGIN, LOG_H - 22, { width: LOG_CONTENT_W, align: "center", lineBreak: false });
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── PATCH /projects/:projectId/submittals/:submittalId ───────────────────────
router.patch("/projects/:projectId/submittals/:submittalId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });
    const body = req.body as Record<string, unknown>;

    const [existing] = await db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Submittal not found" }); return; }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const textFields = [
      "title", "description", "status", "specSection", "drawingNumber", "drawingTitle",
      "submittalCategory", "submittalType",
      "submittedByCompany", "submittedByPerson", "submittedByEmail", "submittedByPhone", "submittedByAddress",
      "submittedToCompany", "submittedToPerson", "submittedToEmail",
      "manufacturer", "modelNumber", "procurementStatus", "ballInCourt",
      "reviewDecision", "complianceNotes", "rejectionReason", "reviewerName",
    ];
    textFields.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate as string) : null;
    if (body.dateRequired !== undefined) updates.dateRequired = body.dateRequired ? new Date(body.dateRequired as string) : null;
    if (body.dateSubmitted !== undefined) updates.dateSubmitted = body.dateSubmitted ? new Date(body.dateSubmitted as string) : null;
    if (body.reviewedAt !== undefined) updates.reviewedAt = body.reviewedAt ? new Date(body.reviewedAt as string) : null;
    if (body.linkedRfiId !== undefined) updates.linkedRfiId = body.linkedRfiId || null;
    if (body.submittedToExternal !== undefined) updates.submittedToExternal = body.submittedToExternal;
    if (body.distributionList !== undefined) updates.distributionList = body.distributionList;
    if (body.attachmentsJson !== undefined) updates.attachmentsJson = body.attachmentsJson;
    if (body.ballInCourtHistory !== undefined) updates.ballInCourtHistory = body.ballInCourtHistory;

    const [updated] = await db.update(submittalsTable).set(updates)
      .where(eq(submittalsTable.id, submittalId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "submittal",
      entityId: submittalId,
      details: `Updated submittal ${updated.number}${body.status ? ` → ${body.status}` : ""}`,
    });

    const submitter = await db.select().from(usersTable).where(eq(usersTable.id, updated.submittedById)).limit(1);
    res.json({ ...subToJson(updated), submittedByName: submitter[0]?.fullName || "" });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Bad request" });
  }
});

// ─── POST /projects/:projectId/submittals/:submittalId/view ───────────────────
router.post("/projects/:projectId/submittals/:submittalId/view", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });
    await db.insert(submittalViewEventsTable).values({
      submittalId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      eventType: "viewed",
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/submittals/:submittalId/viewed-by ───────────────
router.get("/projects/:projectId/submittals/:submittalId/viewed-by", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });
    const events = await db.select().from(submittalViewEventsTable)
      .where(eq(submittalViewEventsTable.submittalId, submittalId))
      .orderBy(submittalViewEventsTable.viewedAt);
    res.json(events.map(e => ({ ...e, viewedAt: e.viewedAt.toISOString() })));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/submittals/:submittalId/respond ────────────────
router.post("/projects/:projectId/submittals/:submittalId/respond", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });
    const body = req.body as {
      reviewDecision: string;
      complianceNotes?: string;
      rejectionReason?: string;
    };

    const [existing] = await db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Submittal not found" }); return; }

    const statusMap: Record<string, string> = {
      approved: "approved",
      approved_as_noted: "approved_as_noted",
      revise_resubmit: "revise_resubmit",
      rejected: "rejected",
      not_required: "rejected",
    };
    const newStatus = statusMap[body.reviewDecision] || existing.status;

    // ── Rapid approval detection ──────────────────────────────────────────────
    let rapidApprovalFlag = existing.rapidApprovalFlag ?? false;
    if (body.reviewDecision === "approved" || body.reviewDecision === "approved_as_noted") {
      const viewEvents = await db.select().from(submittalViewEventsTable)
        .where(eq(submittalViewEventsTable.submittalId, submittalId))
        .orderBy(submittalViewEventsTable.viewedAt)
        .limit(1);
      if (viewEvents.length > 0) {
        const firstOpenMs = new Date(viewEvents[0].viewedAt).getTime();
        const nowMs = Date.now();
        if (nowMs - firstOpenMs < 60_000) {
          rapidApprovalFlag = true;
          await db.insert(activityLogTable).values({
            projectId,
            userId: req.user!.userId,
            userFullName: req.user!.fullName,
            userCompanyName: req.user!.companyName,
            actionType: "warning",
            entityType: "submittal",
            entityId: submittalId,
            details: `⚠️ RAPID APPROVAL WARNING: Submittal ${existing.number} was approved in under 60 seconds of first being opened. Review may be inadequate.`,
          });
        }
      }
    }

    const [updated] = await db.update(submittalsTable).set({
      status: newStatus,
      reviewDecision: body.reviewDecision,
      complianceNotes: body.complianceNotes || null,
      rejectionReason: body.rejectionReason || null,
      reviewerName: req.user!.fullName,
      reviewedAt: new Date(),
      rapidApprovalFlag,
      updatedAt: new Date(),
    }).where(eq(submittalsTable.id, submittalId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "review",
      entityType: "submittal",
      entityId: submittalId,
      details: `Review decision on ${existing.number}: ${body.reviewDecision}${body.rejectionReason ? ` — ${body.rejectionReason}` : ""}`,
    });

    res.json(subToJson(updated));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Bad request" });
  }
});

// ─── POST /projects/:projectId/submittals/:submittalId/ai-check ───────────────
router.post("/projects/:projectId/submittals/:submittalId/ai-check", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });

    const [sub] = await db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (!sub) { res.status(404).json({ error: "Submittal not found" }); return; }

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const prompt = `You are a BIM/AEC submittal review expert. Analyze this submittal for potential rejection risks based on the 7 most common causes.

Submittal details:
- Title: ${sub.title}
- Spec Section: ${sub.specSection || "Not specified"}
- Category: ${sub.submittalCategory || sub.submittalType}
- Manufacturer: ${sub.manufacturer || "Not specified"}
- Model Number: ${sub.modelNumber || "Not specified"}
- Description: ${sub.description || "Not provided"}

Evaluate against these 7 common rejection causes:
1. Wrong product specs (specs don't match what was specified)
2. Missing data (incomplete product information)
3. Improper substitution (submitting an alternative without justification)
4. Incomplete information (missing required sections)
5. Wrong coatings/finishes (doesn't match spec requirements)
6. Missing certifications (no test reports, listings, or certifications)
7. Overlooked accessories (missing associated components)

Respond ONLY with a JSON object in this exact format:
{
  "overall": "pass" | "possible_issue" | "fail",
  "aspects": [
    { "label": "Wrong product specs", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" },
    { "label": "Missing data", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" },
    { "label": "Improper substitution", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" },
    { "label": "Incomplete information", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" },
    { "label": "Wrong coatings/finishes", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" },
    { "label": "Missing certifications", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" },
    { "label": "Overlooked accessories", "result": "pass" | "possible_issue" | "fail", "note": "brief assessment" }
  ],
  "summary": "one-sentence overall assessment"
}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const aiResult = JSON.parse(raw);

    await db.update(submittalsTable).set({
      aiCheckResult: aiResult,
      aiCheckRan: true,
      updatedAt: new Date(),
    }).where(eq(submittalsTable.id, submittalId));

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "ai_check",
      entityType: "submittal",
      entityId: submittalId,
      details: `AI compliance check on ${sub.number}: ${aiResult.overall} — ${aiResult.summary}`,
    });

    res.json(aiResult);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/submittals/:submittalId/ai-assist-description ──
router.post("/projects/:projectId/submittals/:submittalId/ai-assist-description", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const body = req.body as { userDescription?: string; specSection?: string; submittalCategory?: string; title?: string };
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const prompt = body.userDescription && body.userDescription.trim()
      ? `The user has written the following description of a submittal in plain informal language. Rewrite it as a formal, professional AEC/construction submittal description suitable for an architect or engineer's review. Keep it concise, precise, and technical. Do not add generic filler content. Just rewrite what the user wrote in formal professional language appropriate for an AIA transmittal document. Output only the rewritten description with no preamble or explanation.

User's original text:
${body.userDescription}`
      : `You are a BIM/AEC submittal expert. A contractor is preparing a submittal for:
- Title: ${body.title || "Not specified"}
- Spec Section: ${body.specSection || "Not specified"}
- Category: ${body.submittalCategory || "Not specified"}

Write a concise, formal submittal description under 150 words that covers what is being submitted, its intended use, and relevant compliance or certification notes.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const suggestion = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    res.json({ suggestion });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/submittals/:submittalId/export ──────────────────
router.get("/projects/:projectId/submittals/:submittalId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });

    const [sub] = await db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (!sub) { res.status(404).json({ error: "Submittal not found" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const aiCheck = sub.aiCheckResult as typeof sub.aiCheckResult;
    const bic = (sub.ballInCourtHistory as Array<{ party: string; setAt: string; setBy: string }>) || [];

    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
    doc.page.margins.bottom = 0;
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${sub.number}-Submittal.pdf"`);
      res.setHeader("Content-Length", buf.length);
      res.send(buf);
    });

    let y = MARGIN;

    const sectionHeader = (label: string, color = "#1E3A5F") => {
      if (y > CONTENT_BOT - 20) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
      doc.rect(MARGIN, y, CONTENT_W, 18).fill(color);
      doc.fillColor("white").fontSize(8.5).font("Helvetica-Bold")
        .text(label, MARGIN + 8, y + 5, { lineBreak: false });
      doc.fillColor("black");
      y += 18;
    };

    const row2 = (l1: string, v1: string, l2?: string, v2?: string) => {
      if (y > CONTENT_BOT - 14) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
      const lw = 100; const half = CONTENT_W / 2 - 2;
      doc.rect(MARGIN, y, lw, 14).fill("#F8FAFC");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold").text(l1, MARGIN + 3, y + 4, { width: lw - 4, lineBreak: false });
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v1 || "—", MARGIN + lw + 3, y + 4, { width: half - lw - 6, lineBreak: false });
      if (l2 !== undefined) {
        const col2x = MARGIN + half + 4;
        doc.rect(col2x, y, lw, 14).fill("#F8FAFC");
        doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold").text(l2, col2x + 3, y + 4, { width: lw - 4, lineBreak: false });
        doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v2 || "—", col2x + lw + 3, y + 4, { width: half - lw - 6, lineBreak: false });
      }
      y += 14;
    };

    const textBlock = (label: string, value: string) => {
      if (y > CONTENT_BOT - 20) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
      const lw = 100;
      doc.rect(MARGIN, y, lw, 14).fill("#F8FAFC");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold").text(label, MARGIN + 3, y + 4, { width: lw - 4, lineBreak: false });
      const textH = Math.max(14, doc.heightOfString(value || "—", { width: CONTENT_W - lw - 6 }) + 8);
      if (textH > 14) doc.rect(MARGIN, y + 14, lw, textH - 14).fill("#F8FAFC");
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(value || "—", MARGIN + lw + 3, y + 4, { width: CONTENT_W - lw - 6 });
      y += textH;
    };

    // ── Cover header ──────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 54).fill("#1E3A5F");
    doc.fillColor("white").fontSize(18).font("Helvetica-Bold")
      .text("SUBMITTAL TRANSMITTAL", MARGIN + 12, y + 8, { lineBreak: false });
    doc.fontSize(9).font("Helvetica")
      .text(`BIMLog by IgniteSmart  |  ${project?.name || `Project ${projectId}`}`, MARGIN + 12, y + 30, { lineBreak: false });
    doc.fillColor("black"); y += 62;

    // ── Rapid approval warning ────────────────────────────────────────────────
    if (sub.rapidApprovalFlag) {
      doc.rect(MARGIN, y, CONTENT_W, 22).fill("#FEF3C7");
      doc.rect(MARGIN, y, 4, 22).fill("#D97706");
      doc.fillColor("#B45309").fontSize(8).font("Helvetica-Bold")
        .text("⚠ RAPID APPROVAL FLAG: This submittal was approved in under 60 seconds of first being opened.", MARGIN + 10, y + 7, { width: CONTENT_W - 14, lineBreak: false });
      doc.fillColor("black"); y += 28;
    }

    // ── Header section ────────────────────────────────────────────────────────
    sectionHeader("SUBMITTAL HEADER");
    row2("Submittal No.", sub.number, "Project", project?.name || "—");
    row2("Title", sub.title, "Category", (sub.submittalCategory || sub.submittalType || "").replace(/_/g, " ").toUpperCase());
    row2("Spec Section", sub.specSection || "—", "Drawing No.", sub.drawingNumber || "—");
    row2("Drawing Title", sub.drawingTitle || "—", "Status", (sub.status || "—").replace(/_/g, " ").toUpperCase());
    row2("Date Submitted", fmtD(sub.dateSubmitted || sub.createdAt), "Date Required", fmtD(sub.dateRequired || sub.dueDate));
    row2("Review Decision", sub.reviewDecision ? sub.reviewDecision.replace(/_/g, " ").toUpperCase() : "Pending", "Reviewed", fmtD(sub.reviewedAt));
    y += 6;

    // ── Submitted By ──────────────────────────────────────────────────────────
    sectionHeader("SUBMITTED BY");
    row2("Company", sub.submittedByCompany || "—", "Contact", sub.submittedByPerson || "—");
    row2("Email", sub.submittedByEmail || "—", "Phone", sub.submittedByPhone || "—");
    if (sub.submittedByAddress) row2("Address", sub.submittedByAddress);
    y += 6;

    // ── Submitted To ──────────────────────────────────────────────────────────
    sectionHeader("SUBMITTED TO");
    row2("Company", sub.submittedToCompany || "—", "Contact", sub.submittedToPerson || "—");
    row2("Email", sub.submittedToEmail || "—", "External", sub.submittedToExternal ? "Yes" : "No");
    y += 6;

    // ── Product Information ───────────────────────────────────────────────────
    sectionHeader("PRODUCT INFORMATION");
    row2("Manufacturer", sub.manufacturer || "—", "Model No.", sub.modelNumber || "—");
    row2("Procurement", (sub.procurementStatus || "not_ordered").replace(/_/g, " "), "Ball in Court", sub.ballInCourt || "—");
    y += 4;
    textBlock("Description", sub.description || "—");
    y += 6;

    // ── Review Response ───────────────────────────────────────────────────────
    if (sub.reviewDecision) {
      sectionHeader("REVIEW RESPONSE", "#0F4C75");
      row2("Decision", sub.reviewDecision.replace(/_/g, " ").toUpperCase(), "Reviewer", sub.reviewerName || "—");
      row2("Date Reviewed", fmtD(sub.reviewedAt));
      if (sub.complianceNotes) textBlock("Compliance Notes", sub.complianceNotes);
      if (sub.rejectionReason) textBlock("Rejection Reason", sub.rejectionReason);
      y += 6;
    }

    // ── AI Compliance Check ───────────────────────────────────────────────────
    if (aiCheck && sub.aiCheckRan) {
      sectionHeader("AI COMPLIANCE CHECK RESULTS", "#4C1D95");
      const overallColor = aiCheck.overall === "pass" ? "#15803D" : aiCheck.overall === "fail" ? "#DC2626" : "#D97706";
      doc.rect(MARGIN, y, CONTENT_W, 16).fill("#F5F3FF");
      doc.fillColor(overallColor).fontSize(9).font("Helvetica-Bold")
        .text(`Overall: ${aiCheck.overall.toUpperCase().replace("_", " ")} — ${aiCheck.summary}`, MARGIN + 8, y + 4, { width: CONTENT_W - 16, lineBreak: false });
      doc.fillColor("black"); y += 18;

      const aspects = aiCheck.aspects || [];
      aspects.forEach((a, idx) => {
        if (y > CONTENT_BOT - 14) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(MARGIN, y, CONTENT_W, 14).fill(bg);
        const rc = a.result === "pass" ? "#15803D" : a.result === "fail" ? "#DC2626" : "#D97706";
        doc.fillColor(rc).fontSize(7).font("Helvetica-Bold").text(a.result.toUpperCase().replace("_", " "), MARGIN + 3, y + 3.5, { width: 60, lineBreak: false });
        doc.fillColor("#1E3A5F").fontSize(7).font("Helvetica-Bold").text(a.label, MARGIN + 66, y + 3.5, { width: 120, lineBreak: false });
        doc.fillColor("#374151").fontSize(7).font("Helvetica").text(a.note, MARGIN + 190, y + 3.5, { width: CONTENT_W - 194, lineBreak: false });
        y += 14;
      });
      y += 6;
    }

    // ── Ball in Court History ─────────────────────────────────────────────────
    if (bic.length > 0) {
      sectionHeader("BALL IN COURT HISTORY");
      bic.forEach((entry, idx) => {
        if (y > CONTENT_BOT - 14) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(MARGIN, y, CONTENT_W, 14).fill(bg);
        doc.fillColor("#1E293B").fontSize(8).font("Helvetica")
          .text(`${idx + 1}. ${fmtTs(entry.setAt)}  ·  ${entry.party}  ·  by ${entry.setBy}`, MARGIN + 4, y + 3.5, { width: CONTENT_W - 8, lineBreak: false });
        y += 14;
      });
      y += 6;
    }

    drawFooter(doc, `${sub.number} · Generated ${new Date().toLocaleString()} · BIMLog by IgniteSmart`);
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/submittals/:submittalId/export-word ─────────────
router.get("/projects/:projectId/submittals/:submittalId/export-word", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });
    const [sub] = await db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (!sub) { res.status(404).json({ error: "Submittal not found" }); return; }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const bic = (sub.ballInCourtHistory as Array<{ party: string; setAt: string; setBy: string }>) || [];
    const aiCheck = sub.aiCheckResult as { overall: string; aspects: Array<{ label: string; result: string; note: string }>; summary: string } | null;

    const row = (label: string, value: string) =>
      `<tr><td style="font-weight:bold;width:160px;padding:4px 8px;background:#F0F4F8;border:1px solid #CBD5E1">${label}</td>` +
      `<td style="padding:4px 8px;border:1px solid #CBD5E1">${value || "—"}</td></tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;font-size:11pt;margin:40px}
h1{color:#1E3A5F;font-size:18pt;margin-bottom:4px}
h2{color:#1E3A5F;font-size:12pt;margin-top:20px;margin-bottom:6px;border-bottom:2px solid #1E3A5F;padding-bottom:4px}
table{border-collapse:collapse;width:100%;margin-bottom:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:bold}</style>
</head><body>
<h1>SUBMITTAL TRANSMITTAL</h1>
<p style="color:#64748B;margin-top:0">${project?.name || ""} · ${sub.number} · Generated ${new Date().toLocaleDateString()}</p>
<h2>Header</h2>
<table>${row("Number", sub.number)}${row("Title", sub.title)}${row("Status", sub.status)}${row("Spec Section", sub.specSection || "")}${row("Category", (sub.submittalCategory || sub.submittalType || "").replace(/_/g, " "))}${row("Date Submitted", sub.dateSubmitted ? new Date(sub.dateSubmitted).toLocaleDateString() : "")}${row("Date Required", sub.dateRequired ? new Date(sub.dateRequired).toLocaleDateString() : "")}${row("Ball in Court", sub.ballInCourt || "")}</table>
<h2>Submitted By</h2>
<table>${row("Company", sub.submittedByCompany || "")}${row("Contact", sub.submittedByPerson || "")}${row("Email", sub.submittedByEmail || "")}${row("Phone", sub.submittedByPhone || "")}</table>
<h2>Submitted To</h2>
<table>${row("Company", sub.submittedToCompany || "")}${row("Contact", sub.submittedToPerson || "")}${row("Email", sub.submittedToEmail || "")}</table>
<h2>Product Information</h2>
<table>${row("Manufacturer", sub.manufacturer || "")}${row("Model Number", sub.modelNumber || "")}${row("Drawing Number", sub.drawingNumber || "")}${row("Drawing Title", sub.drawingTitle || "")}${row("Procurement Status", (sub.procurementStatus || "").replace(/_/g, " "))}</table>
${sub.description ? `<h2>Description</h2><p>${sub.description.replace(/\n/g, "<br>")}</p>` : ""}
${sub.reviewDecision ? `<h2>Review Decision</h2><table>${row("Decision", sub.reviewDecision.replace(/_/g, " "))}${row("Reviewer", sub.reviewerName || "")}${row("Date", sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleDateString() : "")}${row("Compliance Notes", sub.complianceNotes || "")}${row("Rejection Reason", sub.rejectionReason || "")}</table>` : ""}
${aiCheck ? `<h2>AI Compliance Check</h2><p><strong>Overall: ${aiCheck.overall.replace("_", " ").toUpperCase()}</strong> — ${aiCheck.summary}</p><table><tr><th style="border:1px solid #CBD5E1;padding:4px 8px">Category</th><th style="border:1px solid #CBD5E1;padding:4px 8px">Result</th><th style="border:1px solid #CBD5E1;padding:4px 8px">Notes</th></tr>${aiCheck.aspects.map(a => `<tr><td style="border:1px solid #CBD5E1;padding:4px 8px">${a.label}</td><td style="border:1px solid #CBD5E1;padding:4px 8px">${a.result.replace("_", " ")}</td><td style="border:1px solid #CBD5E1;padding:4px 8px">${a.note}</td></tr>`).join("")}</table>` : ""}
${bic.length > 0 ? `<h2>Ball in Court History</h2><table><tr><th style="border:1px solid #CBD5E1;padding:4px 8px">Date</th><th style="border:1px solid #CBD5E1;padding:4px 8px">Party</th><th style="border:1px solid #CBD5E1;padding:4px 8px">Set By</th></tr>${bic.map(e => `<tr><td style="border:1px solid #CBD5E1;padding:4px 8px">${new Date(e.setAt).toLocaleDateString()}</td><td style="border:1px solid #CBD5E1;padding:4px 8px">${e.party}</td><td style="border:1px solid #CBD5E1;padding:4px 8px">${e.setBy}</td></tr>`).join("")}</table>` : ""}
<p style="color:#94A3B8;font-size:9pt;margin-top:40px">Generated by BIMLog by IgniteSmart · ${new Date().toLocaleString()}</p>
</body></html>`;

    res.setHeader("Content-Type", "application/msword");
    res.setHeader("Content-Disposition", `attachment; filename="${sub.number}-Submittal.doc"`);
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/submittals/:submittalId/audit-certificate ────────
router.get("/projects/:projectId/submittals/:submittalId/audit-certificate", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({
      projectId: req.params.projectId, submittalId: req.params.submittalId,
    });

    const [sub] = await db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (!sub) { res.status(404).json({ error: "Submittal not found" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const viewEvents = await db.select().from(submittalViewEventsTable)
      .where(eq(submittalViewEventsTable.submittalId, submittalId))
      .orderBy(submittalViewEventsTable.viewedAt);
    const activityLogs = await db.select().from(activityLogTable)
      .where(and(eq(activityLogTable.entityType, "submittal"), eq(activityLogTable.entityId, submittalId)))
      .orderBy(activityLogTable.createdAt);

    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
    doc.page.margins.bottom = 0;
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${sub.number}-AuditCert.pdf"`);
      res.setHeader("Content-Length", buf.length);
      res.send(buf);
    });

    let y = MARGIN;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 44).fill("#1E3A5F");
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
      .text("IMMUTABLE AUDIT CERTIFICATE", MARGIN + 12, y + 8, { lineBreak: false });
    doc.fontSize(9).font("Helvetica")
      .text(`BIMLog by IgniteSmart  |  Generated ${new Date().toLocaleString()}`, MARGIN + 12, y + 28, { lineBreak: false });
    doc.fillColor("black"); y += 52;

    // ── Submittal Info ────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 16).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("SUBMITTAL INFORMATION", MARGIN + 6, y + 4.5);
    doc.fillColor("black"); y += 16;

    const half = CONTENT_W / 2 - 2;
    const drawAuditRow = (l1: string, v1: string, l2?: string, v2?: string) => {
      const lw = 110;
      doc.rect(MARGIN, y, lw, 16).fill("#F8FAFC");
      doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text(l1, MARGIN + 3, y + 4.5, { width: lw - 4, lineBreak: false });
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v1, MARGIN + lw + 3, y + 4.5, { width: half - lw - 6, lineBreak: false });
      if (l2 !== undefined) {
        const col2x = MARGIN + half + 4;
        doc.rect(col2x, y, lw, 16).fill("#F8FAFC");
        doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text(l2, col2x + 3, y + 4.5, { width: lw - 4, lineBreak: false });
        doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v2 || "—", col2x + lw + 3, y + 4.5, { width: half - lw - 6, lineBreak: false });
      }
      y += 16;
    };
    drawAuditRow("Submittal No.", sub.number, "Project", project?.name || "—");
    drawAuditRow("Title", sub.title);
    drawAuditRow("Status", (sub.status || "").replace(/_/g, " "), "Review Decision", sub.reviewDecision || "Pending");
    drawAuditRow("Date Created", fmtD(sub.createdAt), "Date Required", fmtD(sub.dateRequired || sub.dueDate));
    drawAuditRow("Reviewer", sub.reviewerName || "—", "Date Reviewed", fmtD(sub.reviewedAt));
    if (sub.rapidApprovalFlag) {
      doc.rect(MARGIN, y, CONTENT_W, 16).fill("#FEF3C7");
      doc.fillColor("#B45309").fontSize(7).font("Helvetica-Bold")
        .text("⚠ RAPID APPROVAL FLAG: Approved in under 60 seconds of first open.", MARGIN + 4, y + 4.5, { lineBreak: false });
      doc.fillColor("black"); y += 16;
    }
    y += 6;

    // ── View Events ────────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 16).fill("#0F4C75");
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
      .text("IMMUTABLE VIEW & ACCESS LOG", MARGIN + 6, y + 4.5);
    doc.fillColor("black"); y += 16;

    if (viewEvents.length === 0) {
      doc.rect(MARGIN, y, CONTENT_W, 24).stroke("#E2E8F0");
      doc.fillColor("#94A3B8").fontSize(9).font("Helvetica").text("No view events recorded.", MARGIN + 6, y + 7.5, { width: CONTENT_W - 12, lineBreak: false });
      y += 28;
    } else {
      const cols = [40, 180, 160, CONTENT_W - 40 - 180 - 160 - 6];
      const colX = [MARGIN, MARGIN + 40, MARGIN + 220, MARGIN + 380];
      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#E2E8F0");
      ["#", "Timestamp", "User", "Company"].forEach((h, i) => {
        doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text(h, colX[i] + 3, y + 3.5, { width: cols[i] - 4, lineBreak: false });
      });
      y += 14;
      viewEvents.forEach((evt, idx) => {
        if (y > CONTENT_BOT - 14) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(MARGIN, y, CONTENT_W, 14).fill(bg);
        [String(idx + 1), fmtTs(evt.viewedAt), evt.userFullName, evt.userCompanyName].forEach((v, i) => {
          doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v, colX[i] + 3, y + 3, { width: cols[i] - 4, lineBreak: false });
        });
        y += 14;
      });
    }
    y += 8;

    // ── Activity Log ───────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 16).fill("#1E3A5F");
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold").text("ACTIVITY LOG", MARGIN + 6, y + 4.5);
    doc.fillColor("black"); y += 16;

    activityLogs.forEach((log, idx) => {
      if (y > CONTENT_BOT - 14) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
      const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
      const logH = Math.max(14, doc.heightOfString(log.details || "", { width: CONTENT_W - 240 }) + 6);
      doc.rect(MARGIN, y, CONTENT_W, logH).fill(bg);
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(fmtTs(log.createdAt), MARGIN + 3, y + 3.5, { width: 120, lineBreak: false });
      doc.fillColor("#1E3A5F").fontSize(7).font("Helvetica-Bold").text(log.userFullName, MARGIN + 125, y + 3.5, { width: 110, lineBreak: false });
      doc.fillColor("#374151").fontSize(7).font("Helvetica").text(log.details || "", MARGIN + 238, y + 3.5, { width: CONTENT_W - 240 });
      y += logH;
    });
    y += 8;

    // ── Certification footer ───────────────────────────────────────────────────
    if (y > CONTENT_BOT - 50) { doc.addPage(); doc.page.margins.bottom = 0; y = MARGIN; }
    doc.rect(MARGIN, y, CONTENT_W, 50).fill("#F8FAFC").stroke("#CBD5E1");
    doc.fillColor("#334155").fontSize(7).font("Helvetica")
      .text(
        `This certificate certifies that the above log is a complete and unaltered record of all access and activity events for submittal ${sub.number} as maintained by BIMLog by IgniteSmart. ` +
        `Total view events: ${viewEvents.length}. Total activity entries: ${activityLogs.length}. ` +
        `Certificate generated: ${new Date().toISOString()}.`,
        MARGIN + 8, y + 8, { width: CONTENT_W - 16 }
      );

    drawFooter(doc, `${sub.number} Audit Certificate · BIMLog by IgniteSmart`);
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/submittal-register ──────────────────────────────
router.get("/projects/:projectId/submittal-register", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListSubmittalsParams.parse({ projectId: req.params.projectId });
    const items = await db.select().from(submittalRegisterTable)
      .where(eq(submittalRegisterTable.projectId, projectId))
      .orderBy(submittalRegisterTable.specSection, submittalRegisterTable.dateCreated);
    res.json(items.map(i => ({ ...i, dateCreated: i.dateCreated?.toISOString() })));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/submittal-register ─────────────────────────────
router.post("/projects/:projectId/submittal-register", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListSubmittalsParams.parse({ projectId: req.params.projectId });
    const body = req.body as {
      specSection: string; description: string; trade?: string; submittalType?: string;
      requiredByDate?: string; leadTimeDays?: number; responsibleCompany?: string; status?: string;
    };
    if (!body.specSection || !body.description) {
      res.status(400).json({ error: "specSection and description are required" });
      return;
    }
    const [item] = await db.insert(submittalRegisterTable).values({
      projectId,
      specSection: body.specSection,
      description: body.description,
      trade: body.trade || null,
      submittalType: body.submittalType || null,
      requiredByDate: body.requiredByDate || null,
      leadTimeDays: body.leadTimeDays || null,
      responsibleCompany: body.responsibleCompany || null,
      status: body.status || "pending",
    }).returning();
    res.status(201).json({ ...item, dateCreated: item.dateCreated?.toISOString() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Bad request" });
  }
});

// ─── PATCH /projects/:projectId/submittal-register/:itemId ───────────────────
router.patch("/projects/:projectId/submittal-register/:itemId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const itemId = parseInt(String(req.params.itemId));
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    ["specSection", "description", "trade", "submittalType", "requiredByDate", "responsibleCompany", "status"]
      .forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
    if (body.leadTimeDays !== undefined) updates.leadTimeDays = body.leadTimeDays;
    const [updated] = await db.update(submittalRegisterTable).set(updates)
      .where(and(eq(submittalRegisterTable.id, itemId), eq(submittalRegisterTable.projectId, projectId)))
      .returning();
    res.json({ ...updated, dateCreated: updated.dateCreated?.toISOString() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Bad request" });
  }
});

// ─── DELETE /projects/:projectId/submittal-register/:itemId ──────────────────
router.delete("/projects/:projectId/submittal-register/:itemId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const itemId = parseInt(String(req.params.itemId));
    await db.delete(submittalRegisterTable)
      .where(and(eq(submittalRegisterTable.id, itemId), eq(submittalRegisterTable.projectId, projectId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/submittals/:submittalId/ai-draft-rejection ─────
router.post("/projects/:projectId/submittals/:submittalId/ai-draft-rejection", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const body = req.body as { existingReason?: string; reviewDecision?: string; complianceNotes?: string; title?: string; specSection?: string };
    if (!body.existingReason?.trim()) {
      res.status(400).json({ error: "Enter a rejection reason first, then click AI Draft Rejection to rewrite it professionally." });
      return;
    }
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
    const prompt = `You are a senior construction project manager or architect. The following is a draft rejection reason for a submittal. Rewrite it as a formal, professional rejection notice specifying exactly what needs to be corrected and why. Be precise, technical, and reference the relevant spec section or standard if mentioned. Output only the rewritten rejection reason with no preamble.

Submittal title: ${body.title || "Not specified"}
Spec section: ${body.specSection || "Not specified"}
Review decision: ${body.reviewDecision || "Not specified"}
Compliance notes: ${body.complianceNotes || "None"}

Original rejection reason:
${body.existingReason}`;
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const suggestion = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    res.json({ suggestion });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/submittals/inline-ai-check ──────────────────────
router.post("/projects/:projectId/submittals/inline-ai-check", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = req.params;
    const body = req.body as {
      title?: string; specSection?: string; submittalCategory?: string; submittedByCompany?: string;
      submittedToCompany?: string; description?: string; manufacturer?: string; modelNumber?: string;
    };
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
      .where(eq(projectsTable.id, parseInt(projectId as string))).limit(1);

    const prompt = `You are a BIM/AEC submittal compliance expert. Analyze this unsaved submittal for compliance risks and completeness BEFORE it is submitted. Return valid JSON only.

Project: ${project?.name || "Unknown"}
Title: ${body.title || "Not provided"}
Spec Section: ${body.specSection || "Not provided"}
Category: ${body.submittalCategory || "Not provided"}
Submitted By: ${body.submittedByCompany || "Not provided"}
Submitted To: ${body.submittedToCompany || "Not provided"}
Manufacturer: ${body.manufacturer || "Not provided"}
Model Number: ${body.modelNumber || "Not provided"}
Description: ${body.description || "Not provided"}

Analyze the above submittal information and return this exact JSON structure:
{
  "overall": "pass" | "warning" | "fail",
  "summary": "One sentence summary of the compliance check result",
  "checks": [
    { "category": "Category name", "status": "pass" | "warning" | "fail", "message": "Specific finding" }
  ]
}

Check for: missing required fields, spec section format (XX XX XX), naming convention adherence, completeness of product info, and any obvious compliance risks.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall: "warning", summary: "Could not analyze submittal.", checks: [] };
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
