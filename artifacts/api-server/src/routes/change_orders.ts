import { Router } from "express";
import { db } from "@workspace/db";
import {
  changeOrdersTable, changeOrderDocumentsTable, activityLogTable,
  projectsTable, rfisTable, submittalsTable,
  linkedItemsTable, agentInsightsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, isNull, or } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { createNotification } from "./notifications";
import { singleFileUpload } from "../middlewares/multipart";
import {
  addPageNumbers,
  computeContentHash,
  createPdfDocument,
  drawBrandedHeader,
  drawFooter,
  drawTable,
  PALETTE,
  REPORT_THEMES,
  reportFileName,
  type TableColumn,
} from "../lib/pdf-kit";
import { extractFileText } from "../lib/extract-file-text";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";

const router: Router = Router();

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
      .where(and(eq(changeOrdersTable.projectId, projectId), isNull(changeOrdersTable.deletedAt)))
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
    initiated_by_company?: string;
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
      initiatedByCompany: body.initiated_by_company ?? null,
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

// ── GET /projects/:projectId/change-orders/current-view/pdf ───────────────────
router.get("/projects/:projectId/change-orders/current-view/pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const lang = req.query.lang === "es" ? "es" : "en";
  const label = (en: string, es: string) => lang === "es" ? es : en;
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort : "created_desc";
  const boolQuery = (value: unknown, fallback = true): boolean | "invalid" => {
    if (value === undefined) return fallback;
    if (value === "true") return true;
    if (value === "false") return false;
    return "invalid";
  };
  const includeFinancial = boolQuery(req.query.include_financial);
  const includeSchedule = boolQuery(req.query.include_schedule);
  const includeCompany = boolQuery(req.query.include_company);
  const includeDates = boolQuery(req.query.include_dates);
  const allowedStatuses = new Set(["all", "draft", "pending_approval", "approved", "rejected"]);
  const allowedSorts = new Set(["created_desc", "created_asc", "number_asc", "number_desc", "status_asc"]);
  if (!Number.isInteger(projectId) || projectId <= 0) { res.status(400).json({ error: "invalid_project_id" }); return; }
  if (!allowedStatuses.has(status)) { res.status(400).json({ error: "invalid_status" }); return; }
  if (!allowedSorts.has(sort)) { res.status(400).json({ error: "invalid_sort" }); return; }
  if (search.length > 200) { res.status(400).json({ error: "invalid_search" }); return; }
  if ([includeFinancial, includeSchedule, includeCompany, includeDates].includes("invalid")) {
    res.status(400).json({ error: "invalid_include_option" });
    return;
  }
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "project_not_found" }); return; }

    const allRows = await db.select().from(changeOrdersTable)
      .where(and(eq(changeOrdersTable.projectId, projectId), isNull(changeOrdersTable.deletedAt)));
    const statusText = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const filtered = allRows
      .filter(row => status === "all" || row.status === status)
      .filter(row => {
        if (!search) return true;
        const haystack = [
          row.number,
          row.title,
          row.description,
          row.status,
          row.contractValueImpact,
          row.scheduleImpactDays == null ? "" : String(row.scheduleImpactDays),
          row.initiatedByCompany,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => {
        if (sort === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "number_asc") return a.number.localeCompare(b.number);
        if (sort === "number_desc") return b.number.localeCompare(a.number);
        if (sort === "status_asc") return a.status.localeCompare(b.status) || a.number.localeCompare(b.number);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const generatedAt = new Date();
    const reportTitle = label("Change Orders Current View PDF", "PDF de vista actual de Ordenes de Cambio");
    const reportNumber = `CO-CURRENT-${project.code || projectId}-${generatedAt.toISOString().slice(0, 10).replace(/-/g, "")}`;
    const sortLabel = sort === "created_desc" ? label("Newest first", "Mas recientes")
      : sort === "created_asc" ? label("Oldest first", "Mas antiguos")
      : sort === "number_asc" ? label("Number A-Z", "Numero A-Z")
      : sort === "number_desc" ? label("Number Z-A", "Numero Z-A")
      : label("Status", "Estado");
    const visibleColumns = [
      includeFinancial ? label("Financial", "Financiero") : "",
      includeSchedule ? label("Schedule", "Cronograma") : "",
      includeCompany ? label("Company", "Empresa") : "",
      includeDates ? label("Dates", "Fechas") : "",
    ].filter(Boolean).join(", ") || label("Standard", "Estandar");
    const filterSummary = [
      `${label("Status", "Estado")}: ${status === "all" ? label("All", "Todos") : statusText(status)}`,
      `${label("Search", "Busqueda")}: ${search || label("None", "Ninguna")}`,
      `${label("Sort", "Orden")}: ${sortLabel}`,
      `${label("Rows", "Filas")}: ${filtered.length}/${allRows.length}`,
      `${label("Columns", "Columnas")}: ${visibleColumns}`,
      `${label("Generated by", "Generado por")}: ${req.user!.fullName || "-"}`,
    ];
    const contentHash = computeContentHash({
      projectId,
      reportNumber,
      generatedAt: generatedAt.toISOString(),
      filters: { status, search, sort, includeFinancial, includeSchedule, includeCompany, includeDates },
      rows: filtered.map(row => ({
        id: row.id,
        number: row.number,
        title: row.title,
        description: row.description,
        status: row.status,
        initiatedByCompany: row.initiatedByCompany,
        contractValueImpact: row.contractValueImpact,
        scheduleImpactDays: row.scheduleImpactDays,
        createdAt: row.createdAt,
        approvedAt: row.approvedAt,
        updatedAt: row.updatedAt,
      })),
    });

    const doc = createPdfDocument({ size: "LETTER", layout: "landscape", margin: 40, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(reportTitle)}"`);
    doc.pipe(res);
    const theme = REPORT_THEMES.changeOrder.log;
    const drawHeader = () => {
      const y = drawBrandedHeader(doc, {
        margin: 40,
        companyName: req.user!.companyName || "BIMLog",
        title: reportTitle,
        subtitle: label("Current visible Change Orders register", "Registro visible de Ordenes de Cambio"),
        projectName: project.name,
        projectCode: project.code || undefined,
        reportNumber,
        reportDate: generatedAt,
        theme,
      });
      doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED)
        .text(filterSummary.join(" | "), 40, y, { width: 712, lineBreak: false, ellipsis: true });
      return y + 18;
    };
    let y = drawHeader();
    const cardWidth = 132;
    const cards: Array<[string, string]> = [
      [label("Visible", "Visible"), String(filtered.length)],
      [label("Draft", "Borrador"), String(filtered.filter(row => row.status === "draft").length)],
      [label("Pending", "Pendiente"), String(filtered.filter(row => row.status === "pending_approval").length)],
      [label("Approved", "Aprobado"), String(filtered.filter(row => row.status === "approved").length)],
      [label("Rejected", "Rechazado"), String(filtered.filter(row => row.status === "rejected").length)],
    ];
    cards.forEach(([name, value], index) => {
      const x = 40 + index * (cardWidth + 8);
      doc.rect(x, y, cardWidth, 42).stroke(PALETTE.LINE);
      doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor(PALETTE.MUTED).text(name.toUpperCase(), x + 7, y + 8, { width: cardWidth - 14, lineBreak: false });
      doc.fontSize(15).font(PALETTE.FONT_BOLD).fillColor(PALETTE.TEXT).text(value, x + 7, y + 22, { width: cardWidth - 14, lineBreak: false });
    });
    y += 58;

    const fmtDate = (value: Date | string | null | undefined) => {
      if (!value) return "-";
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-US");
    };
    const nextAction = (row: typeof changeOrdersTable.$inferSelect) => {
      if (row.status === "draft") return label("Submit for approval", "Enviar para aprobacion");
      if (row.status === "pending_approval") return label("Approve or reject", "Aprobar o rechazar");
      if (row.status === "approved") return label("Track execution", "Dar seguimiento");
      if (row.status === "rejected") return label("Revise scope or close", "Revisar alcance o cerrar");
      return label("Review", "Revisar");
    };
    const columns: TableColumn[] = [
      { label: label("CO #", "OC #"), width: 64, bold: true, format: row => row.number },
      { label: label("Title / Scope", "Titulo / Alcance"), width: 130, wrap: true, format: row => row.title || "-" },
      { label: label("Status", "Estado"), width: 58, format: row => statusText(row.status) },
      ...(includeCompany ? [{ label: label("Company", "Empresa"), width: 72, format: (row: typeof changeOrdersTable.$inferSelect) => row.initiatedByCompany || "-" }] : []),
      ...(includeFinancial ? [{ label: label("Value Impact", "Impacto Valor"), width: 68, format: (row: typeof changeOrdersTable.$inferSelect) => row.contractValueImpact || "-" }] : []),
      ...(includeSchedule ? [{ label: label("Sched. Days", "Dias Cron."), width: 45, align: "right" as const, format: (row: typeof changeOrdersTable.$inferSelect) => row.scheduleImpactDays == null ? "-" : String(row.scheduleImpactDays) }] : []),
      ...(includeDates ? [
        { label: label("Created", "Creada"), width: 50, format: (row: typeof changeOrdersTable.$inferSelect) => fmtDate(row.createdAt) },
        { label: label("Approved", "Aprobada"), width: 50, format: (row: typeof changeOrdersTable.$inferSelect) => fmtDate(row.approvedAt) },
      ] : []),
      { label: label("Next Action", "Proxima accion"), width: 70, wrap: true, format: row => nextAction(row) },
      { label: label("Description", "Descripcion"), width: 75, wrap: true, format: row => row.description || "-" },
    ];
    if (filtered.length > 0) {
      drawTable(doc, {
        x: 40,
        startY: y,
        columns,
        rows: filtered,
        fontSize: 6.8,
        headerFontSize: 6.5,
        rowMinHeight: 26,
        pageBottom: 540,
        headerFill: theme.primary,
        onPageBreak: () => {
          doc.addPage();
          return drawHeader();
        },
      });
    } else {
      doc.fontSize(11).font(PALETTE.FONT).fillColor(PALETTE.MUTED)
        .text(allRows.length === 0
          ? label("No change orders exist for this project.", "No existen ordenes de cambio para este proyecto.")
          : label("No change orders match the current filters.", "Ninguna orden de cambio coincide con los filtros actuales."),
        40, y, { width: 712 });
    }
    addPageNumbers(doc, {
      margin: 40,
      footerY: 558,
      fingerprintY: 544,
      contentHash,
      companyName: req.user!.companyName || "BIMLog",
      projectName: project.name,
      reportNumber,
      timestamp: generatedAt.toLocaleString("en-US"),
    });
    doc.end();
  } catch (err) {
    console.error("[change_orders.current_view_pdf_failed]", { name: err instanceof Error ? err.name : "UnknownError" });
    if (!res.headersSent) res.status(500).json({ error: "Change Orders current-view PDF export failed." });
  }
});

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
      const [updatedCo] = await db.update(changeOrdersTable).set(updates as any)
        .where(and(eq(changeOrdersTable.id, coId), eq(changeOrdersTable.projectId, projectId)))
        .returning();
      if (!updatedCo) { res.status(404).json({ error: "Not found" }); return; }
      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
        actionType: action, entityType: "change_order", entityId: coId,
        fileNameBefore: null, fileNameAfter: null,
        details: `Change order ${action}ed`,
      });
      // Notify the change order's initiator of the status change (the import was
      // previously dead — no CO event ever produced a notification). Skip when the
      // actor is the initiator, since self-notifications are noise.
      if (updatedCo.initiatedById && updatedCo.initiatedById !== req.user!.userId) {
        const verb = action === "submit" ? "submitted for approval" : action === "approve" ? "approved" : "rejected";
        await createNotification(
          updatedCo.initiatedById,
          projectId,
          "change_order_status",
          `Change order ${updatedCo.number} ${verb}`,
          `${req.user!.fullName} ${verb} change order ${updatedCo.number}.`,
          null,
        );
      }
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

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      projectId,
      feature: "change_order_ai_draft",
    });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5", max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
    await db.update(changeOrdersTable).set({ aiDraftUsed: true, updatedAt: new Date() }).where(eq(changeOrdersTable.id, coId));
    res.json(parsed);
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
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

    const doc = createPdfDocument({ size: "LETTER", margin: 50 });
    const title = `${co.number} - Change Order Report`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(title)}"`);
    doc.pipe(res);

    doc.y = drawBrandedHeader(doc, { margin: 50, companyName: "BIMLog", title, projectName: project[0]?.name ?? "Project", projectCode: project[0]?.code, theme: REPORT_THEMES.changeOrder.detail }) + 12;

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

    drawFooter(doc, { margin: 50, y: doc.page.height - 30, projectName: project[0]?.name, timestamp: new Date().toLocaleDateString("en-US") });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/change-orders/import",
  authMiddleware,
  requirePermission("admin", "write"),
  singleFileUpload({ fileSize: 50 * 1024 * 1024 }),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "change_order_import",
      });
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
        const intelligence = await checkImportIntelligence(req.user!.userId, projectId, records, "change_order");
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
      if (sendAiUsageError(res, err)) return;
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── DELETE change order (soft delete) ─────────────────────────────────────────
router.delete("/projects/:projectId/change-orders/:changeOrderId",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const changeOrderId = Number(req.params.changeOrderId);
    const reason = (req.body?.reason as string | undefined) ?? null;
    try {
      const [existing] = await db.select().from(changeOrdersTable)
        .where(and(eq(changeOrdersTable.id, changeOrderId), eq(changeOrdersTable.projectId, projectId)));
      if (!existing) { res.status(404).json({ error: "not_found" }); return; }

      await db.update(changeOrdersTable)
        .set({ deletedAt: new Date(), deleteReason: reason })
        .where(and(eq(changeOrdersTable.id, changeOrderId), eq(changeOrdersTable.projectId, projectId)));

      await db.delete(changeOrderDocumentsTable).where(eq(changeOrderDocumentsTable.changeOrderId, changeOrderId));

      await db.delete(linkedItemsTable).where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, "change_order"), eq(linkedItemsTable.fromId, changeOrderId)),
          and(eq(linkedItemsTable.toType, "change_order"), eq(linkedItemsTable.toId, changeOrderId)),
        ),
      ));

      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "delete", entityType: "change_order", entityId: changeOrderId,
        details: JSON.stringify({ reason, number: existing.number, title: existing.title }),
      });

      await db.insert(agentInsightsTable).values({
        projectId, agentType: "change_order", entityType: "change_order", entityId: changeOrderId,
        insightType: "delete_pattern",
        message: `Change order ${existing.number} deleted: ${reason ?? "no reason"}`,
        recommendation: "Track change-order deletes to detect scope-creep churn.",
        severity: "info",
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;


