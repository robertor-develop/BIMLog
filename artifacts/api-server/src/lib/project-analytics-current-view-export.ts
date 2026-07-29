import { pool } from "@workspace/db";
import {
  addPageNumbers,
  computeContentHash,
  createPdfDocument,
  drawBrandedHeader,
  drawTable,
  PALETTE,
  REPORT_THEMES,
  reportFileName,
  sectionBar,
} from "./pdf-kit";
import { loadProjectInsightsSummary, type ProjectInsightsSummary } from "./project-insights-metrics";

type AnalyticsSection = "operational" | "compliance" | "company" | "rfi" | "unavailable" | "boundaries";
type ExportLanguage = "en" | "es";

export class ProjectAnalyticsExportError extends Error {
  status: number;
  messageEs: string;

  constructor(status: number, message: string, messageEs: string) {
    super(message);
    this.status = status;
    this.messageEs = messageEs;
  }
}

const SECTION_ORDER: AnalyticsSection[] = ["operational", "compliance", "company", "rfi", "unavailable", "boundaries"];
const SECTION_LABELS: Record<AnalyticsSection, { en: string; es: string }> = {
  operational: { en: "Operational context", es: "Contexto operativo" },
  compliance: { en: "Naming compliance", es: "Cumplimiento de nombres" },
  company: { en: "Company performance", es: "Desempeño por empresa" },
  rfi: { en: "RFI status performance", es: "Desempeño por estado RFI" },
  unavailable: { en: "Unavailable analytics", es: "Analítica no disponible" },
  boundaries: { en: "Surface boundaries", es: "Límites de superficie" },
};

const RFI_STATUS_LABELS: Record<string, { en: string; es: string }> = {
  answered: { en: "Answered", es: "Respondido" },
  closed: { en: "Closed", es: "Cerrado" },
  draft: { en: "Draft", es: "Borrador" },
  open: { en: "Open", es: "Abierto" },
  overdue: { en: "Overdue", es: "Vencido" },
  pending: { en: "Pending", es: "Pendiente" },
  rejected: { en: "Rejected", es: "Rechazado" },
  reviewed: { en: "Reviewed", es: "Revisado" },
  submitted: { en: "Submitted", es: "Enviado" },
  unknown: { en: "Unknown", es: "Desconocido" },
};

const UNAVAILABLE_METRIC_LABELS: Record<string, { en: string; es: string }> = {
  historical_trends: { en: "Historical trends", es: "Tendencias históricas" },
  schedule_forecast_causes: { en: "Schedule forecast causes", es: "Causas del pronóstico del cronograma" },
};

const t = (lang: ExportLanguage, en: string, es: string) => (lang === "es" ? es : en);
const clean = (value: unknown) => String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

function parseLang(value: unknown): ExportLanguage {
  return value === "es" ? "es" : "en";
}

function invalidSections(): never {
  throw new ProjectAnalyticsExportError(
    400,
    "Selected Analytics export sections are invalid.",
    "Las secciones seleccionadas para exportar Analítica no son válidas.",
  );
}

function parseSections(value: unknown): AnalyticsSection[] {
  if (value == null) return [...SECTION_ORDER];
  if (typeof value !== "string") invalidSections();
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) invalidSections();
  if (entries.includes("all")) {
    if (entries.length === 1) return [...SECTION_ORDER];
    invalidSections();
  }
  const invalid = entries.find((entry) => !SECTION_ORDER.includes(entry as AnalyticsSection));
  if (invalid) invalidSections();
  return SECTION_ORDER.filter((section) => entries.includes(section));
}

function displayStatusLabel(status: string, lang: ExportLanguage) {
  const key = clean(status).toLowerCase();
  if (RFI_STATUS_LABELS[key]) return RFI_STATUS_LABELS[key][lang];
  const humanized = clean(status).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return humanized || "—";
}

function unavailableMetricLabel(key: string, lang: ExportLanguage) {
  const normalized = clean(key).toLowerCase();
  return UNAVAILABLE_METRIC_LABELS[normalized]?.[lang] ?? displayStatusLabel(key, lang);
}

function drawKeyValueGrid(doc: PDFKit.PDFDocument, y: number, rows: Array<[string, string]>) {
  const x = 40;
  const cardW = 126;
  const cardH = 52;
  rows.forEach(([label, value], index) => {
    const cx = x + (index % 4) * (cardW + 8);
    const cy = y + Math.floor(index / 4) * (cardH + 8);
    doc.rect(cx, cy, cardW, cardH).fill("#F8FAFC").stroke("#E5E7EB");
    doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor(PALETTE.MUTED).text(label.toUpperCase(), cx + 8, cy + 8, { width: cardW - 16, lineBreak: false, ellipsis: true });
    doc.fontSize(16).font(PALETTE.FONT_BOLD).fillColor(PALETTE.NAVY).text(value, cx + 8, cy + 25, { width: cardW - 16, lineBreak: false, ellipsis: true });
  });
  return y + Math.ceil(rows.length / 4) * (cardH + 8) + 4;
}

