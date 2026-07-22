import * as XLSX from "xlsx";
import { canonicalSpreadsheetJsonOptions, canonicalSpreadsheetReadOptions, canonicalSpreadsheetWriteOptions, classifySpreadsheetTemporalText, explicitSpreadsheetInstant, spreadsheetDateOnlyToUtcDate } from "@workspace/api-zod";
import AdmZip from "adm-zip";

const EMPTY = "";
const DATE_FORMAT = "m/d/yyyy";
const TIMESTAMP_FORMAT = "m/d/yyyy h:mm AM/PM";
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const PROTECTED_PATTERN = /storage[_ ]?path|source[_ ]?location|\/api\/v1\/projects\/\d+\/files\/\d+|https?:\/\/\S*[?&](?:token|key|signature|sig)=|[A-Za-z]:\\/i;
const NUMERIC_PATTERN = /^-?(?:\d+|\d*\.\d+)$/;

export type RfiRegisterSource = {
  id: number;
  projectId: number;
  number: string;
  subject: string;
  rfiType?: string | null;
  status: string;
  priority: string;
  revisionNumber?: number | null;
  parentRfiId?: number | null;
  revisionOf?: number | null;
  createdById: number;
  assignedToId?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  dateRequested?: Date | string | null;
  dateRequired?: Date | string | null;
  dueDate?: Date | string | null;
  dateAnswered?: Date | string | null;
  respondedAt?: Date | string | null;
  closedAt?: Date | string | null;
  reopenedAt?: Date | string | null;
  sendStatus?: string | null;
  sentAt?: Date | string | null;
  sentById?: number | null;
  sendMethod?: string | null;
  ballInCourt?: string | null;
  submittedByCompany?: string | null;
  submittedByContact?: string | null;
  submittedByAddress?: string | null;
  submittedByPhone?: string | null;
  submittedByEmail?: string | null;
  submittedToCompany?: string | null;
  submittedToPerson?: string | null;
  submittedToEmail?: string | null;
  drawingNumber?: string | null;
  drawingTitle?: string | null;
  specSection?: string | null;
  detailNumber?: string | null;
  noteNumber?: string | null;
  locationDescription?: string | null;
  projectAddress?: string | null;
  sourceViewpointId?: string | null;
  sourceViewpointLabel?: string | null;
  question?: string | null;
  description?: string | null;
  costImpact?: string | null;
  costImpactAmount?: string | null;
  costImpactReason?: string | null;
  scheduleImpact?: string | null;
  scheduleImpactDays?: number | null;
  scheduleImpactReason?: string | null;
  distributionList?: string[] | null;
  emailDescription?: string | null;
  emailDraft?: string | null;
  attachmentsJson?: string[] | null;
  answer?: string | null;
  response?: string | null;
  answeredBy?: string | null;
};

export type RfiRegisterResponseSource = {
  id: number;
  rfiId: number;
  projectId: number;
  responseNumber: number;
  responseText: string;
  answeredBy?: string | null;
  answeredByEmail?: string | null;
  answeredByCompany?: string | null;
  costImpact?: string | null;
  costImpactAmount?: string | null;
  costImpactReason?: string | null;
  scheduleImpact?: string | null;
  scheduleImpactDays?: number | null;
  scheduleImpactReason?: string | null;
  responseAttachmentsJson?: string[] | null;
  isConflictOfInterest?: boolean | null;
  createdAt: Date | string;
};

export type RfiRegisterCustodySource = {
  id: number;
  rfiId: number;
  heldBy: string;
  heldByCompany: string;
  fromDate: Date | string;
  toDate?: Date | string | null;
  daysHeld?: number | null;
};

export type RfiRegisterDirectoryPerson = {
  id?: number;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
};

export type RfiRegisterWorkbookInput = {
  project: { id: number; name?: string | null; code?: string | null; location?: string | null };
  rfis: RfiRegisterSource[];
  responses: RfiRegisterResponseSource[];
  custody: RfiRegisterCustodySource[];
  directory: RfiRegisterDirectoryPerson[];
  attachmentLabels: Map<string, string>;
  filters: { status: string; search: string };
  generatedAt?: Date;
  generatedBy?: string;
};

export type RfiRegisterFilterResult = {
  selected: RfiRegisterSource[];
  totalCount: number;
  filteredCount: number;
};

