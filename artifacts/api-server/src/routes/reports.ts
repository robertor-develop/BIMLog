import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  rfisTable,
  submittalsTable,
  filesTable,
  activityLogTable,
  transmittalsTable,
  changeOrdersTable,
  meetingMinutesTable,
  meetingSubmittalLinksTable,
  meetingLensViewpointLinksTable,
  meetingClashLinksTable,
  meetingScheduleBucketLinksTable,
  meetingScheduleTaskLinksTable,
  actionItemsTable,
  projectMembersTable,
  usersTable,
  companiesTable,
  namingConventionsTable,
  namingFieldsTable,
  namingConventionVersionsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc, ne } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import {
  createPdfDocument,
  addPageNumbers,
  computeContentHash,
  drawBrandedHeader,
  drawFooter,
  drawTable,
  REPORT_THEMES,
  reportFileName,
  sectionBar,
  type ReportTheme,
} from "../lib/pdf-kit";
import jwt from "jsonwebtoken";

async function verifyReportToken(req: any, res: any): Promise<number | null> {
  const token =
    req.headers.authorization?.split(" ")[1] || (req.query.token as string);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return decoded.userId || decoded.id;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
}

const router: Router = Router();

const currentViewTitles = {
  "reports-hub": { en: "Reports Hub — Current View", es: "Centro de reportes — Vista actual" },
  integrations: { en: "Integrations — Current View", es: "Integraciones — Vista actual" },
  "clash-reports": { en: "Clash Reports — Current View", es: "Reportes de choques — Vista actual" },
  "submittal-register": { en: "Required Submittal Register — Current View", es: "Registro de entregables requeridos — Vista actual" },
  "naming-convention": { en: "Naming Convention — Current View", es: "Convención de nombres — Vista actual" },
  "job-intake": { en: "Job Intake - Current View", es: "Ingreso del trabajo - Vista actual" },
  "job-operations": { en: "Job Operations - Current View", es: "Operaciones del trabajo - Vista actual" },
  "cost-value-planner": { en: "Cost & Value Planner - Current View", es: "Planificador de Costos y Valor - Vista actual" },
  "team-performance": { en: "Team Performance & Skills - Current View", es: "Rendimiento y Habilidades del Equipo - Vista actual" },
} as const;

function pdfHeader(
  doc: PDFKit.PDFDocument,
  project: { name: string; code: string; companyName?: string },
  title: string,
  theme: ReportTheme,
) {
  doc.y =
    drawBrandedHeader(doc, {
      margin: 50,
      companyName: project.companyName || "Company",
      title,
      subtitle: "Reports & PDFs",
      projectName: project.name,
      projectCode: project.code,
      reportDate: new Date(),
      theme,
    }) + 12;
}

function row(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  labelWidth = 160,
) {
  const y = doc.y;
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor("#374151")
    .text(label, 50, y, { width: labelWidth });
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#111")
    .text(value, 50 + labelWidth, y, {
      width: doc.page.width - 50 - labelWidth - 50,
    });
  doc.moveDown(0.3);
}

function pdfFooter(doc: PDFKit.PDFDocument, project: { name: string; companyName?: string }) {
  drawFooter(doc, {
    margin: 50,
    y: doc.page.height - 30,
    companyName: project.companyName,
    projectName: project.name,
    timestamp: new Date().toLocaleDateString("en-US"),
  });
}

function reportRequestOptions(req: any) {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  const includeDetails = req.query.include_details !== "false";
  return { from, to, status, includeDetails };
}