async function projectContext(projectId: number) {
  const result = await pool.query(
    `SELECT p.id,p.name,p.code,p.location,COALESCE(NULLIF(c.name,''),'Company') AS owner_company
     FROM projects p
     JOIN users creator ON creator.id=p.created_by_id
     LEFT JOIN companies c ON c.id=creator.company_id
     WHERE p.id=$1 LIMIT 1`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

function publicMetricAuthorityLabel(lang: ExportLanguage) {
  return t(lang, "BIMLog governed project metrics", "Métricas de proyecto gobernadas por BIMLog");
}

function activeSummary(summary: ProjectInsightsSummary, sections: AnalyticsSection[], lang: ExportLanguage) {
  return [
    `${t(lang, "Sections", "Secciones")}: ${sections.map((section) => SECTION_LABELS[section][lang]).join(", ")}`,
    `${t(lang, "Timezone", "Zona horaria")}: ${summary.metricAuthority.timezone}`,
    `${t(lang, "Metric authority", "Autoridad métrica")}: ${publicMetricAuthorityLabel(lang)}`,
    `${t(lang, "Partial source state", "Estado parcial de fuentes")}: ${summary.metricAuthority.partial ? t(lang, "Partial", "Parcial") : t(lang, "Complete", "Completo")}`,
  ];
}

function addSpanishPageNumbers(
  doc: PDFKit.PDFDocument,
  input: { contentHash: string; companyName: string; projectName: string; reportNumber: string; timestamp: string },
) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const pageNumber = index - range.start + 1;
    doc.font(PALETTE.FONT).fontSize(7).fillColor(PALETTE.MUTED);
    doc.text(`${input.companyName} • ${input.projectName}`, 40, 742, { width: 220, lineBreak: false, ellipsis: true });
    doc.text(`${input.reportNumber} • ${input.timestamp}`, 260, 742, { width: 180, lineBreak: false, ellipsis: true });
    doc.text(`Página ${pageNumber} de ${range.count}`, 470, 742, { width: 90, align: "right" });
    doc.text(`Documento SHA-256: ${input.contentHash}`, 40, 756, { width: 520, lineBreak: false, ellipsis: true });
  }
}

