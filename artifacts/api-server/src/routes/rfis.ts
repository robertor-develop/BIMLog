import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rfisTable, usersTable, activityLogTable, projectsTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { CreateRfiBody, ListRfisParams, UpdateRfiParams, UpdateRfiBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue, getDefaultValue, getConfigOptionMeta } from "../middlewares/config-validator";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

function rfiToJson(r: typeof rfisTable.$inferSelect, extras: Record<string, unknown> = {}) {
  return {
    ...r,
    ...extras,
    dueDate: r.dueDate?.toISOString(),
    respondedAt: r.respondedAt?.toISOString(),
    dateRequested: r.dateRequested?.toISOString(),
    dateRequired: r.dateRequired?.toISOString(),
    dateAnswered: r.dateAnswered?.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── GET /projects/:projectId/rfis ──────────────────────────────────────────
router.get("/projects/:projectId/rfis", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });

    const rfis = await db.query.rfisTable.findMany({
      where: eq(rfisTable.projectId, projectId),
      orderBy: (rfis, { asc }) => [asc(rfis.createdAt)],
    });

    const results = await Promise.all(
      rfis.map(async (r) => {
        const creator = await db.select().from(usersTable).where(eq(usersTable.id, r.createdById)).limit(1);
        let assignedToName: string | undefined;
        if (r.assignedToId) {
          const assignee = await db.select().from(usersTable).where(eq(usersTable.id, r.assignedToId)).limit(1);
          assignedToName = assignee[0]?.fullName;
        }
        return rfiToJson(r, { createdByName: creator[0]?.fullName || "", assignedToName });
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis ─────────────────────────────────────────
router.post("/projects/:projectId/rfis", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });
    const body = CreateRfiBody.parse(req.body);

    if (body.priority && !(await validateConfigValue("rfi_priority", body.priority))) {
      res.status(422).json({ error: `Invalid priority value: ${body.priority}` });
      return;
    }

    const [rfiCount] = await db.select({ count: count() }).from(rfisTable).where(eq(rfisTable.projectId, projectId));
    const number = `RFI-${String((rfiCount.count as number) + 1).padStart(4, "0")}`;

    const defaultRfiStatus = await getDefaultValue("rfi_status");
    const [rfi] = await db.insert(rfisTable).values({
      projectId,
      number,
      subject: body.subject,
      description: body.description || null,
      status: defaultRfiStatus,
      priority: body.priority,
      assignedToId: body.assignedToId || null,
      createdById: req.user!.userId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      dateRequested: body.dateRequested ? new Date(body.dateRequested) : new Date(),
      dateRequired: body.dateRequired ? new Date(body.dateRequired) : null,
      submittedByCompany: body.submittedByCompany || null,
      submittedByContact: body.submittedByContact || null,
      submittedByAddress: body.submittedByAddress || null,
      submittedByPhone: body.submittedByPhone || null,
      submittedByEmail: body.submittedByEmail || null,
      submittedToCompany: body.submittedToCompany || null,
      submittedToPerson: body.submittedToPerson || null,
      submittedToEmail: body.submittedToEmail || null,
      drawingNumber: body.drawingNumber || null,
      drawingTitle: body.drawingTitle || null,
      specSection: body.specSection || null,
      detailNumber: body.detailNumber || null,
      noteNumber: body.noteNumber || null,
      locationDescription: body.locationDescription || null,
      question: body.question || null,
      costImpact: body.costImpact || null,
      costImpactAmount: body.costImpactAmount || null,
      scheduleImpact: body.scheduleImpact || null,
      scheduleImpactDays: body.scheduleImpactDays || null,
      distributionList: body.distributionList || [],
      attachmentsJson: body.attachmentsJson || [],
      projectAddress: body.projectAddress || null,
      revisionNumber: 0,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "rfi",
      entityId: rfi.id,
      details: `Created RFI ${number}: ${body.subject}`,
    });

    res.status(201).json(rfiToJson(rfi, { createdByName: req.user!.fullName }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── PATCH /projects/:projectId/rfis/:rfiId ─────────────────────────────────
router.patch("/projects/:projectId/rfis/:rfiId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    const body = UpdateRfiBody.parse(req.body);

    const existing = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    if (body.status && !(await validateConfigValue("rfi_status", body.status))) {
      res.status(422).json({ error: `Invalid status value: ${body.status}` });
      return;
    }
    if (body.priority && !(await validateConfigValue("rfi_priority", body.priority))) {
      res.status(422).json({ error: `Invalid priority value: ${body.priority}` });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.subject) updates.subject = body.subject;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status) {
      updates.status = body.status;
      const statusMeta = await getConfigOptionMeta("rfi_status", body.status);
      if (String(statusMeta?.setsRespondedAt) === "true") {
        updates.respondedAt = new Date();
      }
    }
    if (body.priority) updates.priority = body.priority;
    if (body.assignedToId !== undefined) updates.assignedToId = body.assignedToId;
    if (body.response !== undefined) updates.response = body.response;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.dateRequested !== undefined) updates.dateRequested = body.dateRequested ? new Date(body.dateRequested) : null;
    if (body.dateRequired !== undefined) updates.dateRequired = body.dateRequired ? new Date(body.dateRequired) : null;
    if (body.submittedByCompany !== undefined) updates.submittedByCompany = body.submittedByCompany;
    if (body.submittedByContact !== undefined) updates.submittedByContact = body.submittedByContact;
    if (body.submittedByAddress !== undefined) updates.submittedByAddress = body.submittedByAddress;
    if (body.submittedByPhone !== undefined) updates.submittedByPhone = body.submittedByPhone;
    if (body.submittedByEmail !== undefined) updates.submittedByEmail = body.submittedByEmail;
    if (body.submittedToCompany !== undefined) updates.submittedToCompany = body.submittedToCompany;
    if (body.submittedToPerson !== undefined) updates.submittedToPerson = body.submittedToPerson;
    if (body.submittedToEmail !== undefined) updates.submittedToEmail = body.submittedToEmail;
    if (body.drawingNumber !== undefined) updates.drawingNumber = body.drawingNumber;
    if (body.drawingTitle !== undefined) updates.drawingTitle = body.drawingTitle;
    if (body.specSection !== undefined) updates.specSection = body.specSection;
    if (body.detailNumber !== undefined) updates.detailNumber = body.detailNumber;
    if (body.noteNumber !== undefined) updates.noteNumber = body.noteNumber;
    if (body.locationDescription !== undefined) updates.locationDescription = body.locationDescription;
    if (body.question !== undefined) updates.question = body.question;
    if (body.costImpact !== undefined) updates.costImpact = body.costImpact;
    if (body.costImpactAmount !== undefined) updates.costImpactAmount = body.costImpactAmount;
    if (body.scheduleImpact !== undefined) updates.scheduleImpact = body.scheduleImpact;
    if (body.scheduleImpactDays !== undefined) updates.scheduleImpactDays = body.scheduleImpactDays;
    if (body.answer !== undefined) {
      updates.answer = body.answer;
      if (body.answer && !existing[0].dateAnswered) {
        updates.dateAnswered = new Date();
        updates.respondedAt = new Date();
      }
    }
    if (body.answeredBy !== undefined) updates.answeredBy = body.answeredBy;
    if (body.dateAnswered !== undefined) updates.dateAnswered = body.dateAnswered ? new Date(body.dateAnswered) : null;
    if (body.distributionList !== undefined) updates.distributionList = body.distributionList;
    if (body.attachmentsJson !== undefined) updates.attachmentsJson = body.attachmentsJson;
    if (body.projectAddress !== undefined) updates.projectAddress = body.projectAddress;

    const [updated] = await db.update(rfisTable).set(updates).where(eq(rfisTable.id, rfiId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "rfi",
      entityId: rfiId,
      details: `Updated RFI ${updated.number}${body.status ? ` → status: ${body.status}` : ""}${body.answer ? " (answered)" : ""}`,
    });

    res.json(rfiToJson(updated, { createdByName: req.user!.fullName }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/revise ───────────────────────────
router.post("/projects/:projectId/rfis/:rfiId/revise", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const existing = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    const orig = existing[0];
    const parentId = orig.parentRfiId ?? orig.id;

    const siblings = await db.select({ count: count() }).from(rfisTable)
      .where(and(
        eq(rfisTable.projectId, projectId),
        // count revisions of same parent
      ));
    const revNum = (orig.revisionNumber ?? 0) + 1;
    const newNumber = `${orig.number.replace(/-R\d+$/, "")}-R${revNum}`;

    const defaultStatus = await getDefaultValue("rfi_status");

    const [newRfi] = await db.insert(rfisTable).values({
      projectId,
      number: newNumber,
      subject: orig.subject,
      description: orig.description,
      status: defaultStatus,
      priority: orig.priority,
      createdById: req.user!.userId,
      dateRequested: new Date(),
      dateRequired: orig.dateRequired,
      submittedByCompany: orig.submittedByCompany,
      submittedByContact: orig.submittedByContact,
      submittedByAddress: orig.submittedByAddress,
      submittedByPhone: orig.submittedByPhone,
      submittedByEmail: orig.submittedByEmail,
      submittedToCompany: orig.submittedToCompany,
      submittedToPerson: orig.submittedToPerson,
      submittedToEmail: orig.submittedToEmail,
      drawingNumber: orig.drawingNumber,
      drawingTitle: orig.drawingTitle,
      specSection: orig.specSection,
      detailNumber: orig.detailNumber,
      noteNumber: orig.noteNumber,
      locationDescription: orig.locationDescription,
      question: orig.question,
      costImpact: orig.costImpact,
      costImpactAmount: orig.costImpactAmount,
      scheduleImpact: orig.scheduleImpact,
      scheduleImpactDays: orig.scheduleImpactDays,
      distributionList: orig.distributionList as string[],
      attachmentsJson: orig.attachmentsJson as string[],
      projectAddress: orig.projectAddress,
      parentRfiId: parentId,
      revisionNumber: revNum,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "rfi",
      entityId: newRfi.id,
      details: `Created revision ${newNumber} from ${orig.number}`,
    });

    res.status(201).json(rfiToJson(newRfi, { createdByName: req.user!.fullName }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── GET /projects/:projectId/rfis/:rfiId/export ────────────────────────────
router.get("/projects/:projectId/rfis/:rfiId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const creator = await db.select().from(usersTable).where(eq(usersTable.id, rfi.createdById)).limit(1);

    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${rfi.number}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    const fmt = (d: Date | string | null | undefined) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";
    const val = (v: string | null | undefined) => v || "—";

    // Header bar
    doc.rect(50, 50, 512, 60).fill("#1E3A5F");
    doc.fillColor("white").fontSize(18).font("Helvetica-Bold")
      .text("REQUEST FOR INFORMATION", 60, 65, { width: 400 });
    doc.fontSize(12).font("Helvetica")
      .text(rfi.number, 460, 72, { align: "right", width: 100 });

    doc.fillColor("black").moveDown(2);

    // Project info box
    const y1 = 125;
    doc.rect(50, y1, 512, 50).stroke("#CBD5E1");
    doc.fontSize(8).fillColor("#64748B").font("Helvetica-Bold")
      .text("PROJECT", 60, y1 + 6).text("DATE REQUESTED", 280, y1 + 6).text("DATE REQUIRED", 420, y1 + 6);
    doc.fontSize(11).fillColor("black").font("Helvetica")
      .text(project?.name || "—", 60, y1 + 20, { width: 200 })
      .text(fmt(rfi.dateRequested || rfi.createdAt), 280, y1 + 20)
      .text(fmt(rfi.dateRequired || rfi.dueDate), 420, y1 + 20);

    if (rfi.projectAddress) {
      doc.fontSize(9).fillColor("#475569").text(rfi.projectAddress, 60, y1 + 34, { width: 200 });
    }

    doc.moveDown(0.5);
    let y = y1 + 65;

    const drawSection = (title: string, fields: [string, string | null | undefined][]) => {
      doc.rect(50, y, 512, 18).fill("#F1F5F9");
      doc.fillColor("#1E3A5F").fontSize(9).font("Helvetica-Bold").text(title, 56, y + 5);
      doc.fillColor("black");
      y += 18;

      const colW = 256;
      fields.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = col === 0 ? 50 : 306;
        const fy = y + row * 28;
        doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold").text(label.toUpperCase(), fx + 6, fy + 4, { width: colW - 12 });
        doc.fontSize(10).fillColor("black").font("Helvetica").text(val(value), fx + 6, fy + 14, { width: colW - 12 });
        if (col === 1 || i === fields.length - 1) {
          doc.moveTo(50, fy + 28).lineTo(562, fy + 28).stroke("#E2E8F0");
        }
      });

      const rows = Math.ceil(fields.length / 2);
      y += rows * 28 + 4;
    };

    // Subject + priority
    doc.rect(50, y, 512, 18).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(9).font("Helvetica-Bold").text("SUBJECT & PRIORITY", 56, y + 5);
    y += 18;
    doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold").text("SUBJECT", 56, y + 4);
    doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold").text("PRIORITY / STATUS", 400, y + 4);
    doc.fontSize(11).fillColor("black").font("Helvetica").text(rfi.subject, 56, y + 14, { width: 320 });
    doc.fontSize(10).fillColor("black").font("Helvetica").text(`${rfi.priority?.toUpperCase()} / ${rfi.status?.replace("_", " ").toUpperCase()}`, 400, y + 14, { width: 160 });
    doc.moveTo(50, y + 32).lineTo(562, y + 32).stroke("#E2E8F0");
    y += 36;

    drawSection("SUBMITTED BY", [
      ["Company", rfi.submittedByCompany || creator[0]?.fullName],
      ["Contact Person", rfi.submittedByContact],
      ["Address", rfi.submittedByAddress],
      ["Phone", rfi.submittedByPhone],
      ["Email", rfi.submittedByEmail],
    ]);

    drawSection("SUBMITTED TO", [
      ["Company", rfi.submittedToCompany],
      ["Contact Person", rfi.submittedToPerson],
      ["Email", rfi.submittedToEmail],
    ]);

    drawSection("REFERENCE INFORMATION", [
      ["Drawing Number", rfi.drawingNumber],
      ["Drawing Title", rfi.drawingTitle],
      ["Spec Section", rfi.specSection],
      ["Detail Number", rfi.detailNumber],
      ["Note Number", rfi.noteNumber],
      ["Location", rfi.locationDescription],
    ]);

    // Question block
    doc.rect(50, y, 512, 18).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(9).font("Helvetica-Bold").text("DESCRIPTION OF QUESTION", 56, y + 5);
    y += 18;
    const questionText = rfi.question || rfi.description || "No question text provided.";
    doc.rect(50, y, 512, 0).stroke("#E2E8F0");
    doc.fontSize(10).fillColor("black").font("Helvetica").text(questionText, 56, y + 6, { width: 500 });
    const qHeight = doc.heightOfString(questionText, { width: 500 }) + 18;
    doc.rect(50, y, 512, qHeight).stroke("#E2E8F0");
    y += qHeight + 6;

    // Attachments
    const attList = (rfi.attachmentsJson as string[] | null) || [];
    if (attList.length > 0) {
      doc.rect(50, y, 512, 18).fill("#F1F5F9");
      doc.fillColor("#1E3A5F").fontSize(9).font("Helvetica-Bold").text("ATTACHMENTS", 56, y + 5);
      y += 18;
      attList.forEach((a, i) => {
        doc.fontSize(9).fillColor("#1D4ED8").font("Helvetica").text(`${i + 1}. ${a}`, 56, y + 4, { width: 500 });
        y += 16;
      });
      y += 4;
    }

    drawSection("IMPACT ASSESSMENT", [
      ["Cost Impact", rfi.costImpact],
      ["Cost Impact Amount", rfi.costImpact === "Cost Increase Known" ? rfi.costImpactAmount : undefined],
      ["Schedule Impact", rfi.scheduleImpact],
      ["Schedule Impact Days", rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : undefined],
    ]);

    // Response / Answer block
    doc.rect(50, y, 512, 18).fill("#0F4C75").fillColor("white").fontSize(9).font("Helvetica-Bold").text("RESPONSE", 56, y + 5);
    y += 18;
    if (rfi.answer || rfi.response) {
      doc.fontSize(10).fillColor("black").font("Helvetica").text(rfi.answer || rfi.response || "", 56, y + 6, { width: 500 });
      const ansH = doc.heightOfString(rfi.answer || rfi.response || "", { width: 500 }) + 18;
      doc.rect(50, y, 512, ansH).stroke("#E2E8F0");
      y += ansH + 4;

      doc.fontSize(8).fillColor("#64748B").font("Helvetica-Bold").text("ANSWERED BY", 56, y + 4);
      doc.fontSize(8).fillColor("#64748B").font("Helvetica-Bold").text("DATE ANSWERED", 300, y + 4);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(val(rfi.answeredBy), 56, y + 14);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(fmt(rfi.dateAnswered || rfi.respondedAt), 300, y + 14);
      doc.moveTo(50, y + 30).lineTo(562, y + 30).stroke("#E2E8F0");
      y += 34;
    } else {
      doc.rect(50, y, 512, 60).stroke("#E2E8F0");
      doc.fontSize(10).fillColor("#94A3B8").font("Helvetica").text("No response provided yet.", 56, y + 24, { width: 500, align: "center" });
      y += 64;
    }

    // Footer
    doc.fontSize(7).fillColor("#94A3B8")
      .text(`Generated by BIMLog by IgniteSmart  |  ${rfi.number}  |  ${new Date().toLocaleDateString()}`, 50, 740, { width: 512, align: "center" });

    doc.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── POST /rfis/generate-question ───────────────────────────────────────────
router.post("/rfis/generate-question", authMiddleware, async (req, res) => {
  try {
    const { description, projectName, subject } = req.body as { description: string; projectName?: string; subject?: string };
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const prompt = `You are a construction project manager. Convert the following informal description into a formal, professional RFI (Request for Information) question suitable for an AEC/construction project.

The question should:
- Be written in professional construction industry language
- Clearly state the issue or ambiguity that needs clarification
- Reference drawing numbers or spec sections if provided
- Request a specific type of response or clarification
- Be concise but complete (2-4 paragraphs maximum)

${projectName ? `Project: ${projectName}` : ""}
${subject ? `RFI Subject: ${subject}` : ""}
Issue Description: ${description}

Write only the formal RFI question text, nothing else.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const question = block.type === "text" ? block.text : "";

    res.json({ question });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate question";
    res.status(500).json({ error: message });
  }
});

export default router;
