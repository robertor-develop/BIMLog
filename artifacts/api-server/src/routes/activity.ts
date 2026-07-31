import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activityLogTable, projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ListActivityParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { addPageNumbers, computeContentHash, createPdfDocument, drawBrandedHeader, PALETTE, REPORT_THEMES } from "../lib/pdf-kit";
import { drawOperationalRegisterTable } from "../lib/operational-register-table";

const router: IRouter = Router();

type ActivityRow = typeof activityLogTable.$inferSelect;

const safeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);

const ACTIVITY_MAX_TEXT_LENGTH = 220;
const ACTIVITY_MAX_META_ITEMS = 3;
const INTERNAL_ACTIVITY_KEYS = [
  "schemaVersion",
  "snapshotHash",
  "settingsVersion",
  "imagePresentationJson",
  "sections",
  "reportSettings",
  "settingsHash",
];

function compactActivityText(value: string, maxLength = ACTIVITY_MAX_TEXT_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function looksLikeStructuredActivityPayload(value: string): boolean {
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true;
  return INTERNAL_ACTIVITY_KEYS.some((key) => trimmed.includes(key));
}

function parseActivityJsonLike(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!looksLikeStructuredActivityPayload(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { __malformedStructuredActivity: true };
  }
}

function asActivityRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readableActivityValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return compactActivityText(value, 60);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "enabled" : "disabled";
  return null;
}

function collectActivityMeta(payload: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  const nestedSettings = asActivityRecord(payload.reportSettings);
  const reportType = readableActivityValue(payload.reportType ?? payload.outputType ?? payload.format ?? payload.reportFormat ?? nestedSettings?.reportType);
  const preset = readableActivityValue(payload.presetName ?? payload.preset ?? payload.templateName ?? nestedSettings?.presetName ?? nestedSettings?.preset);
  const sectionCount = Array.isArray(payload.sections) ? payload.sections.length : Array.isArray(nestedSettings?.sections) ? nestedSettings.sections.length : null;
  const imageCount = Array.isArray(payload.images) ? payload.images.length : Array.isArray(payload.additionalScreenshots) ? payload.additionalScreenshots.length : null;

  if (reportType) candidates.push(`Output: ${reportType}`);
  if (preset) candidates.push(`Preset: ${preset}`);
  if (typeof sectionCount === "number") candidates.push(`${sectionCount} report sections configured`);
  if (typeof imageCount === "number") candidates.push(`${imageCount} visual references configured`);
  return candidates.slice(0, ACTIVITY_MAX_META_ITEMS);
}

function firstReadableActivityValue(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readableActivityValue(payload[key]);
    if (value) return value;
  }
  const nestedRfi = asActivityRecord(payload.rfi);
  if (nestedRfi) {
    for (const key of keys) {
      const value = readableActivityValue(nestedRfi[key]);
      if (value) return value;
    }
  }
  return null;
}