export function sanitizeExcelText(value: unknown): string {
  if (value == null) return EMPTY;
  const startsWithFormulaControl = FORMULA_PREFIX.test(String(value));
  let text = String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^(?:undefined|null|\[object Object\])$/i.test(text)) return EMPTY;
  if (PROTECTED_PATTERN.test(text)) text = protectedLabel(text);
  return startsWithFormulaControl || FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function excelOptionalNumber(value: unknown): number | string {
  if (value == null || value === "") return EMPTY;
  if (typeof value === "number") return Number.isFinite(value) ? value : EMPTY;
  const text = String(value).trim();
  if (!text) return EMPTY;
  if (!NUMERIC_PATTERN.test(text)) return sanitizeExcelText(text);
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : sanitizeExcelText(text);
}

function protectedLabel(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || url.hostname);
      return `External reference: ${name}`;
    } catch {
      return "External reference";
    }
  }
  if (/[A-Za-z]:\\/.test(value)) return "File reference";
  if (/\/api\/v1\/projects\/\d+\/files\/\d+/i.test(value)) return "BIMLog file";
  return "Protected value";
}

function dateValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const classified = classifySpreadsheetTemporalText(value);
  if (classified.kind === "date-only") return spreadsheetDateOnlyToUtcDate(classified.value);
  return explicitSpreadsheetInstant(value);
}