export async function buildProjectAnalyticsCurrentViewPdf(input: {
  userId: number;
  fullName?: string;
  companyName?: string;
  projectId: number;
  timezone: string;
  language: ExportLanguage;
  sections: AnalyticsSection[];
  superAdminAccess?: string;
  superAdminReason?: string;
}) {
  const lang = parseLang(input.language);
  if (!input.sections.length) invalidSections();
  const sections = input.sections;
  const summary = await loadProjectInsightsSummary({
    userId: input.userId,
    projectId: input.projectId,
    timezone: input.timezone,
    superAdminAccess: input.superAdminAccess,
    superAdminReason: input.superAdminReason,
  });
  const project = await projectContext(input.projectId);
  if (!project) {
    const error = new Error("Project not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const generatedAt = new Date();
  const reportTitle = t(lang, "Project Insights — Current View", "Perspectivas del Proyecto — Vista actual");
  const reportNumber = `PI-${clean(project.code || project.id)}-${generatedAt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
  const fileName = reportFileName(reportTitle);
  const snapshot = {
    reportTitle,
    projectId: input.projectId,
    generatedAt: generatedAt.toISOString(),
    language: lang,
    sections,
    publicMetricAuthority: publicMetricAuthorityLabel(lang),
    summary,
  };
  const contentHash = computeContentHash(snapshot);
  const doc = createPdfDocument({ size: "LETTER", margin: 40, bufferPages: true, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const companyName = input.companyName || clean(project.owner_company) || "Company";
  const projectName = clean(project.name) || `Project ${input.projectId}`;
  const projectMeta = `${t(lang, "Project Code", "Código de proyecto")}: ${clean(project.code) || "—"} | ${t(lang, "Sections", "Secciones")}: ${sections.length}`;
  let y = drawBrandedHeader(doc, {
    margin: 40,
    companyName,
    title: reportTitle,
    subtitle: `${t(lang, "Project Insights", "Perspectivas del Proyecto")} | ${projectMeta} | ${t(lang, "Prepared by", "Preparado por")}: ${input.fullName || t(lang, "Authenticated user", "Usuario autenticado")}`,
    projectName,
    projectCode: clean(project.code) || undefined,
    reportNumber,
    reportDate: generatedAt,
    theme: REPORT_THEMES.platform.performance,
  }) + 12;
  const continuationHeader = () => {
    doc.addPage();
    return drawBrandedHeader(doc, {
      margin: 40,
      companyName,
      title: reportTitle,
      subtitle: t(lang, "Current-view report — continued", "Informe de vista actual — continuación"),
      projectName,
      projectCode: clean(project.code) || undefined,
      reportNumber,
      reportDate: generatedAt,
      theme: REPORT_THEMES.platform.performance,
    }) + 12;
  };
  const ensureInsightsSpace = (currentY: number, needed = 90) =>
    currentY + needed > 545 ? continuationHeader() : currentY;
  y = sectionBar(doc, t(lang, "Active filter summary", "Resumen de filtros activos"), y, { theme: REPORT_THEMES.platform.performance });
  for (const line of activeSummary(summary, sections, lang)) {
    doc.fontSize(9).font(PALETTE.FONT).fillColor(PALETTE.TEXT);
    const lineHeight = Math.max(14, doc.heightOfString(line, { width: 500 }) + 2);
    doc.text(line, 48, y, { width: 500 });
    y += lineHeight;
  }
  y += 8;

  if (summary.metricAuthority.partial) {
    y = ensureInsightsSpace(y, 54);
    doc.rect(40, y, 532, 42).fill("#FFF7ED").stroke("#FED7AA");
    doc.fontSize(9).font(PALETTE.FONT_BOLD).fillColor("#9A3412").text(t(lang, "Partial source data", "Datos parciales"), 50, y + 8);
    doc.fontSize(8).font(PALETTE.FONT).fillColor("#9A3412").text(t(lang, "One or more authorized sources could not report. Missing sources are not counted as zero.", "Una o más fuentes autorizadas no pudieron reportar. Las fuentes faltantes no se cuentan como cero."), 50, y + 22, { width: 500 });
    y += 54;
  }

  if (sections.includes("operational")) {
    y = ensureInsightsSpace(y, 115);
    y = sectionBar(doc, SECTION_LABELS.operational[lang], y, { theme: REPORT_THEMES.platform.performance });
    y = drawKeyValueGrid(doc, y, [
      [t(lang, "Actionable", "Accionables"), String(summary.operationalContext.actionable)],
      [t(lang, "Overdue", "Vencidas"), String(summary.operationalContext.overdue)],
      [t(lang, "Due soon", "Vencen pronto"), String(summary.operationalContext.dueSoon)],
      [t(lang, "Blocked", "Bloqueadas"), String(summary.operationalContext.blocked)],
    ]);
  }

  if (sections.includes("compliance")) {
    y = ensureInsightsSpace(y, 120);
    y = sectionBar(doc, SECTION_LABELS.compliance[lang], y, { theme: REPORT_THEMES.platform.performance });
    y = drawKeyValueGrid(doc, y, [
      [t(lang, "Total files", "Archivos totales"), String(summary.compliance.totalFiles)],
      [t(lang, "Valid files", "Archivos válidos"), String(summary.compliance.validFiles)],
      [t(lang, "Rejected files", "Archivos rechazados"), String(summary.compliance.rejectedFiles)],
      [t(lang, "Compliance rate", "Tasa de cumplimiento"), summary.compliance.complianceRate == null ? "—" : `${summary.compliance.complianceRate}%`],
    ]);
    if (summary.compliance.unavailable) {
      doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(t(lang, "Unavailable until files exist.", "No disponible hasta que existan archivos."), 48, y, { width: 500 });
      y += 16;
    }
  }

  if (sections.includes("company")) {
    y = ensureInsightsSpace(y, 118);
    y = sectionBar(doc, SECTION_LABELS.company[lang], y, { theme: REPORT_THEMES.platform.performance });
    if (summary.compliance.companyPerformanceRedacted) {
      doc.rect(40, y, 532, 42).fill("#F8FAFC").stroke("#CBD5E1");
      doc.fontSize(9).font(PALETTE.FONT_BOLD).fillColor(PALETTE.NAVY).text(t(lang, "Company performance redacted", "Desempeño por empresa redactado"), 50, y + 8);
      doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(t(lang, summary.compliance.companyPerformanceUnavailableReason || "Company-level performance is unavailable for this role.", summary.compliance.companyPerformanceUnavailableReasonEs || "El desempeño por empresa no está disponible para este rol."), 50, y + 22, { width: 500 });
      y += 54;
    } else if (summary.compliance.companies.length) {
      const rows = summary.compliance.companies.map((row) => ({ company: clean(row.company), rejected: row.rejected }));
      y = drawTable(doc, {
        x: 40,
        startY: y,
        columns: [
          { label: t(lang, "Company", "Empresa"), width: 410, key: "company", wrap: true },
          { label: t(lang, "Rejected", "Rechazados"), width: 90, key: "rejected", align: "right" },
        ],
        rows,
        pageBottom: 545,
        onPageBreak: continuationHeader,
      }) + 12;
    } else {
      doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(t(lang, "Company performance will appear when authoritative data exists.", "El desempeño aparecerá cuando existan datos autorizados."), 48, y, { width: 500 });
      y += 18;
    }
  }

  if (sections.includes("rfi")) {
    y = ensureInsightsSpace(y, 140);
    y = sectionBar(doc, SECTION_LABELS.rfi[lang], y, { theme: REPORT_THEMES.platform.performance });
    y = drawKeyValueGrid(doc, y, [
      [t(lang, "Total RFIs", "RFIs totales"), String(summary.rfiPerformance.total)],
      [t(lang, "Open RFIs", "RFIs abiertos"), String(summary.rfiPerformance.open)],
      [t(lang, "Over 7 days", "Más de 7 días"), String(summary.rfiPerformance.agingOver7Days)],
      [t(lang, "Average open age", "Antigüedad promedio"), summary.rfiPerformance.averageOpenAgeDays == null ? "—" : `${summary.rfiPerformance.averageOpenAgeDays}d`],
    ]);
    const statusRows = Object.entries(summary.rfiPerformance.byStatus).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => ({ status: displayStatusLabel(status, lang), count }));
    if (statusRows.length) {
      y = drawTable(doc, { x: 40, startY: y, columns: [{ label: t(lang, "Status", "Estado"), width: 400, key: "status" }, { label: t(lang, "Count", "Conteo"), width: 100, key: "count", align: "right" }], rows: statusRows, pageBottom: 545, onPageBreak: continuationHeader }) + 12;
    } else {
      doc.fontSize(9).font(PALETTE.FONT_BOLD).fillColor(PALETTE.NAVY).text(t(lang, "No RFIs yet", "Aún no hay RFIs"), 48, y, { width: 500 });
      y += 18;
    }
  }

  if (sections.includes("unavailable")) {
    y = ensureInsightsSpace(y, 100);
    y = sectionBar(doc, SECTION_LABELS.unavailable[lang], y, { theme: REPORT_THEMES.platform.performance });
    const rows = summary.unavailable.map((entry) => ({ metric: unavailableMetricLabel(entry.key, lang), reason: lang === "es" ? entry.reasonEs : entry.reason }));
    y = drawTable(doc, { x: 40, startY: y, columns: [{ label: t(lang, "Metric", "Métrica"), width: 150, key: "metric" }, { label: t(lang, "Reason", "Razón"), width: 350, key: "reason", wrap: true }], rows, pageBottom: 545, onPageBreak: continuationHeader }) + 12;
  }

  if (sections.includes("boundaries")) {
    y = ensureInsightsSpace(y, 90);
    y = sectionBar(doc, SECTION_LABELS.boundaries[lang], y, { theme: REPORT_THEMES.platform.performance });
    const boundaries = [
      t(lang, "Report-navigation links are informational and do not grant authority.", "Los enlaces de informes son informativos y no otorgan autoridad."),
      t(lang, "Recent Activity remains in Activity Log. Recent Files remains in Files. Operational selections and actions remain in Coordinator Command Center.", "La Actividad Reciente permanece en Registro de Actividad. Los Archivos Recientes permanecen en Archivos. Las selecciones y acciones operativas permanecen en el Centro de Control de Coordinación."),
      t(lang, "No AI calls, hidden metric internals, storage paths, private audit content, provider URLs or all-record dumps are included.", "No se incluyen llamadas de IA, detalles internos ocultos, rutas de almacenamiento, auditoría privada, URLs de proveedor ni volcados de todos los registros."),
    ];
    boundaries.forEach((line) => { doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.TEXT).text(`• ${line}`, 50, y, { width: 500 }); y += 22; });
  }

  const footerTimestamp = generatedAt.toISOString();
  if (lang === "es") {
    addSpanishPageNumbers(doc, { contentHash, companyName, projectName, reportNumber, timestamp: footerTimestamp });
  } else {
    addPageNumbers(doc, {
      contentHash,
      companyName,
      projectName,
      reportNumber,
      timestamp: footerTimestamp,
    });
  }
  doc.end();
  const buffer = await done;
  return { buffer, fileName, contentHash, generatedAt: generatedAt.toISOString(), reportNumber };
}

export const projectAnalyticsExportSections = SECTION_ORDER;
export { parseLang as parseProjectAnalyticsExportLang, parseSections as parseProjectAnalyticsExportSections };