function isRfiReportActivityPayload(payload: Record<string, unknown>): boolean {
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

function presentRfiActivityDetails(payload: Record<string, unknown>, actionType?: string) {
  const action = String(payload.event || payload.eventType || payload.actionType || payload.type || actionType || "").toLowerCase();
  const rfiNumber = firstReadableActivityValue(payload, ["rfiNumber", "number", "rfiNo", "rfiId", "entityNumber"]) ?? "RFI";
  const reportName = firstReadableActivityValue(payload, ["reportTitle", "fileName", "filename"]);
  const withReport = reportName ? ` (${reportName})` : "";
  const knownSummaries: Array<[RegExp, string]> = [
    [/rfi\.standard_pdf_exported|standard_pdf_exported|rfi_pdf_exported/, `RFI PDF exported: ${rfiNumber}${withReport}`],
    [/rfi\.complete_pdf_exported|complete_pdf_exported/, `Complete RFI PDF exported: ${rfiNumber}${withReport}`],
    [/rfi\.docx_exported|docx_exported|word_exported/, `RFI DOCX exported: ${rfiNumber}${withReport}`],
    [/report_settings_saved|settings_saved/, `RFI report settings saved: ${rfiNumber}`],
    [/report_settings_reset|settings_reset/, `RFI report settings reset: ${rfiNumber}`],
    [/rfi\.updated|rfi_updated|\bupdate\b|updated/, `RFI updated: ${rfiNumber}`],
    [/rfi\.closed|rfi_closed|\bclosed\b/, `RFI closed: ${rfiNumber}`],
    [/rfi\.reopened|rfi_reopened|\breopened/, `RFI reopened: ${rfiNumber}`],
  ];
  const match = knownSummaries.find(([pattern]) => pattern.test(action));
  if (match) return { summary: match[1], meta: collectActivityMeta(payload) };
  if (isRfiReportActivityPayload(payload)) return { summary: `RFI report details recorded: ${rfiNumber}`, meta: collectActivityMeta(payload) };
  return null;
}

function presentActivityDetailsForExport(details: unknown, context: { actionType?: string; entityType?: string | null } = {}) {
  if (details == null || details === "") return { summary: "", meta: [] as string[] };
  if (typeof details === "string" && !looksLikeStructuredActivityPayload(details)) return { summary: compactActivityText(details), meta: [] as string[] };
  const parsed = parseActivityJsonLike(details);
  const record = asActivityRecord(parsed);
  if (record) {
    if (record.__malformedStructuredActivity) return { summary: "Structured activity details were recorded, but the payload could not be displayed safely.", meta: [] as string[] };
    const rfiActivity = presentRfiActivityDetails(record, context.actionType);
    if (rfiActivity || `${context.actionType ?? ""} ${context.entityType ?? ""}`.toLowerCase().includes("rfi")) {
      return rfiActivity ?? {
        summary: `RFI activity recorded: ${firstReadableActivityValue(record, ["rfiNumber", "number", "rfiNo", "entityNumber"]) ?? "RFI"}`,
        meta: collectActivityMeta(record),
      };
    }
    const title = readableActivityValue(record.title ?? record.name ?? record.subject ?? record.fileName ?? record.message);
    if (title) return { summary: title, meta: collectActivityMeta(record) };
    return { summary: "Structured activity details recorded.", meta: collectActivityMeta(record) };
  }
  if (Array.isArray(parsed)) return { summary: `Structured activity details recorded (${parsed.length} items).`, meta: [] as string[] };
  if (typeof details === "string") return { summary: "Structured activity details were recorded, but the payload could not be displayed safely.", meta: [] as string[] };
  return { summary: "Structured activity details recorded.", meta: [] as string[] };
}

function activitySearchText(row: ActivityRow) {
  const detail = presentActivityDetailsForExport(row.details, { actionType: row.actionType, entityType: row.entityType });
  return [
    row.userFullName,
    row.userCompanyName,
    row.fileNameBefore,
    row.fileNameAfter,
    detail.summary,
    detail.meta.join(" "),
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function activityFilters(query: Record<string, unknown>) {
  return {
    lang: query.lang === "es" ? "es" : "en",
    search: safeText(query.search).toLowerCase(),
    action: safeText(query.action),
    dateFrom: safeText(query.dateFrom),
    dateTo: safeText(query.dateTo),
  } as const;
}

function filterActivityRows(rows: ActivityRow[], query: Record<string, unknown>) {
  const filters = activityFilters(query);
  return rows.filter((row) => {
    const haystack = activitySearchText(row);
    const matchesSearch = !filters.search || haystack.includes(filters.search);
    const matchesAction = !filters.action || filters.action === "all" || row.actionType === filters.action;
    const ts = row.createdAt.getTime();
    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).getTime() : null;
    return matchesSearch && matchesAction && (from == null || ts >= from) && (to == null || ts <= to);
  });
}

async function activityProjectContext(projectId: number) {
  const [project] = await db
    .select({ id: projectsTable.id, name: projectsTable.name, code: projectsTable.code })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  return project ?? { id: projectId, name: `Project ${projectId}`, code: String(projectId) };
}

export function sendActivityPdf(res: import("express").Response, input: {
  project: { id: number; name: string; code: string };
  companyName: string;
  rows: ActivityRow[];
  totalRows: number;
  query: Record<string, unknown>;
}) {
  const filters = activityFilters(input.query);
  const label = (en: string, es: string) => (filters.lang === "es" ? es : en);
  const doc = createPdfDocument({ size: "LETTER", layout: "landscape", margin: 36, bufferPages: true, autoFirstPage: true });
  const filename = `Activity-Log-${input.project.code || input.project.id}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const generatedAt = new Date();
  const title = label("Activity Log", "Registro de Actividad");
  const pageHeader = () => drawBrandedHeader(doc, {
    margin: 36,
    companyName: input.companyName,
    title,
    projectName: input.project.name,
    projectCode: input.project.code,
    reportDate: generatedAt,
    theme: REPORT_THEMES.platform.standard,
  }) + 10;
  let y = pageHeader();
  const summary = [
    `${label("Filtered rows", "Filas filtradas")}: ${input.rows.length}`,
    `${label("Total rows", "Filas totales")}: ${input.totalRows}`,
    filters.search ? `${label("Search", "Búsqueda")}: ${filters.search}` : "",
    filters.action && filters.action !== "all" ? `${label("Action", "Acción")}: ${filters.action}` : "",
    filters.dateFrom ? `${label("From", "Desde")}: ${filters.dateFrom}` : "",
    filters.dateTo ? `${label("To", "Hasta")}: ${filters.dateTo}` : "",
  ].filter(Boolean);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PALETTE.TEXT).text(label("Active filter summary", "Resumen de filtros activos"), doc.page.margins.left, y);
  y = doc.y + 4;
  doc.font("Helvetica").fontSize(8).fillColor(PALETTE.TEXT).text(summary.join(" · ") || label("All activity events", "Todos los eventos de actividad"), doc.page.margins.left, y, { width });
  y = doc.y + 10;

  if (input.rows.length === 0) {
    doc
      .roundedRect(doc.page.margins.left, y, width, 48, 6)
      .strokeColor(PALETTE.BORDER)
      .stroke()
      .fillColor(PALETTE.TEXT)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(label("No activity events match the current filters.", "Ningún evento de actividad coincide con los filtros actuales."), doc.page.margins.left + 12, y + 14, { width: width - 24 });
  } else {
    const left = doc.page.margins.left;
    y = drawOperationalRegisterTable(doc, {
      x: left,
      startY: y,
      columns: [
        { label: label("Timestamp", "Fecha/hora"), width: 96, format: (row) => row.createdAt.toISOString().replace("T", " ").slice(0, 19) },
        { label: label("User", "Usuario"), width: 92, format: (row) => safeText(row.userFullName) || "—" },
        { label: label("Company", "Empresa"), width: 88, format: (row) => safeText(row.userCompanyName) || "—" },
        { label: label("Action", "Acción"), width: 62, format: (row) => safeText(row.actionType) || "—" },
        { label: label("Entity", "Entidad"), width: 66, format: (row) => safeText(row.entityType) || "—" },
        {
          label: label("Details", "Detalles"),
          width: 210,
          format: (row) => {
            const detail = presentActivityDetailsForExport(row.details, { actionType: row.actionType, entityType: row.entityType });
            return safeText([detail.summary, ...detail.meta].filter(Boolean).join(" | ")) || "—";
          },
        },
        { label: label("File", "Archivo"), width: 106, format: (row) => safeText(row.fileNameAfter || row.fileNameBefore) || "—" },
      ],
      rows: input.rows,
      fontSize: 8.5,
      headerFontSize: 8.5,
      rowMinHeight: 30,
      cellPadX: 4,
      cellPadY: 5,
      pageBottom: doc.page.height - 52,
      onPageBreak: () => {
        doc.addPage({ size: "LETTER", layout: "landscape", margins: { top: 36, right: 36, bottom: 36, left: 36 } });
        return pageHeader();
      },
    });
  }
  addPageNumbers(doc, {
    margin: 36,
    footerY: doc.page.height - 24,
    fingerprintY: doc.page.height - 36,
    companyName: input.companyName,
    projectName: input.project.name,
    timestamp: generatedAt.toISOString(),
    contentHash: computeContentHash({ projectId: input.project.id, filters, rows: input.rows }),
  });
  doc.end();
}

router.get("/projects/:projectId/activity", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListActivityParams.parse({ projectId: req.params.projectId });

    const entries = await db.query.activityLogTable.findMany({
      where: eq(activityLogTable.projectId, projectId),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    res.json(
      entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("[activity.current_view_pdf_failed]", { name: error instanceof Error ? error.name : "UnknownError" });
    res.status(500).json({ error: "Activity current-view PDF export failed." });
  }
});

router.get("/projects/:projectId/activity/export.pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListActivityParams.parse({ projectId: req.params.projectId });

    const [project, entries] = await Promise.all([
      activityProjectContext(projectId),
      db.query.activityLogTable.findMany({
        where: eq(activityLogTable.projectId, projectId),
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      }),
    ]);

    res.setHeader("Cache-Control", "private, no-store");
    sendActivityPdf(res, {
      project,
      companyName: req.user!.companyName || "Company",
      rows: filterActivityRows(entries, req.query as Record<string, unknown>),
      totalRows: entries.length,
      query: req.query as Record<string, unknown>,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