function daysBetween(start: Date | string | null | undefined, end: Date | string | null | undefined, generatedAt: Date): number | "" {
  const startDate = dateValue(start);
  if (!startDate) return "";
  const endDate = dateValue(end) || generatedAt;
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function openCustodyAge(row: RfiRegisterCustodySource | null, generatedAt: Date): number | "" {
  return row ? daysBetween(row.fromDate, null, generatedAt) : "";
}

function currentBallInCourtLabel(row: RfiRegisterCustodySource | null): string {
  if (row) return sanitizeExcelText(row.heldByCompany || row.heldBy);
  return "";
}

function humanize(value: unknown): string {
  const text = sanitizeExcelText(value);
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function parseDistribution(entry: string, directory: Map<string, RfiRegisterDirectoryPerson>) {
  const trimmed = String(entry || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("EXT:")) {
    const [rawName = "", rawEmail = "", ...phoneParts] = trimmed.slice(4).split(":");
    const name = sanitizeExcelText(safeDecode(rawName));
    const email = sanitizeExcelText(safeDecode(rawEmail));
    const phone = sanitizeExcelText(safeDecode(phoneParts.join(":")));
    if (!name && !email && !phone) return null;
    return { name, email, phone, company: "", display: [name, email ? `<${email}>` : "", phone].filter(Boolean).join(" | ") };
  }
  const email = trimmed.toLowerCase();
  const match = directory.get(email);
  if (match) {
    const name = sanitizeExcelText(match.name);
    const company = sanitizeExcelText(match.company);
    const phone = sanitizeExcelText(match.phone);
    const display = `${name || match.email}${company ? ` - ${company}` : ""} <${sanitizeExcelText(match.email)}>`;
    return { name, email: sanitizeExcelText(match.email), phone, company, display };
  }
  return { name: "", email: sanitizeExcelText(trimmed), phone: "", company: "", display: sanitizeExcelText(trimmed) };
}

function lifecycle(rfi: RfiRegisterSource): string {
  if (String(rfi.status || "").toLowerCase() === "closed") return "Closed";
  const reopened = dateValue(rfi.reopenedAt);
  const closed = dateValue(rfi.closedAt);
  if (reopened && (!closed || reopened.getTime() > closed.getTime())) return "Reopened";
  if ((rfi.revisionNumber || 0) > 0 || rfi.revisionOf || rfi.parentRfiId) return "Revised";
  if (rfi.sendStatus === "sent" || rfi.sentAt) return "Sent";
  return "Draft";
}

function baseNumber(rfi: RfiRegisterSource): string {
  return sanitizeExcelText(String(rfi.number || "").replace(/\s+R\d+$/i, ""));
}

function publicIdentity(rfi: RfiRegisterSource): string {
  const revision = rfi.revisionNumber && rfi.revisionNumber > 0 ? ` Rev ${rfi.revisionNumber}` : "";
  return `${sanitizeExcelText(rfi.number)}${revision}`;
}

function contactFor(email: string | null | undefined, directory: Map<string, RfiRegisterDirectoryPerson>): RfiRegisterDirectoryPerson | undefined {
  return email ? directory.get(email.toLowerCase()) : undefined;
}

function personForId(id: number | null | undefined, directoryById: Map<number, RfiRegisterDirectoryPerson>): RfiRegisterDirectoryPerson | undefined {
  return id == null ? undefined : directoryById.get(id);
}

function attachmentName(value: string, labels: Map<string, string>): string {
  const label = labels.get(value);
  if (label) return sanitizeExcelText(label);
  if (/^https?:\/\//i.test(value)) return sanitizeExcelText(protectedLabel(value));
  return sanitizeExcelText(value);
}

function splitAttachments(values: string[] | null | undefined, labels: Map<string, string>) {
  const references: string[] = [];
  const files: string[] = [];
  for (const value of values || []) {
    if (/^\/api\/v1\/projects\/\d+\/files\/\d+\/download/i.test(value)) files.push(attachmentName(value, labels));
    else references.push(attachmentName(value, labels));
  }
  return { references, files };
}

function sourceViewpointLabel(rfi: RfiRegisterSource): string {
  if (!rfi.sourceViewpointId) return "";
  return sanitizeExcelText(rfi.sourceViewpointLabel || "Linked viewpoint");
}

function latestResponse(responses: RfiRegisterResponseSource[]): RfiRegisterResponseSource | null {
  return [...responses].sort((a, b) => b.responseNumber - a.responseNumber || (dateValue(b.createdAt)?.getTime() || 0) - (dateValue(a.createdAt)?.getTime() || 0))[0] || null;
}

function currentCustody(rows: RfiRegisterCustodySource[]): RfiRegisterCustodySource | null {
  return rows.find(row => !row.toDate) || null;
}

export function filterRfiRegisterRows(rfis: RfiRegisterSource[], filters: { status: string; search: string }): RfiRegisterFilterResult {
  const search = filters.search.trim().toLowerCase();
  const selected = rfis
    .filter(rfi => filters.status === "all" || rfi.status === filters.status)
    .filter(rfi => {
      if (!search) return true;
      return [
        rfi.number,
        rfi.subject,
        rfi.rfiType,
        rfi.status,
        rfi.priority,
        rfi.submittedByCompany,
        rfi.submittedByContact,
        rfi.submittedByEmail,
        rfi.submittedToCompany,
        rfi.submittedToPerson,
        rfi.submittedToEmail,
        rfi.drawingNumber,
        rfi.drawingTitle,
        rfi.specSection,
        rfi.detailNumber,
        rfi.noteNumber,
        rfi.locationDescription,
        rfi.question,
        rfi.description,
        rfi.answer,
        rfi.response,
      ].some(value => String(value || "").toLowerCase().includes(search));
    })
    .sort((left, right) =>
      (dateValue(left.dateRequested || left.createdAt)?.getTime() || 0) - (dateValue(right.dateRequested || right.createdAt)?.getTime() || 0)
      || left.number.localeCompare(right.number, undefined, { numeric: true, sensitivity: "base" })
      || left.id - right.id);
  return { selected, totalCount: rfis.length, filteredCount: selected.length };
}

type CellValue = string | number | Date | null;

function rowFromObject(headers: string[], values: Record<string, CellValue>): CellValue[] {
  return headers.map(header => values[header] ?? "");
}

function dateCell(value: Date | string | null | undefined): Date | "" {
  return dateValue(value) || "";
}

function applySheetSettings(sheet: XLSX.WorkSheet, headers: string[], rows: CellValue[][], freezeRow = 4): void {
  const rowCount = rows.length + freezeRow;
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: freezeRow - 1, c: 0 }, e: { r: Math.max(freezeRow - 1, rowCount - 1), c: headers.length - 1 } }),
  };
  sheet["!freeze"] = { xSplit: 0, ySplit: freezeRow, topLeftCell: `A${freezeRow + 1}`, activePane: "bottomLeft", state: "frozen" } as unknown as XLSX.WorkSheet["!freeze"];
  sheet["!margins"] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 };
  sheet["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 } as unknown as XLSX.WorkSheet["!pageSetup"];
  sheet["!cols"] = headers.map((header, index) => {
    const max = Math.max(header.length, ...rows.map(row => {
      const value = row[index];
      return value instanceof Date ? 10 : String(value ?? "").length;
    }));
    return { wch: Math.min(Math.max(max + 2, 12), 55) };
  });
}

