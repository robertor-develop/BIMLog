import { Router } from "express";
import { db } from "@workspace/db";
import {
  rfisTable, submittalsTable, filesTable, projectMembersTable, projectsTable, activityLogTable, usersTable, companiesTable,
  clashReportsTable, clashesTable, submittalReportsTable, submittalItemsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, ne, or, count, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { getAnthropicClientForUser } from "../lib/ai-usage";
import {
  addPageNumbers,
  computeContentHash,
  createPdfDocument,
  drawBrandedHeader,
  drawTable,
  PALETTE,
  REPORT_THEMES,
  sectionBar,
  type TableColumn,
} from "../lib/pdf-kit";

const router: Router = Router();

// In-memory cache: userId → { result, expiresAt }
const cache = new Map<number, { result: object; expiresAt: number }>();

const PENDING_TYPES = ["rfis", "submittals", "files"] as const;
type PendingType = typeof PENDING_TYPES[number];
type Lang = "en" | "es";

function parseLang(value: unknown): Lang {
  return value === "es" ? "es" : "en";
}

function label(lang: Lang, en: string, es: string): string {
  return lang === "es" ? es : en;
}

function cleanText(value: unknown, fallback = "-"): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text.trim() || fallback;
}

function humanStatus(value: unknown): string {
  return cleanText(value).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const MAX_ACTIVITY_TEXT_LENGTH = 220;
const MAX_ACTIVITY_META_ITEMS = 3;
const INTERNAL_ACTIVITY_KEYS = [
  "schemaVersion",
  "snapshotHash",
  "settingsVersion",
  "imagePresentationJson",
  "sections",
  "reportSettings",
  "settingsHash",
];

type PresentedActivityDetails = { summary: string; meta: string[]; isStructured: boolean };

function compactActivityText(value: string, maxLength = MAX_ACTIVITY_TEXT_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function looksLikeStructuredActivity(value: string): boolean {
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true;
  return INTERNAL_ACTIVITY_KEYS.some(key => trimmed.includes(key));
}

function parseActivityJsonLike(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!looksLikeStructuredActivity(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { __malformedStructuredActivity: true };
  }
}

function activityRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function activityReadableValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return compactActivityText(value, 60);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "enabled" : "disabled";
  return null;
}

function collectActivityMeta(payload: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  const nestedSettings = activityRecord(payload.reportSettings);
  const reportType = activityReadableValue(payload.reportType ?? payload.outputType ?? payload.format ?? payload.reportFormat ?? nestedSettings?.reportType);
  const preset = activityReadableValue(payload.presetName ?? payload.preset ?? payload.templateName ?? nestedSettings?.presetName ?? nestedSettings?.preset);
  const sectionCount = Array.isArray(payload.sections) ? payload.sections.length : Array.isArray(nestedSettings?.sections) ? nestedSettings.sections.length : null;
  const imageCount = Array.isArray(payload.images) ? payload.images.length : Array.isArray(payload.additionalScreenshots) ? payload.additionalScreenshots.length : null;

  if (reportType) candidates.push(`Output: ${reportType}`);
  if (preset) candidates.push(`Preset: ${preset}`);
  if (typeof sectionCount === "number") candidates.push(`${sectionCount} report sections configured`);
  if (typeof imageCount === "number") candidates.push(`${imageCount} visual references configured`);

  return candidates.slice(0, MAX_ACTIVITY_META_ITEMS);
}

function firstActivityReadable(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = activityReadableValue(payload[key]);
    if (value) return value;
  }
  const nestedRfi = activityRecord(payload.rfi);
  if (nestedRfi) {
    for (const key of keys) {
      const value = activityReadableValue(nestedRfi[key]);
      if (value) return value;
    }
  }
  return null;
}

function isRfiActivityPayload(payload: Record<string, unknown>): boolean {
  const text = JSON.stringify(payload).toLowerCase();
  return text.includes("rfi") && (
    "sections" in payload ||
    "schemaVersion" in payload ||
    "snapshotHash" in payload ||
    "settingsVersion" in payload ||
    "reportSettings" in payload ||
    "imagePresentationJson" in payload
  );
}

function presentRfiActivityDetails(payload: Record<string, unknown>, actionType?: string): PresentedActivityDetails | null {
  const action = String(payload.event || payload.eventType || payload.actionType || payload.type || actionType || "").toLowerCase();
  const rfiNumber = firstActivityReadable(payload, ["rfiNumber", "number", "rfiNo", "rfiId", "entityNumber"]) ?? "RFI";
  const reportName = firstActivityReadable(payload, ["reportTitle", "fileName", "filename"]);
  const withReport = reportName ? ` (${reportName})` : "";
  const knownSummaries: Array<[RegExp, string]> = [
    [/rfi\.standard_pdf_exported|standard_pdf_exported|rfi_pdf_exported/, `RFI PDF exported: ${rfiNumber}${withReport}`],
    [/rfi\.complete_pdf_exported|complete_pdf_exported/, `Complete RFI PDF exported: ${rfiNumber}${withReport}`],
    [/rfi\.docx_exported|docx_exported|word_exported/, `RFI DOCX exported: ${rfiNumber}${withReport}`],
    [/report_settings_saved|settings_saved/, `RFI report settings saved: ${rfiNumber}`],
    [/report_settings_reset|settings_reset/, `RFI report settings reset: ${rfiNumber}`],
    [/rfi\.updated|rfi_updated|\bupdate\b|updated/, `RFI updated: ${rfiNumber}`],
    [/rfi\.closed|rfi_closed|\bclosed\b/, `RFI closed: ${rfiNumber}`],
    [/rfi\.reopened|rfi_reopened|\breopened\b/, `RFI reopened: ${rfiNumber}`],
  ];
  const match = knownSummaries.find(([pattern]) => pattern.test(action));
  if (match) return { summary: match[1], meta: collectActivityMeta(payload), isStructured: true };
  if (isRfiActivityPayload(payload)) return { summary: `RFI report details recorded: ${rfiNumber}`, meta: collectActivityMeta(payload), isStructured: true };
  return null;
}

