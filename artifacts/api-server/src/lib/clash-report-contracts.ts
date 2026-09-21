import * as XLSX from "xlsx";
import { canonicalSpreadsheetJsonOptions, spreadsheetDateOnlyToUtcDate } from "@workspace/api-zod";

export const CLASH_XML_CHUNK_SIZE = 80_000;

export type ClashImportRow = {
  clashIdOriginal: string;
  description: string;
  holdUps: string;
  discipline1: string;
  level: string;
  assignedToName: string;
  resolutionNotes: string | null;
  status: "open" | "resolved";
  dueDate: Date | null;
};

export type ClashColumnMapping = {
  clashId: number;
  description: number;
  element1: number;
  element2: number;
  discipline: number;
  level: number;
  assignedTo: number;
  status: number;
  resolutionNotes: number;
  deadline: number;
  viewpoint: number;
  holdUps: number;
};

export const emptyClashColumnMapping = (): ClashColumnMapping => ({
  clashId: -1, description: -1, element1: -1, element2: -1,
  discipline: -1, level: -1, assignedTo: -1, status: -1,
  resolutionNotes: -1, deadline: -1, viewpoint: -1, holdUps: -1,
});

export function clashImportFormat(fileName: string): { extension: string; spreadsheet: boolean; xml: boolean; persistedFormat: string } {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const spreadsheet = ["xlsx", "xls", "csv"].includes(extension);
  return { extension, spreadsheet, xml: extension === "xml", persistedFormat: spreadsheet ? "excel" : extension || "other" };
}

export function chunkClashSource(source: string, size = CLASH_XML_CHUNK_SIZE): string[] {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("CLASH_CHUNK_SIZE_INVALID");
  const chunks: string[] = [];
  for (let offset = 0; offset < source.length; offset += size) chunks.push(source.slice(offset, offset + size));
  return chunks;
}

export function parseAiJsonArray(text: string): unknown[] {
  const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
  if (!Array.isArray(parsed)) throw new Error("CLASH_IMPORT_ARRAY_REQUIRED");
  return parsed;
}

const text = (value: unknown) => String(value ?? "").trim();

export function normalizeAiClashRows(records: unknown[], mode: "xml" | "document"): ClashImportRow[] {
  return records.flatMap(record => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    const row = record as Record<string, unknown>;
    const description = text(row.description);
    const viewpoint = text(row.viewpoint);
    if (!description && !viewpoint) return [];
    const rawStatus = text(row.status).toLowerCase();
    return [{
      clashIdOriginal: viewpoint,
      description,
      holdUps: text(row.holdUps),
      discipline1: text(row.discipline) || (mode === "xml" ? "COORD" : ""),
      level: text(row.level),
      assignedToName: text(mode === "xml" ? row.assignedToName : row.assignedTo),
      resolutionNotes: text(row.resolutionNotes) || null,
      status: rawStatus === "complete" || rawStatus === "resolved" ? "resolved" : "open",
      dueDate: row.dueDate || row.deadline ? spreadsheetDateOnlyToUtcDate(row.dueDate ?? row.deadline) : null,
    }];
  });
}

export function deduplicateClashRows(rows: ClashImportRow[]): ClashImportRow[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = row.clashIdOriginal.trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function selectClashSpreadsheetRows(workbook: XLSX.WorkBook): { headers: string[]; rows: unknown[][] } {
  let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
  let bestRowCount = -1;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true })) as unknown[][];
    const populated = rows.filter(row => row.filter(cell => text(cell)).length > 2).length;
    if (populated > bestRowCount) { bestRowCount = populated; bestSheet = sheet; }
  }
  const allRows = XLSX.utils.sheet_to_json(bestSheet, canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true })) as unknown[][];
  const headerIndex = Math.max(0, allRows.findIndex(row => row.filter(cell => text(cell)).length > 2));
  return {
    headers: (allRows[headerIndex] ?? []).map(cell => text(cell).toLowerCase()),
    rows: allRows.slice(headerIndex + 1).filter(row => row.some(cell => text(cell))),
  };
}

export function mapClashSpreadsheetRows(rows: unknown[][], mapping: ClashColumnMapping): ClashImportRow[] {
  const get = (row: unknown[], index: number) => index >= 0 ? text(row[index]) : "";
  const getDate = (row: unknown[], index: number) => {
    if (index < 0 || !row[index]) return null;
    try { return spreadsheetDateOnlyToUtcDate(row[index], serial => XLSX.SSF.parse_date_code(serial)); }
    catch { return null; }
  };
  return rows.map(row => ({
    clashIdOriginal: get(row, mapping.viewpoint) || get(row, mapping.clashId),
    description: get(row, mapping.description),
    holdUps: get(row, mapping.holdUps),
    discipline1: get(row, mapping.discipline),
    level: get(row, mapping.level),
    assignedToName: get(row, mapping.assignedTo),
    resolutionNotes: get(row, mapping.resolutionNotes) || null,
    status: "open" as const,
    dueDate: getDate(row, mapping.deadline),
  })).filter(row => row.description || row.clashIdOriginal);
}

export function nextClashReportNumber(projectCode: string | null | undefined, existing: Array<string | null | undefined>): string {
  const prefix = `${String(projectCode || "PRJ").trim() || "PRJ"}-CR-`;
  const used = new Set(existing.filter((value): value is string => Boolean(value)));
  let sequence = existing.length + 1;
  while (used.has(`${prefix}${String(sequence).padStart(3, "0")}`)) sequence++;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

export function clashStatusPresentation(status: string, language: "en" | "es"): string {
  const labels: Record<string, { en: string; es: string }> = {
    all: { en: "All statuses", es: "Todos los estados" },
    open: { en: "Active", es: "Activo" },
    follow_up: { en: "Follow Up", es: "Seguimiento" },
    waiting_design: { en: "Waiting Design", es: "Esperando Diseno" },
    in_progress: { en: "In Progress", es: "En Progreso" },
    approved: { en: "Approved", es: "Aprobado" },
    resolved: { en: "Resolved", es: "Resuelto" },
    wont_fix: { en: "Won't Fix", es: "No se corregira" },
  };
  return labels[status]?.[language] || status.replace(/_/g, " ");
}