function setDateFormats(sheet: XLSX.WorkSheet): void {
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address] as XLSX.CellObject;
    if (cell.v instanceof Date) cell.z = address.startsWith("B2") ? TIMESTAMP_FORMAT : DATE_FORMAT;
  }
}

function injectWorksheetXmlSettings(buffer: Buffer): Buffer {
  const archive = new AdmZip(buffer);
  for (const entry of archive.getEntries().filter(item => /^xl\/worksheets\/sheet\d+\.xml$/.test(item.entryName))) {
    let xml = entry.getData().toString("utf8");
    if (!xml.includes("<sheetViews>")) {
      xml = xml.replace(
        /(<dimension[^>]*\/>)/,
        `$1<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>`,
      );
    } else if (!xml.includes("<pane ")) {
      if (/<sheetView\b[^>]*\/>/.test(xml)) {
        xml = xml.replace(
          /<sheetView\b([^>]*)\/>/,
          `<sheetView$1><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView>`,
        );
      } else {
        xml = xml.replace(
          /(<sheetView\b[^>]*>)(<\/sheetView>)/,
          `$1<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/>$2`,
        );
      }
    }
    if (!xml.includes("<pageSetup ")) {
      xml = xml.replace(/(<pageMargins[^>]*\/>)/, `$1<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>`);
    }
    if (!xml.includes("fitToPage=\"1\"")) {
      if (xml.includes("<sheetPr>")) xml = xml.replace("<sheetPr>", `<sheetPr><pageSetUpPr fitToPage="1"/>`);
      else xml = xml.replace(/(<worksheet[^>]*>)/, `$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`);
    }
    archive.updateFile(entry.entryName, Buffer.from(xml, "utf8"));
  }
  return archive.toBuffer();
}

function makeSheet(title: string, projectLabel: string, generatedAt: Date, filterSummary: string, headers: string[], rows: CellValue[][]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["BIMLog by IgniteSmart", projectLabel],
    [title, generatedAt],
    ["Filters", filterSummary],
    headers,
    ...rows,
  ], canonicalSpreadsheetWriteOptions({ cellDates: true }));
  applySheetSettings(sheet, headers, rows);
  setDateFormats(sheet);
  return sheet;
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, canonicalSpreadsheetJsonOptions({ header: 1, raw: true, defval: "" })) as unknown[][];
}

export function inspectRfiRegisterWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, canonicalSpreadsheetReadOptions("rfi-register.xlsx", "buffer", { cellDates: true }));
  return {
    sheetNames: workbook.SheetNames,
    dimensions: Object.fromEntries(workbook.SheetNames.map(name => [name, workbook.Sheets[name]["!ref"] || ""])),
    firstRows: Object.fromEntries(workbook.SheetNames.map(name => [name, sheetRows(workbook, name).slice(0, 6)])),
    autofilters: Object.fromEntries(workbook.SheetNames.map(name => [name, workbook.Sheets[name]["!autofilter"]?.ref || ""])),
    protectedKeyCount: JSON.stringify(workbook).match(new RegExp(["storage", "Path"].join(""), "g"))?.length || 0,
  };
}