function presentStructuredActivityDetails(payload: Record<string, unknown>, actionType?: string, entityType?: string): PresentedActivityDetails {
  if (payload.__malformedStructuredActivity) {
    return { summary: "Structured activity details were recorded, but the payload could not be displayed safely.", meta: [], isStructured: true };
  }

  const rfiActivity = presentRfiActivityDetails(payload, actionType);
  if (rfiActivity || `${actionType ?? ""} ${entityType ?? ""}`.toLowerCase().includes("rfi")) {
    return rfiActivity ?? {
      summary: `RFI activity recorded: ${firstActivityReadable(payload, ["rfiNumber", "number", "rfiNo", "entityNumber"]) ?? "RFI"}`,
      meta: collectActivityMeta(payload),
      isStructured: true,
    };
  }

  const title = activityReadableValue(payload.title ?? payload.name ?? payload.subject ?? payload.fileName ?? payload.message);
  if (title) return { summary: title, meta: collectActivityMeta(payload), isStructured: true };
  return { summary: "Structured activity details recorded.", meta: collectActivityMeta(payload), isStructured: true };
}

function presentDashboardActivityDetails(details: unknown, context: { actionType?: string; entityType?: string } = {}): PresentedActivityDetails {
  if (details == null || details === "") return { summary: "", meta: [], isStructured: false };
  if (typeof details === "string" && !looksLikeStructuredActivity(details)) return { summary: compactActivityText(details), meta: [], isStructured: false };

  const parsed = parseActivityJsonLike(details);
  const record = activityRecord(parsed);
  if (record) return presentStructuredActivityDetails(record, context.actionType, context.entityType);
  if (Array.isArray(parsed)) return { summary: `Structured activity details recorded (${parsed.length} items).`, meta: [], isStructured: true };
  if (typeof details === "string") return { summary: "Structured activity details were recorded, but the payload could not be displayed safely.", meta: [], isStructured: true };
  return { summary: "Structured activity details recorded.", meta: [], isStructured: true };
}

function formatPresentedActivityDetails(details: PresentedActivityDetails): string {
  return [details.summary, ...details.meta].map(value => cleanText(value, "")).filter(Boolean).join(" | ") || "-";
}

function fmtDate(value: unknown, lang: Lang): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(lang === "es" ? "es-US" : "en-US");
}