function inSelectedDateRange(value: unknown, from: string, to: string) {
  const date = value ? new Date(value as any) : null;
  if (!date || Number.isNaN(date.getTime())) return !from && !to;
  const day = date.toISOString().slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function drawReportContext(doc: PDFKit.PDFDocument, options: ReturnType<typeof reportRequestOptions>, visible: number, total: number, theme: ReportTheme) {
  let y = sectionBar(doc, "Report Context & Selected Filters", doc.y, { margin: 50, theme });
  doc.fontSize(8).font("Helvetica").fillColor("#334155")
    .text(`Generated: ${new Date().toLocaleString("en-US")}  |  Date range: ${options.from || "Any"} to ${options.to || "Any"}  |  Status: ${options.status}  |  Visible records: ${visible}/${total}`, 50, y, { width: doc.page.width - 100 });
  doc.y += 24;
}

function drawKpis(doc: PDFKit.PDFDocument, values: Array<[string, string]>, theme: ReportTheme) {
  const width = (doc.page.width - 100 - (values.length - 1) * 8) / values.length;
  const y = doc.y;
  values.forEach(([label, value], index) => {
    const x = 50 + index * (width + 8);
    doc.roundedRect(x, y, width, 48, 4).fill(theme.light);
    doc.fontSize(16).font("Helvetica-Bold").fillColor(theme.dark).text(value, x + 8, y + 8, { width: width - 16, align: "center" });
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#475569").text(label.toUpperCase(), x + 5, y + 30, { width: width - 10, align: "center", lineBreak: false });
  });
  doc.y = y + 60;
}

function finishProfessionalReport(doc: PDFKit.PDFDocument, project: { name: string; companyName?: string }, reportNumber: string, snapshot: unknown) {
  addPageNumbers(doc, {
    margin: 50,
    footerY: doc.page.height - 24,
    fingerprintY: doc.page.height - 36,
    companyName: project.companyName || "Company",
    projectName: project.name,
    reportNumber,
    timestamp: new Date().toLocaleString("en-US"),
    contentHash: computeContentHash(snapshot),
  });
  doc.end();
}

async function getProject(projectId: number, userId: number) {
  const [p] = await db
    .select({ project: projectsTable, companyName: companiesTable.name })
    .from(projectsTable)
    .innerJoin(projectMembersTable, and(eq(projectMembersTable.projectId, projectsTable.id), eq(projectMembersTable.userId, userId)))
    .innerJoin(usersTable, eq(usersTable.id, projectMembersTable.userId))
    .innerJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
    .where(eq(projectsTable.id, projectId));
  return p ? { ...p.project, companyName: p.companyName } : undefined;
}

router.post(
  "/projects/:projectId/reports/current-view/pdf",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const surface = String(req.body?.surface || "") as keyof typeof currentViewTitles;
    const definition = currentViewTitles[surface];
    if (!definition) {
      res.status(400).json({ error: "Unsupported current-view surface" });
      return;
    }
    const project = await getProject(projectId, req.user!.userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const lang = req.body?.lang === "es" ? "es" : "en";
    const clean = (value: unknown, limit = 180) =>
      String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, limit);
    const context = Array.isArray(req.body?.context)
      ? req.body.context.slice(0, 12).map((value: unknown) => clean(value))
      : [];
    const columns: string[] = Array.isArray(req.body?.columns)
      ? req.body.columns.slice(0, 6).map((value: unknown) => clean(value, 60))
      : [];
    const rows: string[][] = Array.isArray(req.body?.rows)
      ? req.body.rows.slice(0, 250).map((record: unknown) =>
          Array.isArray(record)
            ? record.slice(0, columns.length).map((value: unknown) => clean(value))
            : [],
        )
      : [];
    if (!columns.length || rows.some((record: string[]) => record.length !== columns.length)) {
      res.status(400).json({ error: "Invalid current-view table" });
      return;
    }
    const title = definition[lang];
    const doc = createPdfDocument({ size: "LETTER", layout: columns.length > 4 ? "landscape" : "portrait", margin: 50, bufferPages: true });
    res.type("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(title)}"`);
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.platform.standard);
    doc.y = sectionBar(doc, lang === "es" ? "Contexto de la vista" : "Current View Context", doc.y, {
      margin: 50,
      theme: REPORT_THEMES.platform.standard,
    });
    doc.fontSize(8).font("Helvetica").fillColor("#334155")
      .text(context.length ? context.join("  |  ") : (lang === "es" ? "Sin filtros activos." : "No active filters."), 50, doc.y, { width: doc.page.width - 100 });
    doc.y += 28;
    if (rows.length) {
      const availableWidth = doc.page.width - 100;
      const width = availableWidth / columns.length;
      drawTable(doc, {
        x: 50,
        startY: doc.y,
        pageBottom: doc.page.height - 54,
        columns: columns.map((label, index) => ({
          label,
          key: `c${index}`,
          width,
          wrap: index === 1,
        })),
        rows: rows.map((record) => Object.fromEntries(record.map((value, index) => [`c${index}`, value]))),
        onPageBreak: () => {
          doc.addPage();
          pdfHeader(doc, project, title, REPORT_THEMES.platform.standard);
          return doc.y;
        },
      });
    } else {
      doc.roundedRect(50, doc.y, doc.page.width - 100, 58, 5).fill("#F8FAFC");
      doc.fontSize(10).font("Helvetica").fillColor("#64748B")
        .text(clean(req.body?.emptyMessage) || (lang === "es" ? "No hay resultados en la vista actual." : "No results in the current view."), 66, doc.y + 20, {
          width: doc.page.width - 132,
          align: "center",
        });
    }
    const reportNumber = `VIEW-${computeContentHash({ projectId, surface, context, columns, rows }).slice(0, 10).toUpperCase()}`;
    finishProfessionalReport(doc, project, reportNumber, { projectId, surface, context, columns, rows });
  },
);

// ── PROJECT HEALTH ─────────────────────────────────────────────────────────────
router.post("/help/manual/pdf", authMiddleware, async (req, res) => {
  const lang = req.body?.lang === "es" ? "es" : "en";
  const clean = (value: unknown, limit = 4000) => String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, limit);
  const sections = Array.isArray(req.body?.sections) ? req.body.sections.slice(0, 120).map((entry: unknown) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { title: clean(item.title, 180), body: clean(item.body) };
  }).filter((entry: { title: string; body: string }) => entry.title || entry.body) : [];
  if (!sections.length) { res.status(400).json({ error: "At least one bounded manual section is required" }); return; }
  const title = clean(req.body?.title, 180) || (lang === "es" ? "Manual de usuario de BIMLog" : "BIMLog User Manual");
  const doc = createPdfDocument({ size: "LETTER", layout: "portrait", margin: 50, bufferPages: true });
  res.type("application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(title)}"`); doc.pipe(res);
  const project = { name: "BIMLog", code: "HELP", companyName: "IgniteSmart" };
  pdfHeader(doc, project, title, REPORT_THEMES.platform.standard);
  for (const section of sections) {
    if (doc.y > doc.page.height - 120) { doc.addPage(); pdfHeader(doc, project, title, REPORT_THEMES.platform.standard); }
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#17365D").text(section.title || (lang === "es" ? "Seccion" : "Section"), 50, doc.y, { width: doc.page.width - 100 });
    doc.moveDown(0.35).font("Helvetica").fontSize(9).fillColor("#334155").text(section.body, 50, doc.y, { width: doc.page.width - 100, lineGap: 2 }).moveDown(0.8);
  }
  const snapshot = { surface: "help-center", lang, title, sections };
  finishProfessionalReport(doc, project, `HELP-${computeContentHash(snapshot).slice(0, 10).toUpperCase()}`, snapshot);
});