export function buildRfiRegisterWorkbook(input: RfiRegisterWorkbookInput): { buffer: Buffer; filename: string; result: RfiRegisterFilterResult } {
  const generatedAt = input.generatedAt || new Date();
  const result = filterRfiRegisterRows(input.rfis, input.filters);
  const rows = result.selected;
  const projectLabel = input.project.name ? `${input.project.name}${input.project.code ? ` (${input.project.code})` : ""}` : `Project ${input.project.id}`;
  const projectCode = sanitizeExcelText(input.project.code || input.project.name || `Project-${input.project.id}`).replace(/[^A-Za-z0-9_.-]+/g, "-");
  const filterSummary = `Status: ${sanitizeExcelText(input.filters.status || "all")} | Search: ${sanitizeExcelText(input.filters.search || "none")} | Matching RFIs: ${result.filteredCount} of ${result.totalCount}`;
  const directory = new Map(input.directory.filter(item => item.email).map(item => [item.email.toLowerCase(), item]));
  const directoryById = new Map(input.directory.filter(item => item.id != null).map(item => [item.id!, item]));
  const responsesByRfi = new Map<number, RfiRegisterResponseSource[]>();
  for (const response of input.responses) {
    responsesByRfi.set(response.rfiId, [...(responsesByRfi.get(response.rfiId) || []), response]);
  }
  const custodyByRfi = new Map<number, RfiRegisterCustodySource[]>();
  for (const row of input.custody) {
    custodyByRfi.set(row.rfiId, [...(custodyByRfi.get(row.rfiId) || []), row]);
  }

  const registerHeaders = [
    "RFI Identity", "Base RFI Number", "Revision", "Subject", "Type", "Status", "Lifecycle State", "Priority",
    "Project Location", "Specific Location", "Drawing Number", "Drawing Title", "Specification Section", "Detail Number", "Note Number",
    "Submitted By Company", "Submitted By Contact", "Submitted By Email", "Submitted By Phone", "Submitted By Address",
    "Submitted To Company", "Submitted To Contact", "Submitted To Email", "Submitted To Phone", "Submitted To Address",
    "Date Requested", "Date Required", "Date Sent", "Date Answered", "Date Closed", "Date Reopened", "Days Outstanding",
    "Current Ball in Court", "Current Holder Person", "Current Holder Company",
    "Question", "Cost Impact", "Cost Amount", "Cost Reason / Explanation", "Schedule Impact", "Calendar Days", "Schedule Reason / Explanation",
    "Manual References", "File Attachments", "Distribution Recipients", "Email Description", "Email Draft",
    "Latest Response Number", "Latest Response Date", "Latest Response By", "Latest Response Company", "Latest Response Text",
    "Send Status", "Send Method", "Source Viewpoint", "Source Viewpoint Label", "Manual Reference Count", "File Attachment Count", "Response Count",
    "Current Custody Start", "Current Custody Age", "Latest Response Cost Impact", "Latest Response Cost Amount", "Latest Response Cost Reason",
    "Latest Response Schedule Impact", "Latest Response Calendar Days", "Latest Response Schedule Reason", "Created By", "Created At", "Updated At",
  ];
  const registerRows = rows.map(rfi => {
    const responses = responsesByRfi.get(rfi.id) || [];
    const custody = custodyByRfi.get(rfi.id) || [];
    const current = currentCustody(custody);
    const latest = latestResponse(responses);
    const submittedTo = contactFor(rfi.submittedToEmail, directory);
    const createdBy = personForId(rfi.createdById, directoryById);
    const evidence = splitAttachments(rfi.attachmentsJson, input.attachmentLabels);
    const distribution = (rfi.distributionList || []).map(entry => parseDistribution(entry, directory)).filter((entry): entry is NonNullable<typeof entry> => !!entry);
    return rowFromObject(registerHeaders, {
      "RFI Identity": publicIdentity(rfi),
      "Base RFI Number": baseNumber(rfi),
      "Revision": rfi.revisionNumber || 0,
      "Subject": sanitizeExcelText(rfi.subject),
      "Type": sanitizeExcelText(rfi.rfiType),
      "Status": humanize(rfi.status),
      "Lifecycle State": lifecycle(rfi),
      "Priority": humanize(rfi.priority),
      "Project Location": sanitizeExcelText(rfi.projectAddress || input.project.location),
      "Specific Location": sanitizeExcelText(rfi.locationDescription),
      "Drawing Number": sanitizeExcelText(rfi.drawingNumber),
      "Drawing Title": sanitizeExcelText(rfi.drawingTitle),
      "Specification Section": sanitizeExcelText(rfi.specSection),
      "Detail Number": sanitizeExcelText(rfi.detailNumber),
      "Note Number": sanitizeExcelText(rfi.noteNumber),
      "Submitted By Company": sanitizeExcelText(rfi.submittedByCompany),
      "Submitted By Contact": sanitizeExcelText(rfi.submittedByContact),
      "Submitted By Email": sanitizeExcelText(rfi.submittedByEmail),
      "Submitted By Phone": sanitizeExcelText(rfi.submittedByPhone),
      "Submitted By Address": sanitizeExcelText(rfi.submittedByAddress),
      "Submitted To Company": sanitizeExcelText(rfi.submittedToCompany),
      "Submitted To Contact": sanitizeExcelText(rfi.submittedToPerson),
      "Submitted To Email": sanitizeExcelText(rfi.submittedToEmail),
      "Submitted To Phone": sanitizeExcelText(submittedTo?.phone),
      "Submitted To Address": sanitizeExcelText(submittedTo?.address),
      "Date Requested": dateCell(rfi.dateRequested || rfi.createdAt),
      "Date Required": dateCell(rfi.dateRequired || rfi.dueDate),
      "Date Sent": dateCell(rfi.sentAt),
      "Date Answered": dateCell(rfi.dateAnswered || rfi.respondedAt),
      "Date Closed": dateCell(rfi.closedAt),
      "Date Reopened": dateCell(rfi.reopenedAt),
      "Days Outstanding": daysBetween(rfi.dateRequested || rfi.createdAt, rfi.dateAnswered || rfi.respondedAt || rfi.closedAt, generatedAt),
      "Current Ball in Court": currentBallInCourtLabel(current),
      "Current Holder Person": sanitizeExcelText(current?.heldBy),
      "Current Holder Company": sanitizeExcelText(current?.heldByCompany),
      "Question": sanitizeExcelText(rfi.question || rfi.description),
      "Cost Impact": sanitizeExcelText(rfi.costImpact),
      "Cost Amount": excelOptionalNumber(rfi.costImpactAmount),
      "Cost Reason / Explanation": sanitizeExcelText(rfi.costImpactReason),
      "Schedule Impact": sanitizeExcelText(rfi.scheduleImpact),
      "Calendar Days": excelOptionalNumber(rfi.scheduleImpactDays),
      "Schedule Reason / Explanation": sanitizeExcelText(rfi.scheduleImpactReason),
      "Manual References": evidence.references.join("; "),
      "File Attachments": evidence.files.join("; "),
      "Distribution Recipients": distribution.map(item => item.display).join("; "),
      "Email Description": sanitizeExcelText(rfi.emailDescription),
      "Email Draft": sanitizeExcelText(rfi.emailDraft),
      "Latest Response Number": latest?.responseNumber ?? "",
      "Latest Response Date": dateCell(latest?.createdAt),
      "Latest Response By": sanitizeExcelText(latest?.answeredBy || rfi.answeredBy),
      "Latest Response Company": sanitizeExcelText(latest?.answeredByCompany),
      "Latest Response Text": sanitizeExcelText(latest?.responseText || rfi.answer || rfi.response),
      "Send Status": humanize(rfi.sendStatus),
      "Send Method": humanize(rfi.sendMethod),
      "Source Viewpoint": rfi.sourceViewpointId ? "Yes" : "No",
      "Source Viewpoint Label": sourceViewpointLabel(rfi),
      "Manual Reference Count": evidence.references.length,
      "File Attachment Count": evidence.files.length,
      "Response Count": responses.length,
      "Current Custody Start": dateCell(current?.fromDate),
      "Current Custody Age": openCustodyAge(current, generatedAt),
      "Latest Response Cost Impact": sanitizeExcelText(latest?.costImpact),
      "Latest Response Cost Amount": excelOptionalNumber(latest?.costImpactAmount),
      "Latest Response Cost Reason": sanitizeExcelText(latest?.costImpactReason),
      "Latest Response Schedule Impact": sanitizeExcelText(latest?.scheduleImpact),
      "Latest Response Calendar Days": excelOptionalNumber(latest?.scheduleImpactDays),
      "Latest Response Schedule Reason": sanitizeExcelText(latest?.scheduleImpactReason),
      "Created By": sanitizeExcelText(createdBy?.name || createdBy?.email),
      "Created At": dateCell(rfi.createdAt),
      "Updated At": dateCell(rfi.updatedAt),
    });
  });

  const responseHeaders = [
    "RFI Identity", "Response Number", "Response Date", "Answered By", "Answered By Email", "Answered By Company",
    "Response Text", "Cost Impact", "Cost Amount", "Cost Reason / Explanation", "Schedule Impact", "Calendar Days",
    "Schedule Reason / Explanation", "Response Attachments", "Conflict of Interest Flag",
  ];
  const selectedIds = new Set(rows.map(rfi => rfi.id));
  const rfiById = new Map(rows.map(rfi => [rfi.id, rfi]));
  const responseRows = input.responses
    .filter(response => selectedIds.has(response.rfiId))
    .sort((left, right) => {
      const leftRfi = rfiById.get(left.rfiId);
      const rightRfi = rfiById.get(right.rfiId);
      return (leftRfi?.number || "").localeCompare(rightRfi?.number || "", undefined, { numeric: true, sensitivity: "base" }) || left.responseNumber - right.responseNumber;
    })
    .map(response => rowFromObject(responseHeaders, {
      "RFI Identity": publicIdentity(rfiById.get(response.rfiId)!),
      "Response Number": response.responseNumber,
      "Response Date": dateCell(response.createdAt),
      "Answered By": sanitizeExcelText(response.answeredBy),
      "Answered By Email": sanitizeExcelText(response.answeredByEmail),
      "Answered By Company": sanitizeExcelText(response.answeredByCompany),
      "Response Text": sanitizeExcelText(response.responseText),
      "Cost Impact": sanitizeExcelText(response.costImpact),
      "Cost Amount": excelOptionalNumber(response.costImpactAmount),
      "Cost Reason / Explanation": sanitizeExcelText(response.costImpactReason),
      "Schedule Impact": sanitizeExcelText(response.scheduleImpact),
      "Calendar Days": excelOptionalNumber(response.scheduleImpactDays),
      "Schedule Reason / Explanation": sanitizeExcelText(response.scheduleImpactReason),
      "Response Attachments": (response.responseAttachmentsJson || []).map(value => attachmentName(value, input.attachmentLabels)).join("; "),
      "Conflict of Interest Flag": response.isConflictOfInterest ? "Yes" : "No",
    }));

  const custodyHeaders = ["RFI Identity", "From Party", "To Party / Holder", "Holder Company", "From Date", "To Date", "Days Held", "Current", "Transition Reason"];
  const custodyRows = input.custody
    .filter(row => selectedIds.has(row.rfiId))
    .sort((left, right) => (rfiById.get(left.rfiId)?.number || "").localeCompare(rfiById.get(right.rfiId)?.number || "", undefined, { numeric: true, sensitivity: "base" }) || (dateValue(left.fromDate)?.getTime() || 0) - (dateValue(right.fromDate)?.getTime() || 0))
    .map((row, index, list) => {
      const prior = [...list].slice(0, index).reverse().find(item => item.rfiId === row.rfiId);
      return rowFromObject(custodyHeaders, {
        "RFI Identity": publicIdentity(rfiById.get(row.rfiId)!),
        "From Party": sanitizeExcelText(prior?.heldByCompany || prior?.heldBy),
        "To Party / Holder": sanitizeExcelText(row.heldBy),
        "Holder Company": sanitizeExcelText(row.heldByCompany),
        "From Date": dateCell(row.fromDate),
        "To Date": dateCell(row.toDate),
        "Days Held": row.daysHeld ?? "",
        "Current": row.toDate ? "No" : "Yes",
        "Transition Reason": row.toDate ? "Custody changed or RFI closed" : "Current ball-in-court",
      });
    });

  const exportInfoHeaders = ["Field", "Value"];
  const exportInfoRows = [
    ["Export", "RFI Register Excel"],
    ["Project", projectLabel],
    ["Generated At", generatedAt],
    ["Generated By", sanitizeExcelText(input.generatedBy || "BIMLog user")],
    ["Status Filter", sanitizeExcelText(input.filters.status || "all")],
    ["Search Filter", sanitizeExcelText(input.filters.search || "")],
    ["Matching RFIs", result.filteredCount],
    ["Total RFIs In Project", result.totalCount],
    ["Sheet Order", "RFI Register; Responses; Ball-in-Court History; Export Information"],
    ["Security", "No storage paths, filesystem paths, signed provider URLs, credentials, or raw API download locators are exported."],
    ["Sanitation", "Text beginning with formula-control characters is prefixed with an apostrophe."],
  ] as CellValue[][];

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "RFI Register Excel",
    Subject: "BIMLog professional RFI register",
    Author: "BIMLog by IgniteSmart",
    Company: "IgniteSmart",
    CreatedDate: generatedAt,
  };
  XLSX.utils.book_append_sheet(workbook, makeSheet("RFI Register", projectLabel, generatedAt, filterSummary, registerHeaders, registerRows), "RFI Register");
  XLSX.utils.book_append_sheet(workbook, makeSheet("Responses", projectLabel, generatedAt, filterSummary, responseHeaders, responseRows), "Responses");
  XLSX.utils.book_append_sheet(workbook, makeSheet("Ball-in-Court History", projectLabel, generatedAt, filterSummary, custodyHeaders, custodyRows), "Ball-in-Court History");
  XLSX.utils.book_append_sheet(workbook, makeSheet("Export Information", projectLabel, generatedAt, filterSummary, exportInfoHeaders, exportInfoRows), "Export Information");
  workbook.Workbook = { Views: [{ RTL: false }], Sheets: workbook.SheetNames.map((_name, index) => ({ Hidden: 0, name: workbook.SheetNames[index], sheetId: index + 1, id: `rId${index + 1}` })) };

  const buffer = injectWorksheetXmlSettings(XLSX.write(workbook, canonicalSpreadsheetWriteOptions({ type: "buffer", bookType: "xlsx", cellDates: true })));
  return {
    buffer,
    filename: `${projectCode}-RFI-Register.xlsx`,
    result,
  };
}