function safeFilename(value: string): string {
  return value.replace(/[/\\?%*:|"<>]/g, "-").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "report.pdf";
}

function disposition(filename: string): string {
  const clean = safeFilename(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  return `attachment; filename="${clean}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

function pdfBuffer(render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createPdfDocument({ size: "LETTER", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    render(doc);
    doc.end();
  });
}

function ensureRoom(doc: PDFKit.PDFDocument, y: number, needed = 70): number {
  if (y + needed <= 720) return y;
  doc.addPage();
  return 40;
}

function writeKeyValues(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, x: number, y: number, width: number): number {
  let cy = y;
  for (const [key, value] of rows) {
    doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor(PALETTE.MUTED).text(key, x, cy, { width: width * 0.38, lineBreak: false });
    doc.fontSize(7).font(PALETTE.FONT).fillColor(PALETTE.TEXT).text(value, x + width * 0.4, cy, { width: width * 0.6, lineBreak: false, ellipsis: true });
    cy += 13;
  }
  return cy;
}

function writeEmptyState(doc: PDFKit.PDFDocument, text: string, y: number): number {
  y = ensureRoom(doc, y, 46);
  doc.rect(40, y, 532, 34).fill(PALETTE.ROW_ALT).stroke(PALETTE.BORDER);
  doc.fontSize(9).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(text, 52, y + 11, { width: 508 });
  return y + 48;
}

function renderTableSection(doc: PDFKit.PDFDocument, title: string, rows: any[], columns: TableColumn[], y: number, emptyText: string): number {
  y = ensureRoom(doc, y, 70);
  y = sectionBar(doc, title, y, { theme: REPORT_THEMES.platform.standard });
  if (rows.length === 0) return writeEmptyState(doc, emptyText, y);
  return drawTable(doc, {
    x: 40,
    startY: y,
    columns,
    rows,
    pageBottom: 724,
    rowMinHeight: 24,
    fontSize: 7,
    headerFontSize: 6.5,
    onPageBreak: () => { doc.addPage(); return 40; },
  }) + 18;
}

async function getScopedProjectIds(userId: number): Promise<Array<{ projectId: number; role: string }>> {
  return db
    .select({ projectId: projectMembersTable.projectId, role: projectMembersTable.role })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, userId));
}

async function getDashboardExportData(userId: number) {
  const memberships = await getScopedProjectIds(userId);
  const projectIds = memberships.map((m: { projectId: number }) => m.projectId);
  const roleMap = new Map(memberships.map((m: { projectId: number; role: string }) => [m.projectId, m.role]));
  if (projectIds.length === 0) {
    return {
      projects: [] as any[],
      rfis: [] as any[],
      submittals: [] as any[],
      files: [] as any[],
      activity: [] as any[],
      clashStats: { totalClashes: 0, openClashes: 0, p1Clashes: 0, clashReports: 0, submittalTrackers: 0, openSubmittalItems: 0 },
    };
  }

  const [projects, rfis, submittals, files, activity, clashReports, openClashes, submittalTrackers, openSubmittalItems] = await Promise.all([
    db.select().from(projectsTable).where(inArray(projectsTable.id, projectIds)),
    db.select().from(rfisTable).where(inArray(rfisTable.projectId, projectIds)),
    db.select().from(submittalsTable).where(inArray(submittalsTable.projectId, projectIds)),
    db.select({
      id: filesTable.id,
      projectId: filesTable.projectId,
      fileName: filesTable.fileName,
      status: filesTable.status,
      contentVerificationResult: filesTable.contentVerificationResult,
      userConfirmedNonCompliant: filesTable.userConfirmedNonCompliant,
      isCompliant: filesTable.isCompliant,
      cvrWorkflowStatus: filesTable.cvrWorkflowStatus,
      uploadedByCompany: companiesTable.name,
    })
      .from(filesTable)
      .leftJoin(usersTable, eq(filesTable.uploadedById, usersTable.id))
      .leftJoin(companiesTable, eq(usersTable.companyId, companiesTable.id))
      .where(inArray(filesTable.projectId, projectIds)),
    db.select().from(activityLogTable).where(inArray(activityLogTable.projectId, projectIds)).orderBy(desc(activityLogTable.createdAt)),
    db.select({ id: clashReportsTable.id, totalClashes: clashReportsTable.totalClashes, p1Count: clashReportsTable.p1Count }).from(clashReportsTable).where(inArray(clashReportsTable.projectId, projectIds)),
    db.select({ id: clashesTable.id }).from(clashesTable).where(and(inArray(clashesTable.projectId, projectIds), eq(clashesTable.status, "open"))),
    db.select({ id: submittalReportsTable.id }).from(submittalReportsTable).where(inArray(submittalReportsTable.projectId, projectIds)),
    db.select({ id: submittalItemsTable.id }).from(submittalItemsTable).where(and(inArray(submittalItemsTable.projectId, projectIds), eq(submittalItemsTable.submittalStatus, "open"))),
  ]);

  const projectRows = await Promise.all((projects as any[]).map(async (p: any) => {
    const [[memberCount], [fileCount], [admin]] = await Promise.all([
      db.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, p.id)),
      db.select({ count: count() }).from(filesTable).where(eq(filesTable.projectId, p.id)),
      db
        .select({ fullName: usersTable.fullName, companyName: companiesTable.name })
        .from(projectMembersTable)
        .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
        .innerJoin(companiesTable, eq(usersTable.companyId, companiesTable.id))
        .where(and(eq(projectMembersTable.projectId, p.id), eq(projectMembersTable.role, "project_admin")))
        .limit(1),
    ]);
    return {
      ...p,
      memberCount: memberCount?.count ?? 0,
      fileCount: fileCount?.count ?? 0,
      userRole: roleMap.get(p.id) ?? "",
      adminName: admin?.fullName ?? "",
      adminCompany: admin?.companyName ?? "",
    };
  }));

  return {
    projects: projectRows,
    rfis,
    submittals,
    files,
    activity,
    clashStats: {
      totalClashes: (clashReports as any[]).reduce((sum: number, r: any) => sum + (r.totalClashes ?? 0), 0),
      openClashes: openClashes.length,
      p1Clashes: (clashReports as any[]).reduce((sum: number, r: any) => sum + (r.p1Count ?? 0), 0),
      clashReports: clashReports.length,
      submittalTrackers: submittalTrackers.length,
      openSubmittalItems: openSubmittalItems.length,
    },
  };
}

async function getPendingRows(userId: number, type: PendingType) {
  const memberships = await getScopedProjectIds(userId);
  const projectIds = memberships.map((m: { projectId: number }) => m.projectId);
  if (!projectIds.length) return [];
  if (type === "rfis") {
    return db.select({
      id: rfisTable.id,
      rfi_number: rfisTable.number,
      title: rfisTable.subject,
      status: rfisTable.status,
      due_date: rfisTable.dueDate,
      project_id: projectsTable.id,
      project_name: projectsTable.name,
      project_code: projectsTable.code,
    })
      .from(rfisTable)
      .innerJoin(projectsTable, eq(rfisTable.projectId, projectsTable.id))
      .where(and(inArray(rfisTable.projectId, projectIds), ne(rfisTable.status, "closed")));
  }
  if (type === "submittals") {
    return db.select({
      id: submittalsTable.id,
      submittal_number: submittalsTable.number,
      title: submittalsTable.title,
      status: submittalsTable.status,
      due_date: submittalsTable.dueDate,
      project_id: projectsTable.id,
      project_name: projectsTable.name,
      project_code: projectsTable.code,
    })
      .from(submittalsTable)
      .innerJoin(projectsTable, eq(submittalsTable.projectId, projectsTable.id))
      .where(and(
        inArray(submittalsTable.projectId, projectIds),
        inArray(submittalsTable.status, ["pending", "awaiting_review", "under_review"]),
      ));
  }
  return db.select({
    id: filesTable.id,
    file_name: filesTable.fileName,
    compliance_status: filesTable.isCompliant,
    cvr_workflow_status: filesTable.cvrWorkflowStatus,
    project_id: projectsTable.id,
    project_name: projectsTable.name,
    project_code: projectsTable.code,
  })
    .from(filesTable)
    .innerJoin(projectsTable, eq(filesTable.projectId, projectsTable.id))
    .where(and(
      inArray(filesTable.projectId, projectIds),
      or(
        eq(filesTable.cvrWorkflowStatus, "pending_review"),
        eq(filesTable.cvrWorkflowStatus, "pending_admin_review"),
        eq(filesTable.isCompliant, false),
      ),
    ));
}

// ── GET /dashboard/stats ──────────────────────────────────────────────────────
function renderDashboardPdf(args: {
  lang: Lang;
  generatedAt: Date;
  generatedBy: string;
  companyName: string;
  data: Awaited<ReturnType<typeof getDashboardExportData>>;
  projectFilters: {
    search: string;
    status: string;
    sort: "name_asc" | "name_desc" | "code_asc" | "status_asc";
  };
}) {
  const { lang, generatedAt, generatedBy, companyName, data, projectFilters } = args;
  const allProjects = data.projects as any[];
  const search = projectFilters.search.toLowerCase();
  const projects = allProjects
    .filter((project: any) => projectFilters.status === "all" || project.status === projectFilters.status)
    .filter((project: any) => !search || [
      project.code,
      project.name,
      project.clientName,
      project.clientCompany,
      project.location,
    ].some(value => String(value || "").toLowerCase().includes(search)))
    .sort((left: any, right: any) => {
      if (projectFilters.sort === "name_desc") return String(right.name || "").localeCompare(String(left.name || ""), undefined, { sensitivity: "base" });
      if (projectFilters.sort === "code_asc") return String(left.code || "").localeCompare(String(right.code || ""), undefined, { numeric: true, sensitivity: "base" });
      if (projectFilters.sort === "status_asc") return `${left.status || ""}-${left.name || ""}`.localeCompare(`${right.status || ""}-${right.name || ""}`, undefined, { sensitivity: "base" });
      return String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" });
    });
  const rfis = data.rfis as any[];
  const submittals = data.submittals as any[];
  const files = data.files as any[];
  const activity = data.activity as any[];
  const projectMap = new Map<number, any>(allProjects.map((p: any) => [Number(p.id), p]));
  const openRfis = rfis.filter((r: any) => r.status !== "closed");
  const pendingSubmittals = submittals.filter((s: any) => ["pending", "under_review"].includes(s.status));
  const completedFiles = files.filter((f: any) => f.status === "valid" || f.status === "rejected");
  const compliantFiles = completedFiles.filter((f: any) => f.status === "valid");
  const complianceRate = completedFiles.length ? Math.round((compliantFiles.length / completedFiles.length) * 100) : null;
  const filesNeedingAttention = files.filter((f: any) =>
    (f.status === "rejected" || f.contentVerificationResult === "possible_mismatch" || f.contentVerificationResult === "clear_mismatch") && f.status !== "in_progress"
  );
  const confirmedViolations = files.filter((f: any) => f.userConfirmedNonCompliant === true);
  const nowMs = generatedAt.getTime();
  const overdueRfiProjectIds = new Set<number>(rfis.filter((r: any) => r.status !== "closed" && r.dueDate && new Date(r.dueDate).getTime() < nowMs).map((r: any) => Number(r.projectId)));
  const rejectedFileProjectIds = new Set<number>(filesNeedingAttention.map((f: any) => Number(f.projectId)));
  const pendingSubProjectIds = new Set<number>(submittals.filter((s: any) => s.status === "pending").map((s: any) => Number(s.projectId)));
  const needsAttention: Array<{ project: string; code: string; issue: string }> = [];
  overdueRfiProjectIds.forEach(pid => {
    const p = projectMap.get(pid);
    if (p) needsAttention.push({ project: p.name, code: p.code, issue: label(lang, "Has overdue RFIs", "Tiene RFI vencidos") });
  });
  rejectedFileProjectIds.forEach(pid => {
    const p = projectMap.get(pid);
    if (p) needsAttention.push({ project: p.name, code: p.code, issue: label(lang, "Naming or content verification attention", "Atencion de nomenclatura o verificacion de contenido") });
  });
  pendingSubProjectIds.forEach(pid => {
    if (overdueRfiProjectIds.has(pid) || rejectedFileProjectIds.has(pid)) return;
    const p = projectMap.get(pid);
    if (p) needsAttention.push({ project: p.name, code: p.code, issue: label(lang, "Pending submittals", "Submittals pendientes") });
  });
  const violatorMap = new Map<string, { count: number; projectIds: Set<number> }>();
  confirmedViolations.forEach((f: any) => {
    const company = cleanText((f as any).uploadedByCompany, label(lang, "Unknown", "Desconocida"));
    if (!violatorMap.has(company)) violatorMap.set(company, { count: 0, projectIds: new Set() });
    const item = violatorMap.get(company)!;
    item.count++;
    item.projectIds.add(f.projectId);
  });
  const topViolators = [...violatorMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([company, item]: [string, { count: number; projectIds: Set<number> }]) => ({ company, rejections: item.count, projects: item.projectIds.size }));
  const recentActivity = activity.slice(0, 15).map((a: any) => ({
    action: humanStatus(a.actionType),
    user: a.userFullName,
    company: a.userCompanyName,
    project: projectMap.get(a.projectId)?.name ?? "-",
    details: formatPresentedActivityDetails(presentDashboardActivityDetails(a.details, { actionType: a.actionType, entityType: a.entityType })),
    date: fmtDate(a.createdAt, lang),
  }));
  const stats = {
    activeProjects: allProjects.filter((p: any) => p.status === "active").length,
    filesProcessed: files.length,
    openRfis: openRfis.length,
    pendingSubmittals: pendingSubmittals.length,
    complianceRate,
    filesNeedingAttention: filesNeedingAttention.length,
    ...data.clashStats,
  };
  const contentHash = computeContentHash({ report: "dashboard-current-view", lang, generatedBy, stats, projects, projectFilters, needsAttention, recentActivity, topViolators });
  const reportNumber = `DASH-${contentHash.slice(0, 10).toUpperCase()}`;
  return pdfBuffer(doc => {
    doc.info.Title = label(lang, "BIMLog Headquarters Dashboard", "Sede BIMLog");
    doc.info.Author = "BIMLog by IgniteSmart";
    let y = drawBrandedHeader(doc, {
      companyName: companyName || "BIMLog",
      title: label(lang, "BIMLog Headquarters Dashboard", "Sede BIMLog"),
      subtitle: label(lang, "Headquarters Dashboard", "Panel de sede"),
      projectName: label(lang, "Cross-project headquarters", "Sede entre proyectos"),
      reportNumber,
      reportDate: generatedAt,
      theme: REPORT_THEMES.platform.standard,
    }) + 12;
    y = writeKeyValues(doc, [
      [label(lang, "Generated by", "Generado por"), generatedBy],
      [label(lang, "Company", "Empresa"), companyName || "-"],
      [label(lang, "Generated", "Generado"), generatedAt.toLocaleString(lang === "es" ? "es-US" : "en-US")],
      [label(lang, "Scope", "Alcance"), label(lang, "Authenticated user's project memberships", "Membresias de proyecto del usuario autenticado")],
      [label(lang, "Visible filters", "Filtros visibles"), [
        `${label(lang, "Project search", "Busqueda de proyecto")}: ${projectFilters.search || label(lang, "None", "Ninguna")}`,
        `${label(lang, "Status", "Estado")}: ${projectFilters.status === "all" ? label(lang, "All", "Todos") : humanStatus(projectFilters.status)}`,
        `${label(lang, "Sort", "Orden")}: ${projectFilters.sort.replace(/_/g, " ")}`,
        `${label(lang, "Visible projects", "Proyectos visibles")}: ${projects.length}/${allProjects.length}`,
      ].join(" | ")],
    ], 40, y, 532) + 10;
    y = sectionBar(doc, label(lang, "KPI Summary", "Resumen KPI"), y, { theme: REPORT_THEMES.platform.standard });
    const cardW = 126;
    const cards = [
      [label(lang, "Active Projects", "Proyectos activos"), String(stats.activeProjects)],
      [label(lang, "Files Processed", "Archivos procesados"), String(stats.filesProcessed)],
      [label(lang, "Open RFIs", "RFI abiertos"), String(stats.openRfis)],
      [label(lang, "Pending Submittals", "Submittals pendientes"), String(stats.pendingSubmittals)],
      [label(lang, "Compliance Rate", "Tasa de cumplimiento"), stats.complianceRate === null ? "-" : `${stats.complianceRate}%`],
      [label(lang, "Files Needing Attention", "Archivos que requieren atencion"), String(stats.filesNeedingAttention)],
      [label(lang, "Open Clashes", "Interferencias abiertas"), String(stats.openClashes)],
      [label(lang, "Open Submittal Items", "Submittals abiertos"), String(stats.openSubmittalItems)],
    ];
    cards.forEach(([name, value], i) => {
      const x = 40 + (i % 4) * (cardW + 9);
      const cy = y + Math.floor(i / 4) * 48;
      doc.rect(x, cy, cardW, 38).fill(PALETTE.ROW_ALT).stroke(PALETTE.BORDER);
      doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor(PALETTE.MUTED).text(name, x + 7, cy + 7, { width: cardW - 14, lineBreak: false, ellipsis: true });
      doc.fontSize(14).font(PALETTE.FONT_BOLD).fillColor(PALETTE.TEXT).text(value, x + 7, cy + 20, { width: cardW - 14, lineBreak: false });
    });
    y += 106;
    y = renderTableSection(doc, label(lang, "Needs Attention", "Requiere atencion"), needsAttention.slice(0, 6), [
      { label: label(lang, "Code", "Codigo"), width: 58, key: "code" },
      { label: label(lang, "Project", "Proyecto"), width: 210, key: "project", wrap: true },
      { label: label(lang, "Issue", "Problema"), width: 264, key: "issue", wrap: true },
    ], y, label(lang, "No visible attention items.", "No hay elementos visibles que requieran atencion."));
    y = renderTableSection(doc, label(lang, "Projects", "Proyectos"), projects.map((p: any) => ({ code: p.code, name: p.name, status: humanStatus(p.status), admin: [p.adminName, p.adminCompany].filter(Boolean).join(" / ") || "-", members: p.memberCount, files: p.fileCount })), [
      { label: label(lang, "Code", "Codigo"), width: 50, key: "code" },
      { label: label(lang, "Project", "Proyecto"), width: 158, key: "name", wrap: true },
      { label: label(lang, "Status", "Estado"), width: 66, key: "status" },
      { label: label(lang, "Admin / Company", "Admin / Empresa"), width: 168, key: "admin", wrap: true },
      { label: label(lang, "Members", "Miembros"), width: 44, key: "members", align: "right" },
      { label: label(lang, "Files", "Archivos"), width: 46, key: "files", align: "right" },
    ], y, label(lang, "No scoped projects are visible.", "No hay proyectos visibles en el alcance."));
    y = renderTableSection(doc, label(lang, "Recent Activity", "Actividad reciente"), recentActivity, [
      { label: label(lang, "Date", "Fecha"), width: 58, key: "date" },
      { label: label(lang, "Action", "Accion"), width: 72, key: "action" },
      { label: label(lang, "User", "Usuario"), width: 94, key: "user", wrap: true },
      { label: label(lang, "Company", "Empresa"), width: 94, key: "company", wrap: true },
      { label: label(lang, "Project", "Proyecto"), width: 92, key: "project", wrap: true },
      { label: label(lang, "Details", "Detalles"), width: 122, key: "details", wrap: true },
    ], y, label(lang, "No recent activity is visible.", "No hay actividad reciente visible."));
    y = renderTableSection(doc, label(lang, "Top Naming Violators", "Principales incumplimientos de nomenclatura"), topViolators, [
      { label: label(lang, "Company", "Empresa"), width: 330, key: "company", wrap: true },
      { label: label(lang, "Rejections", "Rechazos"), width: 100, key: "rejections", align: "right" },
      { label: label(lang, "Projects", "Proyectos"), width: 102, key: "projects", align: "right" },
    ], y, label(lang, "All visible companies are compliant.", "Todas las empresas visibles cumplen."));
    addPageNumbers(doc, { companyName: companyName || "BIMLog", projectName: label(lang, "Cross-project headquarters", "Sede entre proyectos"), reportNumber, timestamp: generatedAt.toISOString(), contentHash, footerY: 756, fingerprintY: 742 });
  });
}

function renderPendingPdf(args: { lang: Lang; generatedAt: Date; generatedBy: string; companyName: string; type: PendingType; rows: any[] }) {
  const { lang, generatedAt, generatedBy, companyName, type, rows } = args;
  const typeLabel = { rfis: label(lang, "Open RFIs", "RFI abiertos"), submittals: label(lang, "Pending Submittals", "Submittals pendientes"), files: label(lang, "Files Needing Attention", "Archivos que requieren atencion") }[type];
  const reportTitle = `${typeLabel} — ${label(lang, "Current View", "Vista actual")}`;
  const contentHash = computeContentHash({ report: "pending-current-view", type, lang, generatedBy, rows });
  const reportNumber = `PEND-${type.toUpperCase()}-${contentHash.slice(0, 10).toUpperCase()}`;
  const normalizedRows = rows.map((row: any) => ({
    projectCode: row.project_code,
    number: type === "rfis" ? row.rfi_number : type === "submittals" ? row.submittal_number : "-",
    status: type === "files" ? row.cvr_workflow_status === "pending_review" || row.cvr_workflow_status === "pending_admin_review" ? label(lang, "Pending Review", "Revision pendiente") : row.compliance_status === false ? label(lang, "Non Compliant", "No cumple") : humanStatus(row.status) : humanStatus(row.status),
    title: type === "files" ? row.file_name : row.title,
    projectName: row.project_name,
    dueDate: type === "files" ? "-" : fmtDate(row.due_date, lang),
  }));
  return pdfBuffer(doc => {
    doc.info.Title = reportTitle;
    doc.info.Author = "BIMLog by IgniteSmart";
    let y = drawBrandedHeader(doc, { companyName: companyName || "BIMLog", title: reportTitle, subtitle: label(lang, "Headquarters Dashboard", "Panel de sede"), projectName: label(lang, "Cross-project pending items", "Pendientes entre proyectos"), reportNumber, reportDate: generatedAt, theme: REPORT_THEMES.platform.standard }) + 12;
    y = writeKeyValues(doc, [
      [label(lang, "Generated by", "Generado por"), generatedBy],
      [label(lang, "Company", "Empresa"), companyName || "-"],
      [label(lang, "Generated", "Generado"), generatedAt.toLocaleString(lang === "es" ? "es-US" : "en-US")],
      [label(lang, "Pending type", "Tipo pendiente"), typeLabel],
      [label(lang, "Visible filters", "Filtros visibles"), `${label(lang, "Type", "Tipo")}: ${type}`],
      [label(lang, "Visible count", "Conteo visible"), `${rows.length}`],
    ], 40, y, 532) + 10;
    y = renderTableSection(doc, typeLabel, normalizedRows, [
      { label: label(lang, "Project Code", "Codigo"), width: 62, key: "projectCode" },
      { label: label(lang, "Number", "Numero"), width: 76, key: "number" },
      { label: label(lang, "Status", "Estado"), width: 86, key: "status", wrap: true },
      { label: label(lang, "Title / File", "Titulo / Archivo"), width: 156, key: "title", wrap: true },
      { label: label(lang, "Project", "Proyecto"), width: 104, key: "projectName", wrap: true },
      { label: label(lang, "Due Date", "Vence"), width: 48, key: "dueDate" },
    ], y, label(lang, "No rows match the current visible pending type.", "Ninguna fila coincide con el tipo pendiente visible."));
    addPageNumbers(doc, { companyName: companyName || "BIMLog", projectName: label(lang, "Cross-project pending items", "Pendientes entre proyectos"), reportNumber, timestamp: generatedAt.toISOString(), contentHash, footerY: 756, fingerprintY: 742 });
  });
}

router.get("/dashboard/stats", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, userId));

  const projectIds = memberships.map((m: { projectId: number }) => m.projectId);

  if (projectIds.length === 0) {
    res.json({
      activeProjects: 0,
      filesProcessed: 0,
      openRfis: 0,
      pendingSubmittals: 0,
      complianceRate: null,
      filesNeedingAttention: 0,
    });
    return;
  }

  const [
    activeProjectsRes,
    allFilesRes,
    compliantFilesRes,
    attentionFilesRes,
    openRfisRes,
    pendingSubmittalsRes,
    clashReportsRes,
    openClashesRes,
    submittalTrackersRes,
    openSubmittalItemsRes,
  ] = await Promise.all([
    db.select({ id: projectsTable.id }).from(projectsTable)
      .where(and(
        inArray(projectsTable.id, projectIds),
        ne(projectsTable.status, "archived"),
      )),
    db.select({ id: filesTable.id }).from(filesTable)
      .where(inArray(filesTable.projectId, projectIds)),
    db.select({ id: filesTable.id }).from(filesTable)
      .where(and(
        inArray(filesTable.projectId, projectIds),
        eq(filesTable.isCompliant, true),
      )),
    db.select({ id: filesTable.id }).from(filesTable)
      .where(and(
        inArray(filesTable.projectId, projectIds),
        or(
          eq(filesTable.isCompliant, false),
          eq(filesTable.contentVerificationResult, "possible_mismatch"),
          eq(filesTable.contentVerificationResult, "clear_mismatch"),
        ),
      )),
    db.select({ id: rfisTable.id }).from(rfisTable)
      .where(and(
        inArray(rfisTable.projectId, projectIds),
        ne(rfisTable.status, "closed"),
      )),
    db.select({ id: submittalsTable.id }).from(submittalsTable)
      .where(and(
        inArray(submittalsTable.projectId, projectIds),
        inArray(submittalsTable.status, ["pending", "under_review"]),
      )),
    db.select({ id: clashReportsTable.id, totalClashes: clashReportsTable.totalClashes, p1Count: clashReportsTable.p1Count })
      .from(clashReportsTable)
      .where(inArray(clashReportsTable.projectId, projectIds)),
    db.select({ id: clashesTable.id }).from(clashesTable)
      .where(and(
        inArray(clashesTable.projectId, projectIds),
        eq(clashesTable.status, "open"),
      )),
    db.select({ id: submittalReportsTable.id })
      .from(submittalReportsTable)
      .where(inArray(submittalReportsTable.projectId, projectIds)),
    db.select({ id: submittalItemsTable.id }).from(submittalItemsTable)
      .where(and(
        inArray(submittalItemsTable.projectId, projectIds),
        eq(submittalItemsTable.submittalStatus, "open"),
      )),
  ]);

  const totalFiles = allFilesRes.length;
  const complianceRate = totalFiles > 0
    ? Math.round((compliantFilesRes.length / totalFiles) * 100)
    : null;

  const totalClashes = clashReportsRes.reduce((sum: number, r: { totalClashes?: number | null }) => sum + (r.totalClashes ?? 0), 0);
  const p1Clashes = clashReportsRes.reduce((sum: number, r: { p1Count?: number | null }) => sum + (r.p1Count ?? 0), 0);
  res.json({
    activeProjects: activeProjectsRes.length,
    filesProcessed: totalFiles,
    openRfis: openRfisRes.length,
    pendingSubmittals: pendingSubmittalsRes.length,
    complianceRate,
    filesNeedingAttention: attentionFilesRes.length,
    totalClashes,
    openClashes: openClashesRes.length,
    p1Clashes,
    clashReports: clashReportsRes.length,
    submittalTrackers: submittalTrackersRes.length,
    openSubmittalItems: openSubmittalItemsRes.length,
  });
});

// ── GET /dashboard/briefing ───────────────────────────────────────────────────
router.get("/dashboard/briefing", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    res.json(cached.result);
    return;
  }

  const fallback = {
    summary: "Your projects are active — review open items.",
    criticalItems: [] as string[],
    todaysDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };

  try {
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, userId));
    const projectIds = memberships.map((m: { projectId: number }) => m.projectId);

    if (!projectIds.length) {
      res.json({
        summary: "Welcome to BIMLog. Create or join a project to get started.",
        criticalItems: [],
        todaysDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
      return;
    }

    const [openRfis, pendingSubs, rejectedFiles, projects] = await Promise.all([
      db.select({ id: rfisTable.id, dueDate: rfisTable.dueDate }).from(rfisTable)
        .where(and(inArray(rfisTable.projectId, projectIds), ne(rfisTable.status, "closed"))),
      db.select({ id: submittalsTable.id }).from(submittalsTable)
        .where(and(inArray(submittalsTable.projectId, projectIds), eq(submittalsTable.status, "pending"))),
      db.select({ id: filesTable.id }).from(filesTable)
        .where(and(inArray(filesTable.projectId, projectIds), eq(filesTable.status, "rejected"))),
      db.select({ name: projectsTable.name }).from(projectsTable)
        .where(inArray(projectsTable.id, projectIds)),
    ]);

    const overdueRfis = openRfis.filter((r: { dueDate?: Date | string | null }) => r.dueDate && new Date(r.dueDate).getTime() < now);
    const stats = {
      projects: projects.length,
      openRfis: openRfis.length,
      overdueRfis: overdueRfis.length,
      pendingSubmittals: pendingSubs.length,
      namingIssues: rejectedFiles.length,
      projectNames: projects.slice(0, 3).map((p: { name: string }) => p.name).join(", "),
    };

    const todaysDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const anthropic = await getAnthropicClientForUser({
      userId,
      feature: "dashboard_briefing",
    });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      system: "You are BIMLog's intelligence engine. Return ONLY valid JSON. No markdown. No explanation.",
      messages: [{
        role: "user",
        content: `Project data: ${JSON.stringify(stats)}
Return exactly:
{"summary":"one sentence, most important thing today with specific numbers","criticalItems":["up to 3 short urgent strings"],"todaysDate":"${todaysDate}"}`,
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let result: object;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { ...fallback, todaysDate };
    }

    cache.set(userId, { result, expiresAt: now + 60 * 60 * 1000 });
    res.json(result);
  } catch {
    res.json(fallback);
  }
});

// ── GET /dashboard/pending/rfis ───────────────────────────────────────────────
router.post("/dashboard/export-pdf", authMiddleware, async (req, res) => {
  try {
    const body = req.body as {
      lang?: string;
      projectSearch?: unknown;
      projectStatus?: unknown;
      projectSort?: unknown;
    } | undefined;
    const lang = parseLang(body?.lang);
    const projectSearch = typeof body?.projectSearch === "string" ? body.projectSearch.trim() : "";
    const projectStatus = typeof body?.projectStatus === "string" ? body.projectStatus.trim() : "all";
    const projectSort = typeof body?.projectSort === "string" ? body.projectSort.trim() : "name_asc";
    const dashboardSorts = new Set(["name_asc", "name_desc", "code_asc", "status_asc"]);
    if (projectSearch.length > 160 || !/^(all|[a-z][a-z0-9_-]{0,31})$/.test(projectStatus) || !dashboardSorts.has(projectSort)) {
      res.status(400).json({ error: "Invalid dashboard current-view filters." });
      return;
    }
    const generatedAt = new Date();
    const data = await getDashboardExportData(req.user!.userId);
    const pdf = await renderDashboardPdf({
      lang,
      generatedAt,
      generatedBy: `${req.user!.fullName} <${req.user!.email}>`,
      companyName: req.user!.companyName || "BIMLog",
      data,
      projectFilters: {
        search: projectSearch,
        status: projectStatus,
        sort: projectSort as "name_asc" | "name_desc" | "code_asc" | "status_asc",
      },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", disposition("bimlog-headquarters-dashboard-current-view.pdf"));
    res.setHeader("X-Content-SHA256", computeContentHash({
      surface: "dashboard",
      userId: req.user!.userId,
      generatedAt: generatedAt.toISOString(),
      projectFilters: { search: projectSearch, status: projectStatus, sort: projectSort },
      rowCounts: { projects: data.projects.length, rfis: data.rfis.length, submittals: data.submittals.length, files: data.files.length, activity: data.activity.length },
    }));
    res.send(pdf);
  } catch (err) {
    console.error("[dashboard.current_view_pdf_failed]", { name: err instanceof Error ? err.name : "UnknownError" });
    res.status(500).json({ error: "Dashboard current-view PDF export failed." });
  }
});

router.post("/dashboard/pending/export-pdf", authMiddleware, async (req, res) => {
  try {
    const body = req.body as { type?: string; lang?: string } | undefined;
    const type = body?.type;
    if (!type || !PENDING_TYPES.includes(type as PendingType)) {
      res.status(400).json({ error: "Invalid pending type. Expected rfis, submittals, or files." });
      return;
    }
    const lang = parseLang(body?.lang);
    const generatedAt = new Date();
    const rows = await getPendingRows(req.user!.userId, type as PendingType);
    const pdf = await renderPendingPdf({
      lang,
      generatedAt,
      generatedBy: `${req.user!.fullName} <${req.user!.email}>`,
      companyName: req.user!.companyName || "BIMLog",
      type: type as PendingType,
      rows,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", disposition(`pending-${type}-current-view.pdf`));
    res.setHeader("X-Content-SHA256", computeContentHash({ surface: "pending", type, userId: req.user!.userId, generatedAt: generatedAt.toISOString(), count: rows.length }));
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Pending Items PDF export failed" });
  }
});

router.get("/dashboard/pending/rfis", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const rows = await getPendingRows(userId, "rfis");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /dashboard/pending/submittals ─────────────────────────────────────────
router.get("/dashboard/pending/submittals", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const rows = await getPendingRows(userId, "submittals");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /dashboard/pending/files ──────────────────────────────────────────────
router.get("/dashboard/pending/files", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const rows = await getPendingRows(userId, "files");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
