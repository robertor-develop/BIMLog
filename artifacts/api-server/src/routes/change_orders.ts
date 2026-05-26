import { Router } from "express";
import { db } from "@workspace/db";
import {
  changeOrdersTable, changeOrderDocumentsTable, activityLogTable,
  projectsTable, rfisTable, submittalsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { createNotification } from "./notifications";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import PDFDocument from "pdfkit";
import { extractFileText } from "../lib/extract-file-text";

const router: Router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});

async function nextCONumber(projectId: number, projectCode: string): Promise<string> {
  const existing = await db.select({ id: changeOrdersTable.id })
    .from(changeOrdersTable).where(eq(changeOrdersTable.projectId, projectId));
  const seq = String(existing.length + 1).padStart(4, "0");
  return `CO-${projectCode}-${seq}`;
}

// ── GET /projects/:projectId/change-orders ────────────────────────────────────
router.get("/projects/:projectId/change-orders", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const rows = await db.select().from(changeOrdersTable)
      .where(eq(changeOrdersTable.projectId, projectId))
      .orderBy(desc(changeOrdersTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/change-orders ───────────────────────────────────
router.post("/projects/:projectId/change-orders", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as {
    title: string; description?: string; contract_value_impact?: string;
    schedule_impact_days?: number; linked_rfi_ids?: number[]; linked_submittal_ids?: number[];
  };
  if (!body.title) { res.status(400).json({ error: "title required" }); return; }
  try {
    const project = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const number = await nextCONumber(projectId, project[0]?.code ?? "PRJ");

    const [co] = await db.insert(changeOrdersTable).values({
      projectId, number, title: body.title,
      description: body.description ?? null,
      status: "draft",
      initiatedById: req.user!.userId,
      contractValueImpact: body.contract_value_impact ?? null,
      scheduleImpactDays: body.schedule_impact_days ?? null,
      linkedRfiIds: body.linked_rfi_ids ?? null,
      linkedSubmittalIds: body.linked_submittal_ids ?? null,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "change_order", entityId: co.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created change order ${number}: ${body.title}`,
    });
    res.status(201).json(co);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/change-orders/:changeOrderId ─────────────────────
router.get("/projects/:projectId/change-orders/:changeOrderId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const coId = Number(req.params.changeOrderId);
  try {
    const [co] = await db.select().from(changeOrdersTable)
      .where(and(eq(changeOrdersTable.id, coId), eq(changeOrdersTable.projectId, projectId)));
    if (!co) { res.status(404).json({ error: "Not found" }); return; }

    const linkedRfiIds = (co.linkedRfiIds as number[] | null) ?? [];
    const linkedSubIds = (co.linkedSubmittalIds as number[] | null) ?? [];
    const rfis = linkedRfiIds.length ? await db.select({ id: rfisTable.id, number: rfisTable.number, subject: rfisTable.subject }).from(rfisTable).where(inArray(rfisTable.id, linkedRfiIds)) : [];
    const subs = linkedSubIds.length ? await db.select({ id: submittalsTable.id, number: submittalsTable.number, title: submittalsTable.title }).from(submittalsTable).where(inArray(submittalsTable.id, linkedSubIds)) : [];
    const docs = await db.select().from(changeOrderDocumentsTable).where(eq(changeOrderDocumentsTable.changeOrderId, coId));

    res.json({ ...co, linkedRfis: rfis, linkedSubmittals: subs, documents: docs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/change-orders/:changeOrderId ───────────────────
router.patch("/projects/:projectId/change-orders/:changeOrderId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const coId = Number(req.params.changeOrderId);
  const body = req.body as Partial<{
    title: string; description: string; contract_value_impact: string;
    schedule_impact_days: number; linked_rfi_ids: number[]; linked_submittal_ids: number[];
  }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)               updates.title              = body.title;
    if (body.description !== undefined)         updates.description        = body.description;
    if (body.contract_value_impact !== undefined) updates.contractValueImpact = body.contract_value_impact;
    if (body.schedule_impact_days !== undefined)  updates.scheduleImpactDays = body.schedule_impact_days;
    if (body.linked_rfi_ids !== undefined)        updates.linkedRfiIds       = body.linked_rfi_ids;
    if (body.linked_submittal_ids !== undefined)  updates.linkedSubmittalIds = body.linked_submittal_ids;
    const [updated] = await db.update(changeOrdersTable).set(updates as any)
      .where(and(eq(changeOrdersTable.id, coId), eq(changeOrdersTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST submit / approve / reject ────────────────────────────────────────────
for (const action of ["submit", "approve", "reject"] as const) {
  const statusMap = { submit: "pending_approval", approve: "approved", reject: "rejected" } as const;
  router.post(`/projects/:projectId/change-orders/:changeOrderId/${action}`, authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const coId = Number(req.params.changeOrderId);
    try {
      const updates: Record<string, unknown> = { status: statusMap[action], updatedAt: new Date() };
      if (action === "approve") { updates.approvedById = req.user!.userId; updates.approvedAt = new Date(); }
      await db.update(changeOrdersTable).set(updates as any)
        .where(and(eq(changeOrdersTable.id, coId), eq(changeOrdersTable.projectId, projectId)));
      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
        actionType: action, entityType: "change_order", entityId: coId,
        fileNameBefore: null, fileNameAfter: null,
        details: `Change order ${action}ed`,
      });
      res.json({ ok: true, status: statusMap[action] });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  });
}

// ── POST /projects/:projectId/change-orders/:changeOrderId/ai-draft ───────────
router.post("/projects/:projectId/change-orders/:changeOrderId/ai-draft", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const coId = Number(req.params.changeOrderId);
  try {
    const [co] = await db.select().from(changeOrdersTable)
      .where(and(eq(changeOrdersTable.id, coId), eq(changeOrdersTable.projectId, projectId)));
    if (!co) { res.status(404).json({ error: "Not found" }); return; }

    const linkedRfiIds = (co.linkedRfiIds as number[] | null) ?? [];
    const linkedSubIds = (co.linkedSubmittalIds as number[] | null) ?? [];
    const rfis = linkedRfiIds.length ? await db.select({ number: rfisTable.number, subject: rfisTable.subject, question: rfisTable.question }).from(rfisTable).where(inArray(rfisTable.id, linkedRfiIds)) : [];
    const subs = linkedSubIds.length ? await db.select({ number: submittalsTable.number, title: submittalsTable.title }).from(submittalsTable).where(inArray(submittalsTable.id, linkedSubIds)) : [];

    const prompt = `You are a construction change order specialist. Draft a professional description and cost/schedule impact for this change order.
Title: ${co.title}
Linked RFIs: ${rfis.map(r => `${r.number}: ${r.subject}`).join(", ") || "none"}
Linked Submittals: ${subs.map(s => `${s.number}: ${s.title}`).join(", ") || "none"}
Return JSON only: { "description": "...", "suggested_cost_impact": "...", "suggested_schedule_impact": "..." }`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5", max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
    await db.update(changeOrdersTable).set({ aiDraftUsed: true, updatedAt: new Date() }).where(eq(changeOrdersTable.id, coId));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/change-orders/:changeOrderId/export ──────────────
router.get("/projects/:projectId/change-orders/:changeOrderId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const coId = Number(req.params.changeOrderId);
  try {
    const [co] = await db.select().from(changeOrdersTable)
      .where(and(eq(changeOrdersTable.id, coId), eq(changeOrdersTable.projectId, projectId)));
    if (!co) { res.status(404).json({ error: "Not found" }); return; }
    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="co-${co.number}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).font("Helvetica-Bold").text("CHANGE ORDER", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(`Project: ${project[0]?.name ?? ""} (${project[0]?.code ?? ""})`, { align: "center" });
    doc.moveDown();

    const field = (label: string, value: string) => {
      doc.fontSize(9).font("Helvetica-Bold").text(label + ": ", { continued: true });
      doc.font("Helvetica").text(value);
    };
    field("Number", co.number);
    field("Title", co.title);
    field("Status", co.status.replace(/_/g, " ").toUpperCase());
    if (co.contractValueImpact) field("Contract Value Impact", co.contractValueImpact);
    if (co.scheduleImpactDays) field("Schedule Impact", `${co.scheduleImpactDays} days`);
    if (co.description) { doc.moveDown(0.5); doc.fontSize(9).font("Helvetica-Bold").text("Description:"); doc.font("Helvetica").text(co.description); }

    doc.moveDown(2);
    doc.fontSize(8).font("Helvetica").fillColor("#666").text("Generated by BIMLog by IgniteSmart", { align: "center" });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/change-orders/import",
  authMiddleware,
  requirePermission("admin", "write"),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      let records: any[] = [];
      if (isPdf && pdfBase64) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: `Extract all change order records from this PDF document. Return ONLY a JSON array, no markdown. If none found return []:
[{"number":"CO-001","title":"description","description":"full details","status":"draft/pending_approval/approved/rejected","contractValueImpact":"dollar amount or null","dateIssued":"date or null"}]` }
              ] as any
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          records = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          console.log("[change-order-import] PDF direct extraction:", records.length, "records");
        } catch (e) {
          console.error("[change-order-import] PDF direct extraction failed:", e);
        }
      } else {
      for (const chunk of chunks) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `Extract all change order records from this construction document chunk. Return ONLY a JSON array, no markdown. If none found return []:
[{"number":"CO-001","title":"description","description":"full details","status":"draft/pending_approval/approved/rejected","contractValueImpact":"dollar amount or null","dateIssued":"date or null"}]
Document chunk:
${chunk}`
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          const chunkRecords = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          records = [...records, ...chunkRecords];
        } catch (e) {
          console.error("[change-order-import] chunk extraction failed:", e);
        }
      }
      } // end else (non-PDF)

      const forceImport = req.body?.forceImport === "true";
      if (!forceImport && records.length > 0) {
        const { checkImportIntelligence } = await import("../lib/import-intelligence");
        const intelligence = await checkImportIntelligence(projectId, records, "change_order");
        if (intelligence.warnings.length > 0) {
          res.json({ requiresConfirmation: true, warnings: intelligence.warnings, crossLinks: intelligence.crossLinks, safeCount: intelligence.safeIndices.length, total: records.length });
          return;
        }
      }

      const existingCo = await db.select({ number: changeOrdersTable.number })
        .from(changeOrdersTable).where(eq(changeOrdersTable.projectId, projectId));
      const usedCoNums = new Set(existingCo.map(r => r.number));
      const getDrfCo = (num: string): string => {
        if (!usedCoNums.has(num)) return num;
        let i = 1;
        while (usedCoNums.has(`${num}-DRF-${String(i).padStart(3,"0")}`)) i++;
        return `${num}-DRF-${String(i).padStart(3,"0")}`;
      };
      let imported = 0;
      const renamedCo: { original: string; renamed: string }[] = [];
      for (const r of records) {
        if (!r.title && !r.number) continue;
        const proposed = r.number || `CO-${String(imported + 1).padStart(3, "0")}`;
        const finalNum = getDrfCo(proposed);
        if (finalNum !== proposed) renamedCo.push({ original: proposed, renamed: finalNum });
        usedCoNums.add(finalNum);
        await db.insert(changeOrdersTable).values({
          projectId,
          number: finalNum,
          title: r.title || "Imported Change Order",
          description: r.description || null,
          status: r.status || "draft",
          initiatedById: req.user!.userId,
          contractValueImpact: r.contractValueImpact || null,
        });
        imported++;
      }
      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "", userCompanyName: req.user!.companyName ?? "",
        actionType: "import", entityType: "change_order", entityId: projectId,
        details: `Imported ${imported} change orders from ${req.file.originalname}`,
      });
      res.json({ imported, message: `${imported} change orders imported`, renamed: renamedCo, renameCount: renamedCo.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