export function getRfiRegisterExportProof() {
  const generatedAt = new Date("2026-07-15T12:00:00.000Z");
  const rfis: RfiRegisterSource[] = [
    {
      id: 1, projectId: 10, number: "RFI-001", subject: "=Formula guard", rfiType: "Coordination", status: "open", priority: "high",
      createdById: 1, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z",
      submittedByCompany: "Builder", submittedByContact: "A User", submittedByEmail: "asker@example.com",
      submittedToCompany: "Engineer", submittedToPerson: "E User", submittedToEmail: "answer@example.com",
      dateRequested: "2026-07-01T00:00:00.000Z", dateRequired: "2026-07-20T00:00:00.000Z",
      question: "+Needs decision", costImpact: "Cost Increase Known", costImpactAmount: "-1250", costImpactReason: "@Allowance change",
      scheduleImpact: "Increase in Calendar Days", scheduleImpactDays: 5, scheduleImpactReason: "\tLead time",
      distributionList: ["EXT:Legacy:legacy@example.com:", "EXT:Encoded:name%40company.com:"],
      attachmentsJson: ["/api/v1/projects/10/files/50/download", "https://example.com/docs/detail.pdf"],
    },
    {
      id: 2, projectId: 10, number: "RFI-002", subject: "Closed record", status: "closed", priority: "medium",
      createdById: 1, createdAt: "2026-07-03T00:00:00.000Z", updatedAt: "2026-07-04T00:00:00.000Z", closedAt: "2026-07-05T00:00:00.000Z",
    },
  ];
  const output = buildRfiRegisterWorkbook({
    project: { id: 10, name: "Proof Project", code: "PP" },
    rfis,
    responses: [{ id: 7, rfiId: 1, projectId: 10, responseNumber: 1, responseText: "Use detail B", answeredBy: "Engineer", createdAt: "2026-07-04T00:00:00.000Z" }],
    custody: [{ id: 3, rfiId: 1, heldBy: "Engineer", heldByCompany: "Engineer Co", fromDate: "2026-07-02T00:00:00.000Z", toDate: null, daysHeld: null }],
    directory: [{ name: "Answer Contact", email: "answer@example.com", phone: "555-0100", company: "Engineer", address: "100 Main" }],
    attachmentLabels: new Map([["/api/v1/projects/10/files/50/download", "safe-file.pdf"]]),
    filters: { status: "open", search: "formula" },
    generatedAt,
    generatedBy: "Proof User",
  });
  const inspection = inspectRfiRegisterWorkbook(output.buffer);
  return {
    filename: output.filename,
    filteredCount: output.result.filteredCount,
    totalCount: output.result.totalCount,
    sheetNames: inspection.sheetNames,
    autofilters: inspection.autofilters,
    protectedKeyCount: inspection.protectedKeyCount,
    formulaSanitizedValues: {
      subject: sanitizeExcelText("=Formula guard"),
      question: sanitizeExcelText("+Needs decision"),
      costAmount: excelOptionalNumber("-1250"),
      costReason: sanitizeExcelText("@Allowance change"),
      scheduleReason: sanitizeExcelText("\tLead time"),
    },
  };
}