router.get(
  "/projects/:projectId/reports/project-health/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const [rfis, subs, files] = await Promise.all([
        db.select().from(rfisTable).where(eq(rfisTable.projectId, projectId)),
        db
          .select()
          .from(submittalsTable)
          .where(eq(submittalsTable.projectId, projectId)),
        db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      ]);
      const options = reportRequestOptions(req);
      const visibleRfis = rfis.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
      const visibleSubs = subs.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
      const visibleFiles = files.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
      const now = Date.now();
      const openRfis = visibleRfis.filter((r) => r.status !== "closed");
      const overdueRfis = openRfis.filter(
        (r) => r.dueDate && new Date(r.dueDate).getTime() < now,
      );
      const pendingSubs = visibleSubs.filter((s) =>
        ["pending", "under_review"].includes(s.status),
      );
      const validFiles = visibleFiles.filter((f) => f.status === "valid");
      const compRate = visibleFiles.length
        ? Math.round((validFiles.length / visibleFiles.length) * 100)
        : 0;

      const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Project Health Report";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.platform.health);
      drawReportContext(doc, options, visibleRfis.length + visibleSubs.length + visibleFiles.length, rfis.length + subs.length + files.length, REPORT_THEMES.platform.health);
      drawKpis(doc, [["OPEN RFIS", String(openRfis.length)], ["OVERDUE RFIS", String(overdueRfis.length)], ["PENDING SUBMITTALS", String(pendingSubs.length)], ["FILE COMPLIANCE", `${compRate}%`]], REPORT_THEMES.platform.health);
      doc.y = sectionBar(doc, "Executive Summary", doc.y, { margin: 50, theme: REPORT_THEMES.platform.health });
      doc.fontSize(9).font("Helvetica").fillColor("#111827").text(
        visibleRfis.length + visibleSubs.length + visibleFiles.length
          ? `This current snapshot contains ${visibleRfis.length} RFIs, ${visibleSubs.length} submittals, and ${visibleFiles.length} files. ${overdueRfis.length} open RFI(s) are overdue and ${pendingSubs.length} submittal(s) remain pending review.`
          : "No project records match the selected filters. KPI values remain zero and no analytics are fabricated.",
        50, doc.y, { width: doc.page.width - 100 },
      );
      doc.y += 34;
      if (options.includeDetails) {
        drawTable(doc, {
          x: 50, startY: doc.y, pageBottom: doc.page.height - 52,
          columns: [{ label: "Domain", width: 120, key: "domain" }, { label: "Visible", width: 90, key: "visible", align: "right" }, { label: "Attention", width: 100, key: "attention", align: "right" }, { label: "Context", width: 202, key: "context", wrap: true }],
          rows: [
            { domain: "RFIs", visible: visibleRfis.length, attention: overdueRfis.length, context: "Attention = open records past due." },
            { domain: "Submittals", visible: visibleSubs.length, attention: pendingSubs.length, context: "Attention = pending or under review." },
            { domain: "Files", visible: visibleFiles.length, attention: visibleFiles.length - validFiles.length, context: "Attention = records not marked valid." },
          ],
          onPageBreak: () => { doc.addPage(); pdfHeader(doc, project, title, REPORT_THEMES.platform.health); return doc.y; },
        });
      }
      const reportNumber = `HEALTH-${computeContentHash({ projectId, options, visibleRfis, visibleSubs, visibleFiles }).slice(0, 10).toUpperCase()}`;
      finishProfessionalReport(doc, project, reportNumber, { projectId, options, visibleRfis, visibleSubs, visibleFiles });
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── COMPLIANCE ─────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/compliance/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const files = await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.projectId, projectId))
      .orderBy(desc(filesTable.createdAt));
    const options = reportRequestOptions(req);
    const visibleFiles = files.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
    const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    const title = "Naming Compliance Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.files.compliance);

    const valid = visibleFiles.filter((f) => f.status === "valid");
    const rejected = visibleFiles.filter((f) => f.status === "rejected");
    drawReportContext(doc, options, visibleFiles.length, files.length, REPORT_THEMES.files.compliance);
    drawKpis(doc, [["FILES", String(visibleFiles.length)], ["COMPLIANT", String(valid.length)], ["NON-COMPLIANT", String(rejected.length)], ["COMPLIANCE", visibleFiles.length ? `${Math.round((valid.length / visibleFiles.length) * 100)}%` : "0%"]], REPORT_THEMES.files.compliance);
    row(
      doc,
      "Compliance Rate",
      files.length
        ? `${Math.round((valid.length / files.length) * 100)}%`
        : "—",
    );
    doc.moveDown();
    if (!visibleFiles.length) {
      doc.fontSize(9).fillColor("#64748B").text("No accessible files match the selected filters. No compliance result is inferred.", { align: "center" });
    } else if (options.includeDetails) {
      drawTable(doc, {
        x: 50, startY: sectionBar(doc, "File Compliance Detail", doc.y, { margin: 50, theme: REPORT_THEMES.files.compliance }), pageBottom: doc.page.height - 52,
        columns: [{ label: "File", width: 300, key: "fileName", wrap: true }, { label: "Status", width: 100, format: (item) => String(item.status || "unclassified").replace(/_/g, " ") }, { label: "Uploaded", width: 112, format: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US") : "—" }],
        rows: visibleFiles,
        onPageBreak: () => { doc.addPage(); pdfHeader(doc, project, title, REPORT_THEMES.files.compliance); return doc.y; },
      });
    }
    const reportNumber = `COMP-${computeContentHash({ projectId, options, visibleFiles }).slice(0, 10).toUpperCase()}`;
    finishProfessionalReport(doc, project, reportNumber, { projectId, options, visibleFiles });
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

// ── RFI AGING ──────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/rfi-aging/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const rfis = await db
      .select()
      .from(rfisTable)
      .where(
        and(eq(rfisTable.projectId, projectId), ne(rfisTable.status, "closed")),
      )
      .orderBy(rfisTable.createdAt);
    const options = reportRequestOptions(req);
    const now = Date.now();
    const dateFilteredRfis = rfis.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
    const visibleRfis = options.status === "overdue"
      ? dateFilteredRfis.filter((record) => record.dueDate && new Date(record.dueDate).getTime() < now)
      : dateFilteredRfis;
    const doc = createPdfDocument({
      size: "LETTER",
      margin: 50,
      layout: "landscape",
      bufferPages: true,
    });
    res.setHeader("Content-Type", "application/pdf");
    const title = "RFI Aging Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.rfi.log);

    const rows = visibleRfis.map((rfi) => {
      const ageDays = Math.max(0, Math.floor((now - new Date(rfi.createdAt).getTime()) / 86400000));
      const overdue = Boolean(rfi.dueDate && new Date(rfi.dueDate).getTime() < now);
      return { ...rfi, ageDays, overdue: overdue ? "Yes" : "No" };
    });
    drawReportContext(doc, options, rows.length, rfis.length, REPORT_THEMES.rfi.log);
    drawKpis(doc, [["OPEN RFIS", String(rows.length)], ["OVERDUE", String(rows.filter((item) => item.overdue === "Yes").length)], ["0-7 DAYS", String(rows.filter((item) => item.ageDays <= 7).length)], ["30+ DAYS", String(rows.filter((item) => item.ageDays >= 30).length)]], REPORT_THEMES.rfi.log);
    if (!rows.length) {
      doc.fontSize(9).fillColor("#64748B").text("No open RFIs match the selected filters.", { align: "center" });
    } else if (options.includeDetails) {
      drawTable(doc, {
        x: 50, startY: sectionBar(doc, "Open RFI Aging Detail", doc.y, { margin: 50, theme: REPORT_THEMES.rfi.log }), pageBottom: doc.page.height - 52,
        columns: [{ label: "RFI", width: 70, key: "number", bold: true }, { label: "Subject", width: 270, key: "subject", wrap: true }, { label: "Status", width: 95, format: (item) => String(item.status).replace(/_/g, " ") }, { label: "Age", width: 60, format: (item) => `${item.ageDays}d`, align: "right" }, { label: "Due", width: 90, format: (item) => item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-US") : "—" }, { label: "Overdue", width: 70, key: "overdue" }],
        rows,
        onPageBreak: () => { doc.addPage(); pdfHeader(doc, project, title, REPORT_THEMES.rfi.log); return doc.y; },
      });
    }
    const reportNumber = `RFI-AGING-${computeContentHash({ projectId, options, rows }).slice(0, 10).toUpperCase()}`;
    finishProfessionalReport(doc, project, reportNumber, { projectId, options, rows });
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

// ── SUBMITTAL STATUS ───────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/submittal-status/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const subs = await db
        .select()
        .from(submittalsTable)
        .where(eq(submittalsTable.projectId, projectId))
        .orderBy(submittalsTable.number);
      const options = reportRequestOptions(req);
      const dateFilteredSubs = subs.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
      const visibleSubs = options.status === "all"
        ? dateFilteredSubs
        : dateFilteredSubs.filter((record) => options.status === "closed" ? ["approved", "closed"].includes(record.status) : record.status === options.status);
      const doc = createPdfDocument({
        size: "LETTER",
        margin: 50,
        layout: "landscape",
        bufferPages: true,
      });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Submittal Status Report";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.submittal.log);

      drawReportContext(doc, options, visibleSubs.length, subs.length, REPORT_THEMES.submittal.log);
      drawKpis(doc, [
        ["SUBMITTALS", String(visibleSubs.length)],
        ["PENDING", String(visibleSubs.filter((item) => item.status === "pending").length)],
        ["UNDER REVIEW", String(visibleSubs.filter((item) => item.status === "under_review").length)],
        ["APPROVED", String(visibleSubs.filter((item) => item.status === "approved").length)],
      ], REPORT_THEMES.submittal.log);
      if (!visibleSubs.length) {
        doc.fontSize(9).fillColor("#64748B").text("No submittals match the selected filters.", { align: "center" });
      } else if (options.includeDetails) {
        drawTable(doc, {
          x: 50, startY: sectionBar(doc, "Submittal Status Detail", doc.y, { margin: 50, theme: REPORT_THEMES.submittal.log }), pageBottom: doc.page.height - 52,
          columns: [{ label: "No.", width: 80, key: "number", bold: true }, { label: "Title", width: 300, key: "title", wrap: true }, { label: "Status", width: 110, format: (item) => String(item.status).replace(/_/g, " ") }, { label: "Ball in Court", width: 170, format: (item) => item.ballInCourt || "—", wrap: true }],
          rows: visibleSubs,
          onPageBreak: () => { doc.addPage(); pdfHeader(doc, project, title, REPORT_THEMES.submittal.log); return doc.y; },
        });
      }
      const reportNumber = `SUBMITTAL-${computeContentHash({ projectId, options, visibleSubs }).slice(0, 10).toUpperCase()}`;
      finishProfessionalReport(doc, project, reportNumber, { projectId, options, visibleSubs });
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── PERFORMANCE ────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/performance/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const [rfis, subs, files, members] = await Promise.all([
      db.select().from(rfisTable).where(eq(rfisTable.projectId, projectId)),
      db
        .select()
        .from(submittalsTable)
        .where(eq(submittalsTable.projectId, projectId)),
      db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      db
        .select({ userId: projectMembersTable.userId })
        .from(projectMembersTable)
        .where(eq(projectMembersTable.projectId, projectId)),
    ]);
    const options = reportRequestOptions(req);
    const visibleRfis = rfis.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
    const visibleSubs = subs.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
    const visibleFiles = files.filter((record) => inSelectedDateRange(record.createdAt, options.from, options.to));
    const closedRfis = visibleRfis.filter((record) => record.status === "closed").length;
    const approvedSubs = visibleSubs.filter((record) => record.status === "approved").length;
    const validFiles = visibleFiles.filter((record) => record.status === "valid").length;
    const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    const title = "Project Performance Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.platform.performance);

    drawReportContext(doc, options, visibleRfis.length + visibleSubs.length + visibleFiles.length, rfis.length + subs.length + files.length, REPORT_THEMES.platform.performance);
    drawKpis(doc, [
      ["TEAM MEMBERS", String(members.length)],
      ["CLOSED RFIS", `${closedRfis}/${visibleRfis.length}`],
      ["APPROVED SUBMITTALS", `${approvedSubs}/${visibleSubs.length}`],
      ["VALID FILES", `${validFiles}/${visibleFiles.length}`],
    ], REPORT_THEMES.platform.performance);
    doc.y = sectionBar(doc, "Authoritative Project Snapshot", doc.y, { margin: 50, theme: REPORT_THEMES.platform.performance });
    drawTable(doc, {
      x: 50,
      startY: doc.y,
      pageBottom: doc.page.height - 54,
      columns: [
        { label: "Domain", key: "domain", width: 150 },
        { label: "Visible", key: "visible", width: 90, align: "right" },
        { label: "Completed / Valid", key: "complete", width: 120, align: "right" },
        { label: "Rate", key: "rate", width: 152, align: "right" },
      ],
      rows: [
        { domain: "RFIs", visible: visibleRfis.length, complete: closedRfis, rate: visibleRfis.length ? `${Math.round(closedRfis / visibleRfis.length * 100)}%` : "Not applicable" },
        { domain: "Submittals", visible: visibleSubs.length, complete: approvedSubs, rate: visibleSubs.length ? `${Math.round(approvedSubs / visibleSubs.length * 100)}%` : "Not applicable" },
        { domain: "Files", visible: visibleFiles.length, complete: validFiles, rate: visibleFiles.length ? `${Math.round(validFiles / visibleFiles.length * 100)}%` : "Not applicable" },
      ],
    });
    doc.y += 16;
    doc.fontSize(8).font("Helvetica").fillColor("#64748B").text(
      "This report presents recorded project counts only. It does not infer productivity, responsibility, causation, or performance beyond the displayed source states.",
      50,
      doc.y,
      { width: doc.page.width - 100 },
    );
    const reportNumber = `PERFORMANCE-${computeContentHash({ projectId, options, visibleRfis, visibleSubs, visibleFiles, members }).slice(0, 10).toUpperCase()}`;
    finishProfessionalReport(doc, project, reportNumber, { projectId, options, visibleRfis, visibleSubs, visibleFiles, members });
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

// ── DISPUTE REPORT ─────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/dispute/:module/:itemId/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    const module = req.params.module;
    const itemId = Number(req.params.itemId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const activity = await db
        .select()
        .from(activityLogTable)
        .where(
          and(
            eq(activityLogTable.projectId, projectId),
            eq(activityLogTable.entityId, itemId),
          ),
        )
        .orderBy(activityLogTable.createdAt);

      const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      const title = `Dispute Report - ${module.toUpperCase()} ${itemId}`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.platform.dispute);

      doc.fontSize(10).font("Helvetica-Bold").text("Full Audit Trail:");
      doc.moveDown(0.3);
      activity.forEach((a) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#111")
          .text(
            `${new Date(a.createdAt).toLocaleString()} | ${a.userFullName} | ${a.actionType} | ${a.details ?? ""}`,
            { indent: 5 },
          );
      });
      if (!activity.length)
        doc
          .fontSize(9)
          .fillColor("#666")
          .text("No activity recorded for this item.", { indent: 5 });
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── AUDIT CERTIFICATE ──────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/audit-certificate/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const files = await db
        .select()
        .from(filesTable)
        .where(eq(filesTable.projectId, projectId));
      const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Document Audit Certificate";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.files.audit);

      const hashedFiles = files.filter((file) => file.fileHash);
      const validFiles = files.filter((file) => file.status === "valid");
      drawKpis(doc, [
        ["DOCUMENTS", String(files.length)],
        ["HASH RECORDED", String(hashedFiles.length)],
        ["MARKED VALID", String(validFiles.length)],
      ], REPORT_THEMES.files.audit);
      doc.y = sectionBar(doc, "Certificate Scope", doc.y, { margin: 50, theme: REPORT_THEMES.files.audit });
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#374151")
        .text(
          "This certificate summarizes the document records visible in BIMLog at generation time. A hash-recorded count confirms only that a stored hash is present; it does not make a legal, compliance, authorship, or completeness determination.",
          50,
          doc.y,
          { width: doc.page.width - 100 },
        );
      doc.y += 38;
      doc.y = sectionBar(doc, "Document Evidence Register", doc.y, { margin: 50, theme: REPORT_THEMES.files.audit });
      if (files.length) {
        drawTable(doc, {
          x: 50,
          startY: doc.y,
          pageBottom: doc.page.height - 54,
          columns: [
            { label: "Document", key: "name", width: 246, wrap: true },
            { label: "Status", key: "status", width: 96 },
            { label: "Hash", key: "hash", width: 170 },
          ],
          rows: files.map((file) => ({
            name: file.fileName,
            status: file.status || "Not recorded",
            hash: file.fileHash ? `${file.fileHash.slice(0, 16)}...` : "Not recorded",
          })),
          onPageBreak: () => {
            doc.addPage();
            pdfHeader(doc, project, title, REPORT_THEMES.files.audit);
            return doc.y;
          },
        });
      } else {
        doc.fontSize(10).font("Helvetica").fillColor("#64748B")
          .text("No document records are available for this project.", 50, doc.y, { width: doc.page.width - 100, align: "center" });
      }
      const reportNumber = `AUDIT-${computeContentHash({ projectId, files }).slice(0, 10).toUpperCase()}`;
      finishProfessionalReport(doc, project, reportNumber, { projectId, files });
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── MEETING MINUTES ────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/meeting-minutes/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const [viewer] = await db
        .select({ isSuperAdmin: usersTable.isSuperAdmin })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      if (!viewer?.isSuperAdmin) {
        const [membership] = await db
          .select({ userId: projectMembersTable.userId })
          .from(projectMembersTable)
          .where(
            and(
              eq(projectMembersTable.projectId, projectId),
              eq(projectMembersTable.userId, userId),
            ),
          )
          .limit(1);
        if (!membership) {
          res.status(403).json({ error: "Not a member of this project" });
          return;
        }
      }
      const requestedMeetingId = req.query.meeting_id
        ? Number(req.query.meeting_id)
        : null;
      if (
        requestedMeetingId !== null &&
        !Number.isInteger(requestedMeetingId)
      ) {
        res.status(400).json({ error: "Invalid meeting_id" });
        return;
      }
      const meetings = await db
        .select()
        .from(meetingMinutesTable)
        .where(
          requestedMeetingId === null
            ? eq(meetingMinutesTable.projectId, projectId)
            : and(
                eq(meetingMinutesTable.projectId, projectId),
                eq(meetingMinutesTable.id, requestedMeetingId),
              ),
        )
        .orderBy(desc(meetingMinutesTable.meetingDate));
      const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      const title =
        requestedMeetingId !== null && meetings[0]
          ? `Meeting Minutes - ${meetings[0].title}`
          : "Meeting Minutes Report";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.meeting.log);
      drawKpis(doc, [
        ["MEETINGS", String(meetings.length)],
        ["SCOPE", requestedMeetingId === null ? "REGISTER" : "RECORD"],
      ], REPORT_THEMES.meeting.log);

      for (const m of meetings) {
        doc.y = sectionBar(
          doc,
          `${new Date(m.meetingDate).toLocaleDateString()} - ${m.title}`,
          doc.y,
          { margin: 50, theme: REPORT_THEMES.meeting.log },
        );
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#64748B")
          .text(`Meeting record ${m.id}`, 50, doc.y, { width: doc.page.width - 100 });
        doc.y += 14;
        if (m.location)
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#666")
            .text(`Location: ${m.location}`);
        if (m.notes)
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(m.notes, { indent: 10 });
        const linkedSubmittals = await db
          .select()
          .from(meetingSubmittalLinksTable)
          .where(
            and(
              eq(meetingSubmittalLinksTable.projectId, projectId),
              eq(meetingSubmittalLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingSubmittalLinksTable.id);
        if (linkedSubmittals.length) {
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text("Linked Submittals (meeting-time values)", { indent: 10 });
          linkedSubmittals.forEach((link) => {
            const details = [
              link.floorSnapshot,
              link.disciplineSnapshot,
              link.statusSnapshot.replace(/[_-]+/g, " "),
              link.responsibleSnapshot,
              link.deadlineSnapshot
                ? `Due ${new Date(link.deadlineSnapshot).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${link.numberSnapshot} — ${link.titleSnapshot}${link.descriptionSnapshot && link.descriptionSnapshot !== link.titleSnapshot ? `: ${link.descriptionSnapshot}` : ""}${details ? ` (${details})` : ""}`,
                { indent: 16 },
              );
          });
        }
        const linkedLensViewpoints = await db
          .select()
          .from(meetingLensViewpointLinksTable)
          .where(
            and(
              eq(meetingLensViewpointLinksTable.projectId, projectId),
              eq(meetingLensViewpointLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingLensViewpointLinksTable.id);
        if (linkedLensViewpoints.length) {
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text("Linked Lens Viewpoints (meeting-time values)", {
              indent: 10,
            });
          linkedLensViewpoints.forEach((link) => {
            const details = [
              link.floorSnapshot,
              link.tradeSnapshot,
              link.responsibleSnapshot,
              link.statusSnapshot.replace(/[_-]+/g, " "),
              `Revision ${link.revisionNumberSnapshot}`,
              link.lifecycleStatusSnapshot,
            ]
              .filter(Boolean)
              .join(" - ");
            const identity = [
              link.displayIdSnapshot || link.viewpointIdSnapshot,
              link.sourceDisplayLabelSnapshot,
              link.bimlogPhysicalIdSnapshot || link.sourcePhysicalIdSnapshot,
            ]
              .filter(Boolean)
              .join(" / ");
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${identity}${link.noteSnapshot ? ` - ${link.noteSnapshot}` : ""}${details ? ` (${details})` : ""}`,
                { indent: 16 },
              );
          });
        }
        const scheduleBuckets = await db
          .select()
          .from(meetingScheduleBucketLinksTable)
          .where(
            and(
              eq(meetingScheduleBucketLinksTable.projectId, projectId),
              eq(meetingScheduleBucketLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingScheduleBucketLinksTable.id);
        for (const bucket of scheduleBuckets) {
          const tasks = await db
            .select()
            .from(meetingScheduleTaskLinksTable)
            .where(
              eq(
                meetingScheduleTaskLinksTable.meetingScheduleBucketLinkId,
                bucket.id,
              ),
            )
            .orderBy(meetingScheduleTaskLinksTable.id);
          const summary = bucket.lastSummary as Record<string, unknown>;
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text(`Schedule Bucket: ${bucket.bucketNameSnapshot}`, {
              indent: 10,
            });
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(
              `Created/Synced task links: ${tasks.length}. Deadline ${new Date(bucket.generalDeadlineSnapshot).toLocaleDateString()}. Summary: created ${summary.created ?? 0}, linked ${summary.linked ?? 0}, updated ${summary.updated ?? 0}, skipped ${summary.skipped ?? 0}, conflicts ${summary.conflicts ?? 0}.`,
              { indent: 16 },
            );
          tasks.forEach((task) => {
            const details = [
              task.floorSnapshot,
              task.disciplineSnapshot,
              task.responsibleSnapshot,
              task.statusSnapshot.replace(/[_-]+/g, " "),
              `Due ${new Date(task.deadlineSnapshot).toLocaleDateString()}`,
            ]
              .filter(Boolean)
              .join(" - ");
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${task.numberSnapshot} - ${task.titleSnapshot}${details ? ` (${details})` : ""}. Schedule task #${task.milestoneId}.`,
                { indent: 16 },
              );
          });
        }
        const linkedClashes = await db
          .select()
          .from(meetingClashLinksTable)
          .where(
            and(
              eq(meetingClashLinksTable.projectId, projectId),
              eq(meetingClashLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingClashLinksTable.id);
        const renderClashes = (
          heading: string,
          links: typeof linkedClashes,
        ) => {
          if (!links.length) return;
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text(heading, { indent: 10 });
          links.forEach((link) => {
            const details = [
              link.floorSnapshot,
              link.disciplineSnapshot,
              link.responsibleSnapshot,
              link.groupSnapshot,
              link.statusSnapshot.replace(/[_-]+/g, " "),
              link.deadlineSnapshot
                ? `Due ${new Date(link.deadlineSnapshot).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const notes = link.meetingNotes
              ? ` Meeting notes: ${link.meetingNotes}`
              : "";
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${link.clashNumberSnapshot || `Clash ${link.clashId}`} — ${link.descriptionSnapshot || "No description"}${details ? ` (${details})` : ""}.${notes}`,
                { indent: 16 },
              );
          });
        };
        renderClashes(
          "Linked Clashes (explicitly refreshed meeting snapshots)",
          linkedClashes.filter((link) => link.linkState === "active"),
        );
        renderClashes(
          "Clash link history (not in active discussion)",
          linkedClashes.filter((link) => link.linkState !== "active"),
        );
        if (m.aiSummary)
          doc
            .fontSize(8)
            .font("Helvetica-Oblique")
            .fillColor("#2563EB")
            .text(`AI Summary: ${m.aiSummary}`, { indent: 10 });
        doc.moveDown(0.5);
      }
      if (!meetings.length)
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No meetings recorded.", { align: "center" });
      const reportNumber = `MEETING-${computeContentHash({ projectId, requestedMeetingId, meetings }).slice(0, 10).toUpperCase()}`;
      finishProfessionalReport(doc, project, reportNumber, { projectId, requestedMeetingId, meetings });
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── CHANGE ORDER LOG ───────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/change-order-log/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const cos = await db
        .select()
        .from(changeOrdersTable)
        .where(eq(changeOrdersTable.projectId, projectId))
        .orderBy(changeOrdersTable.number);
      const doc = createPdfDocument({
        size: "LETTER",
        margin: 50,
        layout: "landscape",
        bufferPages: true,
      });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Change Order Log";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.changeOrder.log);
      drawKpis(doc, [
        ["CHANGE ORDERS", String(cos.length)],
        ["APPROVED", String(cos.filter((record) => record.status === "approved").length)],
        ["OPEN", String(cos.filter((record) => !["approved", "closed", "rejected"].includes(record.status)).length)],
      ], REPORT_THEMES.changeOrder.log);
      if (cos.length) {
        drawTable(doc, {
          x: 50,
          startY: doc.y,
          pageBottom: doc.page.height - 54,
          columns: [
            { label: "Number", key: "number", width: 85 },
            { label: "Title", key: "title", width: 220, wrap: true },
            { label: "Status", key: "status", width: 95 },
            { label: "Value Impact", key: "value", width: 120 },
            { label: "Schedule", key: "schedule", width: 100 },
          ],
          rows: cos.map((record) => ({
            number: record.number,
            title: record.title,
            status: record.status.replace(/_/g, " "),
            value: record.contractValueImpact ?? "Not recorded",
            schedule: record.scheduleImpactDays === null ? "Not recorded" : `${record.scheduleImpactDays} days`,
          })),
          onPageBreak: () => {
            doc.addPage();
            pdfHeader(doc, project, title, REPORT_THEMES.changeOrder.log);
            return doc.y;
          },
        });
      } else {
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No change orders are recorded for this project.", { align: "center" });
      }
      const reportNumber = `CHANGE-${computeContentHash({ projectId, cos }).slice(0, 10).toUpperCase()}`;
      finishProfessionalReport(doc, project, reportNumber, { projectId, cos });
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── TRANSMITTAL LOG ────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/transmittal-log/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId, userId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const txs = await db
        .select()
        .from(transmittalsTable)
        .where(eq(transmittalsTable.projectId, projectId))
        .orderBy(transmittalsTable.number);
      const doc = createPdfDocument({
        size: "LETTER",
        margin: 50,
        layout: "landscape",
        bufferPages: true,
      });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Transmittal Log";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.transmittal.log);
      drawKpis(doc, [
        ["TRANSMITTALS", String(txs.length)],
        ["SENT", String(txs.filter((record) => record.sentAt).length)],
        ["ACKNOWLEDGED", String(txs.filter((record) => record.acknowledgedAt).length)],
      ], REPORT_THEMES.transmittal.log);
      if (txs.length) {
        drawTable(doc, {
          x: 50,
          startY: doc.y,
          pageBottom: doc.page.height - 54,
          columns: [
            { label: "Number", key: "number", width: 95 },
            { label: "Title", key: "title", width: 235, wrap: true },
            { label: "Purpose", key: "purpose", width: 135, wrap: true },
            { label: "Status", key: "status", width: 90 },
            { label: "Sent / Acknowledged", key: "dates", width: 140, wrap: true },
          ],
          rows: txs.map((record) => ({
            number: record.number,
            title: record.title,
            purpose: record.purpose || "Not recorded",
            status: record.status.replace(/_/g, " "),
            dates: `${record.sentAt ? new Date(record.sentAt).toLocaleDateString() : "Not sent"} / ${record.acknowledgedAt ? new Date(record.acknowledgedAt).toLocaleDateString() : "Not acknowledged"}`,
          })),
          onPageBreak: () => {
            doc.addPage();
            pdfHeader(doc, project, title, REPORT_THEMES.transmittal.log);
            return doc.y;
          },
        });
      } else {
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No transmittals are recorded for this project.", { align: "center" });
      }
      const reportNumber = `TRANSMITTAL-${computeContentHash({ projectId, txs }).slice(0, 10).toUpperCase()}`;
      finishProfessionalReport(doc, project, reportNumber, { projectId, txs });
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── CVR FULL REPORT ──────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/cvr/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [allFiles, conventions, versions] = await Promise.all([
      db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      db
        .select()
        .from(namingConventionsTable)
        .where(eq(namingConventionsTable.projectId, projectId))
        .limit(1),
      db
        .select()
        .from(namingConventionVersionsTable)
        .where(eq(namingConventionVersionsTable.projectId, projectId))
        .orderBy(desc(namingConventionVersionsTable.conventionVersion)),
    ]);

    const convention = conventions[0] || null;
    let fields: Array<{
      label: string;
      fieldOrder: number;
      allowedValues: string[];
    }> = [];
    if (convention) {
      fields = (await db
        .select()
        .from(namingFieldsTable)
        .where(eq(namingFieldsTable.conventionId, convention.id))
        .orderBy(namingFieldsTable.fieldOrder)) as typeof fields;
    }
    const latestVersion = versions[0] || null;

    const totalFiles = allFiles.length;
    const matched = allFiles.filter(
      (f) => f.contentVerificationResult === "match",
    ).length;
    const flagged = allFiles.filter(
      (f) =>
        f.contentVerificationResult === "possible_mismatch" ||
        f.contentVerificationResult === "clear_mismatch",
    );
    const pendingReview = allFiles.filter(
      (f) => f.cvrWorkflowStatus === "pending_admin_review",
    ).length;
    const adminApproved = allFiles.filter(
      (f) => f.cvrWorkflowStatus === "admin_approved",
    ).length;
    const adminRejected = allFiles.filter(
      (f) => f.cvrWorkflowStatus === "admin_rejected",
    ).length;
    const notApplicable = allFiles.filter(
      (f) => f.contentVerificationResult === "not_applicable",
    ).length;

    const doc = createPdfDocument({ size: "LETTER", margin: 50, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    const title = "Content Verification Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.files.cvr);

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1D4ED8")
      .text("Convention Intelligence");
    doc.moveDown(0.3);
    if (convention) {
      row(
        doc,
        "Convention Status",
        convention.isActive ? "Active" : "Inactive",
      );
      row(
        doc,
        "Separator",
        convention.separator === "-"
          ? "Dash (-)"
          : convention.separator === "_"
            ? "Underscore (_)"
            : convention.separator,
      );
      row(doc, "Company Codes", convention.companyCode || "Not set");
      row(doc, "Enforce Uppercase", convention.enforceUppercase ? "Yes" : "No");
      row(
        doc,
        "Convention Version",
        String(
          latestVersion?.conventionVersion ?? convention.conventionVersion ?? 1,
        ),
      );
      row(doc, "Total Versions", String(versions.length));
      if (convention.userGuidance) {
        row(doc, "User Guidance", convention.userGuidance);
      }
    } else {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#6B7280")
        .text("No naming convention configured for this project.");
    }
    doc.moveDown(0.5);

    if (latestVersion) {
      const discs = latestVersion.acceptedDisciplines as Array<{
        code: string;
        label: string;
      }>;
      const docTypes = latestVersion.acceptedDocTypes as Array<{
        code: string;
        label: string;
      }>;
      const systems = latestVersion.acceptedSystems as Array<{
        code: string;
        label: string;
      }>;

      if (discs.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Accepted Disciplines");
        doc.moveDown(0.2);
        discs.forEach((d) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${d.code} — ${d.label}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (docTypes.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Accepted Document Types");
        doc.moveDown(0.2);
        docTypes.forEach((d) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${d.code} — ${d.label}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (systems.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Accepted Systems");
        doc.moveDown(0.2);
        systems.forEach((s) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${s.code} — ${s.label}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (fields.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Field Order");
        doc.moveDown(0.2);
        fields.forEach((f, i) => {
          const vals = f.allowedValues?.length
            ? ` (${f.allowedValues.slice(0, 6).join(", ")}${f.allowedValues.length > 6 ? "..." : ""})`
            : "";
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${i + 1}. ${f.label}${vals}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (latestVersion.analysisSummary) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Latest Analysis Summary");
        doc.moveDown(0.2);
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#374151")
          .text(latestVersion.analysisSummary, { indent: 10 });
        doc.moveDown(0.4);
      }
    }

    if (versions.length > 1) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#111")
        .text("Version History");
      doc.moveDown(0.2);
      versions.forEach((v) => {
        const dateStr = new Date(v.createdAt).toLocaleDateString();
        const summary = v.changeSummary
          ? ` — ${v.changeSummary.slice(0, 120)}${v.changeSummary.length > 120 ? "..." : ""}`
          : "";
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#374151")
          .text(`v${v.conventionVersion} (${dateStr})${summary}`, {
            indent: 10,
          });
      });
      doc.moveDown(0.5);
    }

    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1D4ED8")
      .text("File Verification Results");
    doc.moveDown(0.3);

    row(doc, "Total Files Processed", String(totalFiles));
    row(doc, "Matched", String(matched));
    row(doc, "Flagged (Possible + Clear Mismatch)", String(flagged.length));
    row(doc, "Not Applicable", String(notApplicable));
    row(doc, "Pending Admin Review", String(pendingReview));
    row(doc, "Admin Approved", String(adminApproved));
    row(doc, "Admin Rejected", String(adminRejected));
    doc.moveDown();

    if (flagged.length > 0) {
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#DC2626")
        .text("Flagged Files");
      doc.moveDown(0.5);
      for (const f of flagged) {
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text(f.fileName, { continued: true });
        doc
          .font("Helvetica")
          .fillColor("#666")
          .text(
            `  |  CVR: ${f.contentVerificationResult}  |  Workflow: ${f.cvrWorkflowStatus}  |  Uploaded: ${new Date(f.createdAt).toLocaleDateString()}`,
          );
        if (f.hashComparisonNote) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#92400E")
            .text(`  Assessment: ${f.hashComparisonNote}`, { indent: 10 });
        }
        if (f.cvrUserReason) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#555")
            .text(`  User reason: ${f.cvrUserReason}`, { indent: 10 });
        }
        if (f.cvrAdminAction) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#555")
            .text(`  Admin decision: ${f.cvrAdminAction}`, { indent: 10 });
        }
        doc.moveDown(0.3);
      }
    } else if (totalFiles > 0) {
      doc
        .fontSize(10)
        .fillColor("#16A34A")
        .text("No CVR flags found. All files passed content verification.", {
          align: "center",
        });
    } else {
      doc
        .fontSize(10)
        .fillColor("#6B7280")
        .text(
          "No files have been uploaded to this project yet. CVR file analysis will populate this section when files are submitted.",
          { align: "center" },
        );
    }

    const reportNumber = `CVR-${computeContentHash({ projectId, allFiles, convention, fields, versions }).slice(0, 10).toUpperCase()}`;
    finishProfessionalReport(doc, project, reportNumber, { projectId, allFiles, convention, fields, versions });
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

export default router;
