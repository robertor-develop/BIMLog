import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rfisTable, usersTable, activityLogTable, projectsTable, namingConventionsTable, namingFieldsTable, filesTable, rfiViewEventsTable, rfiResponsesTable, projectMembersTable, linkedItemsTable, agentInsightsTable, rfiBallInCourtHistoryTable, lensViewpointsTable, userConnectionsTable, emailLogTable } from "@workspace/db/schema";
import { getNextAvailableNumber } from "../lib/import-intelligence";
import { storage } from "../lib/storage-adapter";
import { eq, and, count, max, isNull, or, ne } from "drizzle-orm";
import { CreateRfiBody, ListRfisParams, UpdateRfiParams, UpdateRfiBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue, getDefaultValue, getConfigOptionMeta } from "../middlewares/config-validator";
import multer from "multer";
import { createPdfDocument } from "../lib/pdf-kit";
import * as XLSX from "xlsx";
import { extractFileText } from "../lib/extract-file-text";
import { getValidAccessToken, providerFromParam } from "../lib/oauth";
import { downloadCloud } from "../lib/cloud-files";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";
import { Document, Paragraph, TextRun, SymbolRun, Table, TableRow, TableCell, Packer, WidthType, BorderStyle, HeadingLevel, AlignmentType, ShadingType } from "docx";
const router: IRouter = Router();

function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

// ─── Shared markdown stripper ─────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\[(?:Current Date|RFI Number|Project|Date|Number)\]/gi, "")
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .trim();
}

function attachmentLabel(value: string): string {
  const nameMatch = value.match(/[?&]name=([^&]+)/);
  if (nameMatch) {
    try { return decodeURIComponent(nameMatch[1]); } catch { return nameMatch[1]; }
  }
  try {
    if (/^https?:\/\//i.test(value) || value.startsWith("/api/")) {
      const url = new URL(value, "https://bimlog.local");
      const last = url.pathname.split("/").filter(Boolean).pop();
      return last ? decodeURIComponent(last) : value;
    }
  } catch {
    return value;
  }
  return value;
}

// PDF checkbox characters: unchecked (\u2610), checked (\u2611)
// PDFKit built-in fonts lack these glyphs; boxes are drawn manually below.
const UNCHECKED_BOX = "\u2610";
const CHECKED_BOX   = "\u2611";

function rfiToJson(r: typeof rfisTable.$inferSelect, extras: Record<string, unknown> = {}) {
  return {
    ...r,
    ...extras,
    dueDate: r.dueDate?.toISOString(),
    respondedAt: r.respondedAt?.toISOString(),
    dateRequested: r.dateRequested?.toISOString(),
    dateRequired: r.dateRequired?.toISOString(),
    dateAnswered: r.dateAnswered?.toISOString(),
    sentAt: r.sentAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Shared RFI creation ─────────────────────────────────────────────────────
// Single real implementation used by both POST .../rfis and POST .../rfis/from-viewpoint.
// Validates priority, generates/deduplicates the RFI number, inserts the row, and
// writes the activity-log entry. Returns a discriminated result the route maps to HTTP.
type CreateRfiInput = {
  subject: string;
  rfiType?: string | null;
  priority: string;
  description?: string | null;
  assignedToId?: number | null;
  dueDate?: string | null;
  dateRequested?: string | null;
  dateRequired?: string | null;
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
  question?: string | null;
  costImpact?: string | null;
  costImpactAmount?: string | null;
  scheduleImpact?: string | null;
  scheduleImpactDays?: number | null;
  distributionList?: string[] | null;
  attachmentsJson?: string[] | null;
  projectAddress?: string | null;
  number?: string;
  forceNumber?: boolean;
  sourceViewpointId?: string | null;
};

type CreateRfiResult =
  | { ok: true; rfi: typeof rfisTable.$inferSelect }
  | { ok: false; status: number; payload: Record<string, unknown> };

async function createRfiForProject(
  projectId: number,
  input: CreateRfiInput,
  user: { userId: number; fullName: string; companyName: string },
  dbx: Pick<typeof db, "insert"> = db,
): Promise<CreateRfiResult> {
  if (input.priority && !(await validateConfigValue("rfi_priority", input.priority))) {
    return { ok: false, status: 422, payload: { error: `Invalid priority value: ${input.priority}` } };
  }

  const [rfiCount] = await db.select({ count: count() }).from(rfisTable).where(eq(rfisTable.projectId, projectId));
  const proposedNumber = input.number || `RFI-${String((rfiCount.count as number) + 1).padStart(4, "0")}`;
  const { isDuplicate, suggestedNumber } = await getNextAvailableNumber(projectId, "rfi", proposedNumber);
  if (isDuplicate && !input.forceNumber) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "duplicate_number",
        message: `An RFI with number ${proposedNumber} already exists.`,
        suggestedNumber,
        canForce: true,
      },
    };
  }
  const number = isDuplicate ? suggestedNumber : proposedNumber;

  const defaultRfiStatus = await getDefaultValue("rfi_status");
  const [rfi] = await dbx.insert(rfisTable).values({
    projectId,
    number,
    subject: input.subject,
    rfiType: input.rfiType || null,
    description: input.description || null,
    status: defaultRfiStatus,
    priority: input.priority,
    assignedToId: input.assignedToId || null,
    createdById: user.userId,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    dateRequested: input.dateRequested ? new Date(input.dateRequested) : new Date(),
    dateRequired: input.dateRequired ? new Date(input.dateRequired) : null,
    submittedByCompany: input.submittedByCompany || null,
    submittedByContact: input.submittedByContact || null,
    submittedByAddress: input.submittedByAddress || null,
    submittedByPhone: input.submittedByPhone || null,
    submittedByEmail: input.submittedByEmail || null,
    submittedToCompany: input.submittedToCompany || null,
    submittedToPerson: input.submittedToPerson || null,
    submittedToEmail: input.submittedToEmail || null,
    drawingNumber: input.drawingNumber || null,
    drawingTitle: input.drawingTitle || null,
    specSection: input.specSection || null,
    detailNumber: input.detailNumber || null,
    noteNumber: input.noteNumber || null,
    locationDescription: input.locationDescription || null,
    question: input.question || null,
    costImpact: input.costImpact || null,
    costImpactAmount: input.costImpactAmount || null,
    scheduleImpact: input.scheduleImpact || null,
    scheduleImpactDays: input.scheduleImpactDays || null,
    distributionList: input.distributionList || [],
    attachmentsJson: input.attachmentsJson || [],
    projectAddress: input.projectAddress || null,
    sourceViewpointId: input.sourceViewpointId || null,
    revisionNumber: 0,
  }).returning();

  await dbx.insert(activityLogTable).values({
    projectId,
    userId: user.userId,
    userFullName: user.fullName,
    userCompanyName: user.companyName,
    actionType: "create",
    entityType: "rfi",
    entityId: rfi.id,
    details: `Created RFI ${number}: ${input.subject}`,
  });

  return { ok: true, rfi };
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────
const LETTER_HEIGHT = 792;
const LETTER_WIDTH = 612;
const MARGIN = 50;
const CONTENT_BOTTOM = LETTER_HEIGHT - 65;
const COL_W = 256;

// Draw a footer safely — temporarily removes bottom margin so PDFKit doesn't auto-page-break
function drawFooter(doc: PDFKit.PDFDocument, text: string) {
  const origBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(7).fillColor("#94A3B8").font("Helvetica")
    .text(text, MARGIN, LETTER_HEIGHT - 30, { width: LETTER_WIDTH - MARGIN * 2, align: "center", lineBreak: false });
  doc.page.margins.bottom = origBottom;
}

function makeRfiPdf(
  doc: PDFKit.PDFDocument,
  rfi: typeof rfisTable.$inferSelect,
  responses: (typeof rfiResponsesTable.$inferSelect)[],
  project: { name: string } | undefined,
): void {
  const fmtD = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

  const contentW = LETTER_WIDTH - MARGIN * 2; // 512
  const colW     = contentW / 2;              // 256
  doc.page.margins.bottom = 0;
  let y = MARGIN;
  let pageNum = 1;

  const checkPage = (needed: number) => {
    if (y + needed > CONTENT_BOTTOM) {
      drawFooter(doc, `BIMLog by IgniteSmart  |  ${rfi.number}  |  ${project?.name || ""}  |  Page ${pageNum}`);
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = MARGIN;
      pageNum++;
    }
  };

  // Draw a checkbox manually (UNCHECKED_BOX \u2610, CHECKED_BOX \u2611 referenced above)
  const drawCheckbox = (bx: number, by: number, checked: boolean) => {
    // Use UNCHECKED_BOX / CHECKED_BOX unicode refs for semantics; render via PDFKit primitives
    const _ref = checked ? CHECKED_BOX : UNCHECKED_BOX; void _ref;
    doc.rect(bx, by, 8, 8).lineWidth(0.8).stroke("#374151").lineWidth(1);
    if (checked) {
      doc.moveTo(bx + 1.5, by + 4.5).lineTo(bx + 3.5, by + 7).lineTo(bx + 7.5, by + 1.5)
        .lineWidth(1.5).strokeColor("#1D4ED8").stroke().strokeColor("black").lineWidth(1);
    }
  };

  // ── Section 1: Navy header bar ──────────────────────────────────────────────
  doc.rect(MARGIN, y, contentW, 38).fill("#1E3A5F");
  doc.fillColor("white").fontSize(14).font("Helvetica-Bold")
    .text("REQUEST FOR INFORMATION", MARGIN + 10, y + 12, { lineBreak: false });
  doc.fontSize(14).font("Helvetica-Bold")
    .text(rfi.number, MARGIN + 10, y + 12, { width: contentW - 20, align: "right", lineBreak: false });
  doc.fillColor("black");
  y += 42;

  // ── Section 2: Two-column info grid ─────────────────────────────────────────
  const infoFields: [string, string][] = [
    ["Project",        project?.name || "—"],
    ["Status",         (rfi.status || "—").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())],
    ["Priority",       rfi.priority || "—"],
    ["Date Requested", fmtD(rfi.dateRequested || rfi.createdAt)],
    ["Date Required",  fmtD(rfi.dateRequired || rfi.dueDate)],
    ["Submitted By",   `${rfi.submittedByCompany || "—"} / ${rfi.submittedByContact || "—"}`],
    ["Submitted To",   `${rfi.submittedToCompany || "—"} / ${rfi.submittedToPerson || "—"}`],
    ["Drawing Number", rfi.drawingNumber || "—"],
    ["Spec Section",   rfi.specSection || "—"],
    ["Source Viewpoint", (rfi as { sourceViewpointId?: string | null }).sourceViewpointId || "—"],
  ];
  const numRows = Math.ceil(infoFields.length / 2);
  const gridH   = numRows * 28;
  checkPage(gridH + 10);
  doc.rect(MARGIN, y, contentW, gridH).stroke("#CBD5E1");
  infoFields.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx  = col === 0 ? MARGIN : MARGIN + colW;
    const fy  = y + row * 28;
    doc.fontSize(7).fillColor("#94A3B8").font("Helvetica-Bold")
      .text(label.toUpperCase(), fx + 8, fy + 5, { width: colW - 16, lineBreak: false });
    doc.fontSize(9.5).fillColor("#1E293B").font("Helvetica")
      .text(value, fx + 8, fy + 15, { width: colW - 16, lineBreak: false });
    if (col === 0 && i + 1 < infoFields.length)
      doc.moveTo(MARGIN + colW, fy).lineTo(MARGIN + colW, fy + 28).stroke("#E2E8F0");
    if (row < numRows - 1 && col === 1)
      doc.moveTo(MARGIN, fy + 28).lineTo(MARGIN + contentW, fy + 28).stroke("#E2E8F0");
  });
  y += gridH + 8;

  // ── Section 3: Description of Question ──────────────────────────────────────
  const questionText = stripMarkdown(rfi.question || rfi.description || "No question text provided.");
  const qH = Math.max(doc.heightOfString(questionText, { width: contentW - 16 }) + 14, 42);
  checkPage(22 + qH);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("DESCRIPTION OF QUESTION", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  doc.rect(MARGIN, y, contentW, qH).stroke("#E2E8F0");
  doc.fillColor("#1E293B").fontSize(9.5).font("Helvetica")
    .text(questionText, MARGIN + 8, y + 7, { width: contentW - 16 });
  y += qH + 8;

  // ── Section 4: Responses ────────────────────────────────────────────────────
  if (responses.length > 0) {
    for (const resp of responses) {
      const respNum    = resp.responseNumber ?? 1;
      const respAuthor = resp.answeredBy || "—";
      const respDate   = fmtD(resp.createdAt);
      const respText   = stripMarkdown(resp.responseText || "(No response text)");
      const respH      = Math.max(doc.heightOfString(respText, { width: contentW - 16 }) + 14, 40);
      checkPage(26 + respH);
      doc.rect(MARGIN, y, contentW, 18).fill("#EFF6FF");
      doc.fillColor("#1E3A5F").fontSize(8.5).font("Helvetica-Bold")
        .text(`Response ${respNum}  |  Author: ${respAuthor}  |  Date: ${respDate}`,
          MARGIN + 8, y + 5, { width: contentW - 16, lineBreak: false });
      y += 18;
      doc.rect(MARGIN, y, contentW, respH).stroke("#BFDBFE");
      doc.fillColor("#1E293B").fontSize(9.5).font("Helvetica")
        .text(respText, MARGIN + 8, y + 7, { width: contentW - 16 });
      y += respH + 8;
    }
  } else {
    checkPage(80);
    doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
    doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
      .text("OFFICIAL RESPONSE", MARGIN + 8, y + 5, { lineBreak: false });
    y += 16;
    doc.rect(MARGIN, y, contentW, 64).stroke("#E2E8F0");
    y += 72;
  }

  // ── Section 5: Cost Impact (actual value from the RFI) ──────────────────────
  checkPage(46);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("COST IMPACT", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  const costLine = [rfi.costImpact || "—", rfi.costImpactAmount ? `(${rfi.costImpactAmount})` : ""].filter(Boolean).join("   ");
  const costH = Math.max(doc.heightOfString(costLine, { width: contentW - 16 }) + 12, 26);
  doc.rect(MARGIN, y, contentW, costH).stroke("#E2E8F0");
  doc.fillColor("#1E293B").fontSize(9.5).font("Helvetica").text(costLine, MARGIN + 8, y + 6, { width: contentW - 16 });
  y += costH + 6;

  // ── Section 6: Schedule Impact (actual value from the RFI) ──────────────────
  checkPage(46);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("SCHEDULE IMPACT", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  const schedLine = [rfi.scheduleImpact || "—", rfi.scheduleImpactDays != null ? `(${rfi.scheduleImpactDays} days)` : ""].filter(Boolean).join("   ");
  const schedH = Math.max(doc.heightOfString(schedLine, { width: contentW - 16 }) + 12, 26);
  doc.rect(MARGIN, y, contentW, schedH).stroke("#E2E8F0");
  doc.fillColor("#1E293B").fontSize(9.5).font("Helvetica").text(schedLine, MARGIN + 8, y + 6, { width: contentW - 16 });
  y += schedH + 6;

  // ── Section 7: Attachments / references (actual list from the RFI) ──────────
  const attList = (rfi.attachmentsJson as unknown as string[] | null) || [];
  const attLines = attList.length > 0 ? attList.map(attachmentLabel) : ["None"];
  checkPage(20 + attLines.length * 14);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("ATTACHMENTS / REFERENCES", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  for (const a of attLines) {
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(`•  ${a}`, MARGIN + 8, y + 2, { width: contentW - 16, lineBreak: false });
    y += 14;
  }
  y += 4;

  // ── Section 8: Authorized By signature ─────────────────────────────────────
  checkPage(100);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("AUTHORIZED BY", MARGIN + 8, y + 5, { lineBreak: false });
  y += 20;
  for (const lbl of ["Name", "Title", "Company", "Date"]) {
    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica-Bold")
      .text(lbl.toUpperCase(), MARGIN + 8, y + 4, { lineBreak: false });
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica")
      .text("______________________________________________", MARGIN + 62, y + 4, { lineBreak: false });
    y += 18;
  }

  drawFooter(doc, `BIMLog by IgniteSmart  |  ${rfi.number}  |  ${project?.name || ""}  |  Page ${pageNum}`);
}

// ─── RFI Log PDF (summary table, landscape) ──────────────────────────────────
const LOG_W = 792;   // landscape width
const LOG_H = 612;   // landscape height
const LOG_MARGIN = 36;
const LOG_CONTENT_W = LOG_W - LOG_MARGIN * 2;
const LOG_CONTENT_BOTTOM = LOG_H - 50;

// ─── Shared log column definitions (header + getter, no hardcoded widths) ─────
function buildLogColDefs(
  fmtD: (d: Date | string | null | undefined) => string,
  getBic: (r: typeof rfisTable.$inferSelect) => string,
  creatorMap: Map<number, string>,
): [string, (r: typeof rfisTable.$inferSelect) => string][] {
  return [
    ["RFI Number",       r => r.number],
    ["Subject",          r => r.subject],
    ["Status",           r => (r.status || "").replace("_", " ")],
    ["Priority",         r => r.priority || "—"],
    ["Submitted By",     r => r.submittedByCompany || creatorMap.get(r.createdById) || "—"],
    ["Submitted To",     r => r.submittedToCompany || r.submittedToPerson || "—"],
    ["Date Requested",   r => fmtD(r.dateRequested || r.createdAt)],
    ["Date Required",    r => fmtD(r.dateRequired || r.dueDate)],
    ["Days Outstanding", r => String(daysSince(r.createdAt))],
    ["Ball In Court",    r => getBic(r)],
    ["Schedule Impact",  r => r.scheduleImpact || "—"],
  ];
}

// ─── Measure natural column widths via PDFKit widthOfString at font size 8 ────
function measureColWidths(
  measDoc: PDFKit.PDFDocument,
  colDefs: [string, (r: typeof rfisTable.$inferSelect) => string][],
  rfis: (typeof rfisTable.$inferSelect)[],
  pad = 12,
): number[] {
  return colDefs.map(([header, getter]) => {
    measDoc.font("Helvetica-Bold").fontSize(8);
    let maxWidth = measDoc.widthOfString(header.toUpperCase());
    measDoc.font("Helvetica").fontSize(8);
    for (const rfi of rfis) {
      const w = measDoc.widthOfString(getter(rfi));
      if (w > maxWidth) maxWidth = w;
    }
    return maxWidth + pad;
  });
}

function _makeRfiLogPdf_REMOVED(
  doc: PDFKit.PDFDocument,
  rfis: (typeof rfisTable.$inferSelect)[],
  project: { name: string } | undefined,
  creatorMap: Map<number, string>,
) {
  const fmtD = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "—";

  const getBic = (rfi: typeof rfisTable.$inferSelect) => {
    if (rfi.status === "closed") return "Closed";
    if (rfi.status === "responded") return rfi.submittedByCompany || creatorMap.get(rfi.createdById) || "Submitter";
    return rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer";
  };

  const colDefs = buildLogColDefs(fmtD, getBic, creatorMap);

  // ── Dynamic width calculation — no hardcoded values ──────────────────────────
  const naturalWidths = measureColWidths(doc, colDefs, rfis);
  const totalNatural  = naturalWidths.reduce((s, w) => s + w, 0);
  // Scale proportionally so all columns fit within LOG_CONTENT_W = 720
  const scaleFactor   = totalNatural > LOG_CONTENT_W ? LOG_CONTENT_W / totalNatural : 1;
  const colWidths     = naturalWidths.map(w => Math.floor(w * scaleFactor));

  // Build final cols: [header, computedWidth, getter]
  const cols = colDefs.map(([header, getter], i) =>
    [header, colWidths[i], getter] as [string, number, (r: typeof rfisTable.$inferSelect) => string],
  );

  let y = LOG_MARGIN;

  const drawLogFooter = (pageNum: number) => {
    const origBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(6).fillColor("#94A3B8").font("Helvetica")
      .text(
        `BIMLog by IgniteSmart  |  RFI Log${project ? `: ${project.name}` : ""}  |  ${new Date().toLocaleDateString()}  |  Page ${pageNum}`,
        LOG_MARGIN, LOG_H - 22, { width: LOG_CONTENT_W, align: "center", lineBreak: false },
      );
    doc.page.margins.bottom = origBottom;
  };

  // Title block
  doc.rect(LOG_MARGIN, y, LOG_CONTENT_W, 32).fill("#1E3A5F");
  doc.fillColor("white").fontSize(14).font("Helvetica-Bold")
    .text("RFI LOG", LOG_MARGIN + 10, y + 8);
  doc.fontSize(9).font("Helvetica")
    .text(project?.name || "—", LOG_MARGIN + 80, y + 10);
  doc.fontSize(7)
    .text(`Exported: ${new Date().toLocaleDateString()}  |  ${rfis.length} RFIs`, LOG_MARGIN + 80, y + 21);
  doc.fillColor("black");
  y += 36;

  const drawHeader = (atY: number) => {
    doc.rect(LOG_MARGIN, atY, LOG_CONTENT_W, 16).fill("#334155");
    let cx = LOG_MARGIN;
    cols.forEach(([header, colW]) => {
      doc.fontSize(6).fillColor("white").font("Helvetica-Bold")
        .text(header.toUpperCase(), cx + 3, atY + 5, { width: colW - 4, lineBreak: false, ellipsis: true });
      cx += colW;
    });
    return atY + 16;
  };

  y = drawHeader(y);

  let pageNum = 1;
  let rowIndex = 0;

  for (const rfi of rfis) {
    const rowH = 18;

    if (y + rowH > LOG_CONTENT_BOTTOM) {
      drawLogFooter(pageNum);
      pageNum++;
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = LOG_MARGIN;
      y = drawHeader(y);
    }

    const isEven = rowIndex % 2 === 0;
    doc.rect(LOG_MARGIN, y, LOG_CONTENT_W, rowH).fill(isEven ? "#F8FAFC" : "white");

    let cx = LOG_MARGIN;
    cols.forEach(([, colW, getter], ci) => {
      const cellText = getter(rfi);
      const textColor = ci === 0 ? "#1D4ED8" : ci === 2
        ? (rfi.status === "closed" ? "#16A34A" : rfi.status === "responded" ? "#7C3AED" : "#D97706")
        : "#1E293B";

      doc.fontSize(8).fillColor(textColor).font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
        .text(cellText, cx + 3, y + 4, { width: colW - 6, lineBreak: false, ellipsis: true });

      doc.moveTo(cx + colW, y).lineTo(cx + colW, y + rowH).stroke("#E2E8F0");
      cx += colW;
    });

    doc.moveTo(LOG_MARGIN, y + rowH).lineTo(LOG_MARGIN + LOG_CONTENT_W, y + rowH).stroke("#E2E8F0");
    doc.moveTo(LOG_MARGIN, y).lineTo(LOG_MARGIN, y + rowH).stroke("#E2E8F0");

    y += rowH;
    rowIndex++;
  }

  drawLogFooter(pageNum);
}

// ─── Word log export — dynamic DXA widths from PDFKit measurements ─────────────
function makeRfiLogWord(
  rfis: (typeof rfisTable.$inferSelect)[],
  project: { name: string } | undefined,
  creatorMap: Map<number, string>,
): Document {
  const fmtD = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "—";

  const getBic = (rfi: typeof rfisTable.$inferSelect) => {
    if (rfi.status === "closed") return "Closed";
    if (rfi.status === "responded") return rfi.submittedByCompany || creatorMap.get(rfi.createdById) || "Submitter";
    return rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer";
  };

  const colDefs = buildLogColDefs(fmtD, getBic, creatorMap);

  // Measure natural widths using a temporary PDFKit doc (same font size 8 approach)
  const measDoc = createPdfDocument({ autoFirstPage: false });
  const naturalWidths = measureColWidths(measDoc, colDefs, rfis);
  const totalNatural  = naturalWidths.reduce((s, w) => s + w, 0);
  // Scale proportionally to fit LOG_CONTENT_W = 720 pt
  const scaleFactor   = totalNatural > LOG_CONTENT_W ? LOG_CONTENT_W / totalNatural : 1;
  // Convert from points to DXA by multiplying by 15
  const WORD_TABLE_W  = 10368; // landscape Letter minus margins in DXA
  const colDxa        = naturalWidths.map(w => Math.round(w * scaleFactor * 15));

  const headerRow = new TableRow({
    tableHeader: true,
    children: colDefs.map(([header], i) => new TableCell({
      width: { size: colDxa[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: "1E3A5F" },
      children: [new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: header.toUpperCase(), bold: true, size: 14, color: "FFFFFF" })],
      })],
    })),
  });

  const dataRows = rfis.map((rfi, rowIdx) => new TableRow({
    children: colDefs.map(([, getter], i) => {
      const ci = i;
      const val = getter(rfi);
      const color = ci === 0 ? "2563EB"
        : ci === 2 ? (rfi.status === "closed" ? "16A34A" : rfi.status === "responded" ? "7C3AED" : "D97706")
        : "1E293B";
      return new TableCell({
        width: { size: colDxa[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: rowIdx % 2 === 0 ? "F8FAFC" : "FFFFFF" },
        children: [new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: val, size: 16, color, bold: ci === 0 })],
        })],
      });
    }),
  }));

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 15840, height: 12240 }, // landscape Letter: 11" × 8.5" in DXA
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: `RFI Log${project ? ` — ${project.name}` : ""}`, bold: true, size: 28, color: "1E3A5F" })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: `Exported: ${new Date().toLocaleDateString()}  |  ${rfis.length} RFIs`, size: 16, color: "94A3B8" })],
        }),
        new Table({
          width: { size: WORD_TABLE_W, type: WidthType.DXA },
          rows: [headerRow, ...dataRows],
        }),
      ],
    }],
  });
}

// ─── List-view PDF (portrait, 6-column summary) ───────────────────────────────
function makeRfiListPdf(
  doc: PDFKit.PDFDocument,
  rfis: (typeof rfisTable.$inferSelect)[],
  project: { name: string } | undefined,
  creatorMap: Map<number, string>,
) {
  const fmtD = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "—";

  const getBic = (rfi: typeof rfisTable.$inferSelect) => {
    if (rfi.status === "closed") return "Closed";
    if (rfi.status === "responded") return rfi.submittedByCompany || creatorMap.get(rfi.createdById) || "Submitter";
    return rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer";
  };

  // Portrait LETTER: content width = 612 - 100 = 512
  const cols: [string, number, (r: typeof rfisTable.$inferSelect) => string][] = [
    ["RFI #",        55,  r => r.number],
    ["Subject",      175, r => r.subject],
    ["Status",       65,  r => (r.status || "").replace("_", " ")],
    ["Priority",     50,  r => r.priority || "—"],
    ["Ball in Court",115, r => getBic(r)],
    ["Days Out",     52,  r => String(daysSince(r.createdAt))],
  ]; // total = 512

  let y = MARGIN;

  doc.rect(MARGIN, y, LETTER_WIDTH - MARGIN * 2, 32).fill("#1E3A5F");
  doc.fillColor("white").fontSize(14).font("Helvetica-Bold").text("RFI SUMMARY", MARGIN + 10, y + 8);
  doc.fontSize(9).font("Helvetica").text(project?.name || "—", MARGIN + 110, y + 10);
  doc.fontSize(7).text(`Exported: ${new Date().toLocaleDateString()}  |  ${rfis.length} RFIs`, MARGIN + 110, y + 21);
  doc.fillColor("black");
  y += 36;

  const drawHeader = (atY: number) => {
    doc.rect(MARGIN, atY, LETTER_WIDTH - MARGIN * 2, 16).fill("#334155");
    let cx = MARGIN;
    cols.forEach(([header, colW]) => {
      doc.fontSize(6).fillColor("white").font("Helvetica-Bold")
        .text(header.toUpperCase(), cx + 3, atY + 5, { width: colW - 4, lineBreak: false });
      cx += colW;
    });
    return atY + 16;
  };

  y = drawHeader(y);
  let pageNum = 1;
  let rowIndex = 0;

  for (const rfi of rfis) {
    const subjectH = Math.min(doc.heightOfString(rfi.subject, { width: 169 }), 30);
    const rowH = Math.max(subjectH + 8, 18);

    if (y + rowH > CONTENT_BOTTOM) {
      drawFooter(doc, `BIMLog by IgniteSmart  |  RFI Summary${project ? `: ${project.name}` : ""}  |  ${new Date().toLocaleDateString()}  |  Page ${pageNum}`);
      pageNum++;
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = MARGIN;
      y = drawHeader(y);
    }

    const isEven = rowIndex % 2 === 0;
    const contentW = LETTER_WIDTH - MARGIN * 2;
    doc.rect(MARGIN, y, contentW, rowH).fill(isEven ? "#F8FAFC" : "white");

    let cx = MARGIN;
    cols.forEach(([, colW, getter], ci) => {
      const cellText = getter(rfi);
      const textColor = ci === 0 ? "#1D4ED8" : ci === 2
        ? (rfi.status === "closed" ? "#16A34A" : rfi.status === "responded" ? "#7C3AED" : "#D97706")
        : "#1E293B";
      doc.fontSize(8).fillColor(textColor).font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
        .text(cellText, cx + 3, y + 4, { width: colW - 6, lineBreak: false });
      doc.moveTo(cx + colW, y).lineTo(cx + colW, y + rowH).stroke("#E2E8F0");
      cx += colW;
    });

    doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + contentW, y + rowH).stroke("#E2E8F0");
    doc.moveTo(MARGIN, y).lineTo(MARGIN, y + rowH).stroke("#E2E8F0");
    y += rowH;
    rowIndex++;
  }

  drawFooter(doc, `BIMLog by IgniteSmart  |  RFI Summary${project ? `: ${project.name}` : ""}  |  ${new Date().toLocaleDateString()}  |  Page ${pageNum}`);
}

// ─── GET /projects/:projectId/rfis ──────────────────────────────────────────
router.get("/projects/:projectId/rfis", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });

    const rfis = await db.query.rfisTable.findMany({
      where: and(eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt)),
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
router.get("/projects/:projectId/rfis/export-excel", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });
    const view = String(req.query.view || "cards");
    const status = String(req.query.status || "all");
    const search = String(req.query.search || "").trim().toLowerCase();

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const rfis = await db.query.rfisTable.findMany({
      where: and(eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt)),
      orderBy: (rfis, { asc }) => [asc(rfis.createdAt)],
    });

    const filtered = rfis
      .filter(rfi => status === "all" || rfi.status === status)
      .filter(rfi => {
        if (!search) return true;
        return [
          rfi.number,
          rfi.subject,
          rfi.submittedByCompany,
          rfi.submittedToCompany,
          rfi.submittedToPerson,
          rfi.submittedToEmail,
        ].some(value => String(value || "").toLowerCase().includes(search));
      });

    const rows = filtered.length > 0 ? filtered : rfis;
    const fmt = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleDateString("en-US") : "";
    const ballInCourt = (rfi: typeof rfisTable.$inferSelect) => {
      if (rfi.status === "closed") return "Closed";
      if (rfi.status === "responded") return rfi.submittedByCompany || "Submitter";
      return rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer";
    };
    const projectLabel = project ? `${project.name}${project.code ? ` (${project.code})` : ""}` : `Project ${projectId}`;
    const isLog = view === "log";
    const headerRow = isLog
      ? [
          "RFI #", "Subject", "Status", "Priority", "Date Requested", "Date Required",
          "Submitted By Company", "Submitted By Contact", "Submitted By Email",
          "Submitted To Company", "Submitted To Contact", "Submitted To Email",
          "Drawing #", "Drawing Title", "Spec Section", "Detail #", "Note #", "Location",
          "Cost Impact", "Cost Amount", "Schedule Impact", "Schedule Days",
          "Ball in Court", "Days Outstanding", "Answer", "Answered By", "Date Answered",
        ]
      : ["RFI #", "Subject", "Status", "Priority", "Ball in Court", "Days Outstanding"];
    const data = rows.map(rfi => {
      const days = daysSince(rfi.createdAt);
      if (!isLog) {
        return [rfi.number, rfi.subject, rfi.status, rfi.priority, ballInCourt(rfi), days];
      }
      return [
        rfi.number, rfi.subject, rfi.status, rfi.priority,
        fmt(rfi.dateRequested || rfi.createdAt), fmt(rfi.dateRequired || rfi.dueDate),
        rfi.submittedByCompany || "", rfi.submittedByContact || "", rfi.submittedByEmail || "",
        rfi.submittedToCompany || "", rfi.submittedToPerson || "", rfi.submittedToEmail || "",
        rfi.drawingNumber || "", rfi.drawingTitle || "", rfi.specSection || "",
        rfi.detailNumber || "", rfi.noteNumber || "", rfi.locationDescription || "",
        rfi.costImpact || "", rfi.costImpactAmount || "",
        rfi.scheduleImpact || "", rfi.scheduleImpactDays != null ? rfi.scheduleImpactDays : "",
        ballInCourt(rfi), days, rfi.answer || rfi.response || "",
        rfi.answeredBy || "", fmt(rfi.dateAnswered || rfi.respondedAt),
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      ["BIMLog by IgniteSmart", projectLabel],
      [isLog ? "RFI Log" : "RFI Summary", `Generated ${new Date().toLocaleString("en-US")}`],
      [],
      headerRow,
      ...data,
    ]);
    worksheet["!cols"] = headerRow.map((header, columnIndex) => {
      const maxValue = Math.max(header.length, ...data.map(row => String(row[columnIndex] || "").length));
      return { wch: Math.min(Math.max(maxValue + 2, 12), 45) };
    });
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 3, c: 0 },
        e: { r: Math.max(data.length + 3, 3), c: headerRow.length - 1 },
      }),
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isLog ? "RFI Log" : "RFI Summary");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const projectCode = String(project?.code || project?.name || `Project${projectId}`).replace(/[^\w.-]+/g, "-");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${projectCode}-${isLog ? "RFI-Log" : "RFI-Summary"}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/rfis", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });
    const body = CreateRfiBody.parse(req.body);

    const result = await createRfiForProject(projectId, {
      ...body,
      number: req.body.number as string | undefined,
      forceNumber: req.body.forceNumber as boolean | undefined,
    }, req.user!);

    if (!result.ok) {
      res.status(result.status).json(result.payload);
      return;
    }

    res.status(201).json(rfiToJson(result.rfi, { createdByName: req.user!.fullName }));
    // No automatic delivery. RFIs are sent manually by the author (copy/paste into
    // their own email client) and then recorded via POST .../mark-sent. Creating an
    // RFI never moves the ball-in-court — that flip happens only at mark-sent time.
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/from-viewpoint ──────────────────────────
// Creates a draft RFI from a Navisworks viewpoint (plugin flow). The screenshot is
// decoded and stored through the storage adapter as a real filesTable row linked to
// the new RFI (source = "lens-viewpoint"), NOT into attachmentsJson. The RFI is
// created via the shared createRfiForProject helper so number/status/draft behavior
// is identical to the normal create route.
router.post("/projects/:projectId/rfis/from-viewpoint", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });
    const { subject, priority, sourceViewpointId, imageBase64, sourceProjectId, projectId: bodyProjectId } = req.body as {
      subject?: unknown; priority?: unknown; sourceViewpointId?: unknown; imageBase64?: unknown; sourceProjectId?: unknown; projectId?: unknown;
    };
    const incomingProjectIdRaw = sourceProjectId ?? bodyProjectId;
    const incomingProjectId = incomingProjectIdRaw == null || String(incomingProjectIdRaw).trim() === "" ? null : Number(incomingProjectIdRaw);
    if (incomingProjectId != null && (!Number.isFinite(incomingProjectId) || incomingProjectId !== projectId)) {
      res.status(409).json({
        error: "project_mismatch",
        message: "This Navisworks model is locked to a different BIMLog project. Open BIMLog Lens Settings and choose the correct project before creating an RFI.",
        expectedProjectId: projectId,
        receivedProjectId: Number.isFinite(incomingProjectId) ? incomingProjectId : null,
      });
      return;
    }
    if (typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ error: "subject is required" });
      return;
    }
    if (typeof priority !== "string" || !priority.trim()) {
      res.status(400).json({ error: "priority is required" });
      return;
    }
    if (typeof sourceViewpointId !== "string" || !sourceViewpointId.trim()) {
      res.status(400).json({ error: "sourceViewpointId is required" });
      return;
    }
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    // Validate the image bytes BEFORE any persistence so a bad payload can never
    // leave behind an orphan RFI.
    const buffer = Buffer.from(imageBase64, "base64");
    if (buffer.length === 0) {
      res.status(400).json({ error: "imageBase64 decoded to zero bytes" });
      return;
    }

    // Side effects past this point: upload the screenshot to storage (disk), then
    // create the RFI + linked filesTable row inside a single transaction so the two
    // rows commit together or not at all. If the transaction rolls back, the one
    // non-transactional artifact (the uploaded file) is compensated via storage.delete.
    const fileName = `viewpoint-${sourceViewpointId}.png`;
    let storagePath: string | undefined;
    try {
      storagePath = await storage.upload(buffer, projectId, fileName);
      const defaultFileStatus = await getDefaultValue("file_status");

      // Smart prefill from the source viewpoint if it's already synced: route the RFI to the
      // viewpoint's Responsible Company and pre-fill the question + location from it, so the RFI
      // arrives half-written. Best-effort — left blank if the viewpoint isn't found.
      let vpToCompany: string | null = null;
      let vpQuestion: string | null = null;
      let vpLocation: string | null = null;
      try {
        const [vp] = await db.select({
          responsibleCompany: lensViewpointsTable.responsibleCompany,
          note: lensViewpointsTable.note,
          floor: lensViewpointsTable.floor,
        }).from(lensViewpointsTable).where(and(
          eq(lensViewpointsTable.projectId, projectId),
          or(eq(lensViewpointsTable.displayId, sourceViewpointId), eq(lensViewpointsTable.viewpointId, sourceViewpointId)),
        )).limit(1);
        if (vp) {
          vpToCompany = vp.responsibleCompany || null;
          vpQuestion = vp.note || null;
          vpLocation = vp.floor || null;
        }
      } catch { /* prefill is best-effort — never block RFI creation */ }

      const result = await db.transaction(async (tx) => {
        // The creator is the ASKER, not the responder: stamp Submitted By with the creator's
        // company/name so the RFI is never shown with the creator holding the ball. Route it TO
        // the viewpoint's Responsible Company (the party expected to answer) when known.
        const created = await createRfiForProject(
          projectId,
          {
            subject,
            priority,
            sourceViewpointId,
            submittedByCompany: req.user!.companyName || null,
            submittedByContact: req.user!.fullName || null,
            submittedToCompany: vpToCompany,
            question: vpQuestion,
            locationDescription: vpLocation,
          },
          req.user!,
          tx,
        );
        if (!created.ok) return created;
        await tx.insert(filesTable).values({
          projectId,
          fileName,
          fileSize: buffer.length,
          fileType: "png",
          status: defaultFileStatus,
          uploadedById: req.user!.userId,
          source: "lens-viewpoint",
          storagePath,
          linkedRfiId: created.rfi.id,
        });
        return created;
      });

      if (!result.ok) {
        await storage.delete(storagePath);
        res.status(result.status).json(result.payload);
        return;
      }

      res.status(201).json(rfiToJson(result.rfi, { createdByName: req.user!.fullName }));
    } catch (error) {
      if (storagePath) await storage.delete(storagePath);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── GET /projects/:projectId/rfis/:rfiId ───────────────────────────────────
// Single-RFI fetch. Used by the deep-link prefill to open a brand-new draft that
// may not yet be present in the filtered/loaded list. `:rfiId` matches a single
// path segment, so the longer .../:rfiId/<subpath> routes (export, responses, etc.)
// are unaffected — they carry an extra segment and never collide with this one.
router.get("/projects/:projectId/rfis/:rfiId", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    const [rfi] = await db.select().from(rfisTable)
      .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt)))
      .limit(1);
    if (!rfi) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }
    const creator = await db.select().from(usersTable).where(eq(usersTable.id, rfi.createdById)).limit(1);
    let assignedToName: string | undefined;
    if (rfi.assignedToId) {
      const assignee = await db.select().from(usersTable).where(eq(usersTable.id, rfi.assignedToId)).limit(1);
      assignedToName = assignee[0]?.fullName;
    }
    res.json(rfiToJson(rfi, { createdByName: creator[0]?.fullName || "", assignedToName }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
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

    // Only a Project Admin can close an RFI
    if (body.status === "closed") {
      const [member] = await db.select().from(projectMembersTable)
        .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, req.user!.userId)))
        .limit(1);
      if (!member || member.role !== "project_admin") {
        res.status(403).json({ error: "Only a Project Admin can close an RFI" });
        return;
      }
    }
    if (body.priority && !(await validateConfigValue("rfi_priority", body.priority))) {
      res.status(422).json({ error: `Invalid priority value: ${body.priority}` });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.subject) updates.subject = body.subject;
    if (body.rfiType !== undefined) updates.rfiType = body.rfiType;
    if (body.sourceViewpointLabel !== undefined) updates.sourceViewpointLabel = body.sourceViewpointLabel;
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
    if (body.responseAttachmentsJson !== undefined) updates.responseAttachmentsJson = body.responseAttachmentsJson;
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

    // Auto-save a response document record when answer is set for the first time
    const isFirstAnswer = body.answer && !existing[0].answer && !existing[0].response;
    if (isFirstAnswer) {
      setImmediate(async () => {
        try {
          const rfiForDoc = updated;
          // Build filename following naming convention
          let responseFileName = `${rfiForDoc.number}-Response`;
          try {
            const conventions = await db.select().from(namingConventionsTable)
              .where(and(eq(namingConventionsTable.projectId, projectId), eq(namingConventionsTable.isActive, true)))
              .limit(1);
            if (conventions.length > 0) {
              const sep = conventions[0].separator;
              const nfFields = await db.select().from(namingFieldsTable)
                .where(eq(namingFieldsTable.conventionId, conventions[0].id))
                .orderBy(namingFieldsTable.fieldOrder);
              const parts: string[] = [];
              for (const field of nfFields) {
                const allowed = field.allowedValues as string[];
                const lbl = field.label.toLowerCase();
                if (lbl.includes("status") || lbl.includes("estado")) {
                  parts.push("S2");
                } else if (lbl.includes("type") || lbl.includes("tipo")) {
                  parts.push("RP");
                } else if (allowed.length > 0) {
                  parts.push(allowed[0]);
                } else {
                  parts.push("RP");
                }
              }
              if (parts.length > 0) responseFileName = parts.join(sep);
            }
          } catch { /* use fallback */ }

          const finalFileName = `${responseFileName}.pdf`;
          const defaultStatus = await getDefaultValue("file_status").catch(() => "Active");
          await db.insert(filesTable).values({
            projectId,
            fileName: finalFileName,
            fileSize: 0,
            fileType: "application/pdf",
            version: 1,
            parentFileId: null,
            status: defaultStatus,
            uploadedById: req.user!.userId,
            documentRelationship: "created",
            documentRelationshipDeclaredAt: new Date(),
            fileTypeTier: "B",
            source: "system-generated",
            linkedRfiId: rfiId,
          });
          await db.insert(activityLogTable).values({
            projectId,
            userId: req.user!.userId,
            userFullName: req.user!.fullName,
            userCompanyName: req.user!.companyName,
            actionType: "upload",
            entityType: "file",
            entityId: rfiId,
            fileNameBefore: null,
            fileNameAfter: finalFileName,
            details: `Auto-generated Response Document: ${finalFileName} (linked to ${rfiForDoc.number})`,
          });
        } catch (err) {
          console.error("[rfis] auto-save response doc failed:", err instanceof Error ? err.message : err);
        }
      });
    }
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
    const revNum = (orig.revisionNumber ?? 0) + 1;
    const newNumber = `${orig.number.replace(/-R\d+$/, "")}-R${revNum}`;
    const defaultStatus = await getDefaultValue("rfi_status");
    const revisionSubject = `Revision of ${orig.number}: ${orig.subject}`;

    const [newRfi] = await db.insert(rfisTable).values({
      projectId,
      number: newNumber,
      subject: revisionSubject,
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
      revisionOf: orig.id,
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

// ─── Shared helper: build single-RFI Word Document object ────────────────────
function buildRfiDocxDocument(
  rfi: typeof rfisTable.$inferSelect,
  responses: (typeof rfiResponsesTable.$inferSelect)[],
): Document {
  const fmtD = (d: Date | string | null | undefined) => {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  function realCheckbox(checked: boolean): SymbolRun {
    return new SymbolRun({ char: checked ? "FC" : "A8", symbolfont: "Wingdings", size: 20 });
  }

  const checkRow = (label: string, checked: boolean) => new Paragraph({
    spacing: { after: 60 },
    children: [realCheckbox(checked), new TextRun({ text: `  ${label}`, size: 18 })],
  });

  const cell = (text: string, opts: { bold?: boolean; shade?: boolean; width?: number } = {}) =>
    new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.shade ? { type: ShadingType.CLEAR, fill: "F1F5F9" } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, size: 18 })] })],
    });

  const labelRow = (lbl: string, val: string, lbl2?: string, val2?: string) =>
    new TableRow({
      children: [
        cell(lbl, { bold: true, shade: true, width: 20 }),
        cell(val, { width: lbl2 ? 30 : 80 }),
        ...(lbl2 ? [cell(lbl2, { bold: true, shade: true, width: 20 }), cell(val2 || "—", { width: 30 })] : []),
      ],
    });

  const sectionHeader = (text: string) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: "1E3A5F" })],
  });

  const costOpts = ["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"];
  const costCheckboxes = costOpts.map(opt => {
    const isChecked = rfi.costImpact === opt;
    const label = opt === "Cost Increase Known" && rfi.costImpactAmount ? `${opt}: ${rfi.costImpactAmount}` : opt;
    return checkRow(label, isChecked);
  });

  const schedOpts = ["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"];
  const schedCheckboxes = schedOpts.map(opt => {
    const isChecked = rfi.scheduleImpact === opt;
    const label = opt !== "No Schedule Impact" && rfi.scheduleImpactDays != null ? `${opt}: ${rfi.scheduleImpactDays} days` : opt;
    return checkRow(label, isChecked);
  });

  const actualAttachments = ((rfi.attachmentsJson as unknown as string[] | null) || []).map(attachmentLabel);
  const attachOpts = actualAttachments.length > 0 ? actualAttachments : ["None"];
  const attachCheckboxes = attachOpts.map(opt => checkRow(opt, false));

  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 },
          children: [new TextRun({ text: `REQUEST FOR INFORMATION — ${rfi.number}`, bold: true, size: 36, color: "1E3A5F" })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          },
          rows: [
            labelRow("Subject", rfi.subject || "—"),
            labelRow("Status", (rfi.status || "").replace(/_/g, " "), "Priority", rfi.priority || "—"),
            labelRow("Date Requested", fmtD(rfi.dateRequested || rfi.createdAt), "Date Required", fmtD(rfi.dateRequired || rfi.dueDate)),
            labelRow("Submitted By", `${rfi.submittedByCompany || "—"} / ${rfi.submittedByContact || "—"}`, "Submitted To", `${rfi.submittedToCompany || "—"} / ${rfi.submittedToPerson || "—"}`),
            labelRow("Drawing #", rfi.drawingNumber || "—", "Spec Section", rfi.specSection || "—"),
          ],
        }),
        sectionHeader("Description of Question"),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: stripMarkdown(rfi.question || rfi.description || "—"), size: 20 })],
        }),
        sectionHeader("RFI RESPONSES"),
        ...(responses.length > 0
          ? responses.map((resp, i) => {
              const respNum = resp.responseNumber ?? (i + 1);
              const respDate = fmtD(resp.createdAt);
              const respAuthor = resp.answeredBy || "—";
              const respText = stripMarkdown(resp.responseText || "—");
              const respAtts: string[] = Array.isArray((resp as any).attachments) ? (resp as any).attachments : [];
              return new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 8, color: "1E3A5F" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                },
                rows: [
                  new TableRow({
                    children: [new TableCell({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: "EFF6FF" },
                      children: [new Paragraph({
                        spacing: { before: 80, after: 80 },
                        children: [
                          new TextRun({ text: `Response ${respNum}`, bold: true, size: 22, color: "1E3A5F" }),
                          new TextRun({ text: `   |   Author: ${respAuthor}   |   Date: ${respDate}`, size: 18, color: "475569" }),
                        ],
                      })],
                    })],
                  }),
                  new TableRow({
                    children: [new TableCell({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ spacing: { before: 80, after: 60 }, children: [new TextRun({ text: "Response Text", bold: true, size: 16, color: "64748B" })] }),
                        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: respText, size: 20 })] }),
                        ...(respAtts.length > 0 ? [
                          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Attachments", bold: true, size: 16, color: "64748B" })] }),
                          ...respAtts.map((a: string) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `- ${attachmentLabel(a)}`, size: 18 })] })),
                        ] : []),
                        ...(resp.isConflictOfInterest ? [
                          new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "CONFLICT OF INTEREST — Logged in audit trail", bold: true, size: 18, color: "92400E" })] }),
                        ] : []),
                      ],
                    })],
                  }),
                ],
              });
            })
          : [
              ...(rfi.answer || rfi.response
                ? [
                    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Response 1", bold: true, size: 20, color: "1E3A5F" })] }),
                    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: rfi.answer || rfi.response || "", size: 20 })] }),
                  ]
                : [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "(No response provided)", size: 18, color: "94A3B8" })] })]),
            ]),
        sectionHeader("Impact & Attachments"),
        new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: "COST IMPACT", bold: true, size: 16, color: "64748B" })] }),
        ...costCheckboxes,
        new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: "SCHEDULE IMPACT", bold: true, size: 16, color: "64748B" })] }),
        ...schedCheckboxes,
        new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: "ATTACHMENTS", bold: true, size: 16, color: "64748B" })] }),
        ...attachCheckboxes,
        new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: "AUTHORIZED BY", bold: true, size: 16, color: "64748B" })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Name: ______________________________________________", size: 18 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Title: ______________________________________________", size: 18 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Company: ______________________________________________", size: 18 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Date: ______________________________________________", size: 18 })] }),
        new Paragraph({
          spacing: { before: 300 },
          children: [new TextRun({ text: `Generated by BIMLog by IgniteSmart | ${rfi.number} | ${new Date().toLocaleDateString()}`, size: 14, color: "94A3B8" })],
        }),
      ],
    }],
  });
}

// ─── GET /projects/:projectId/rfis/:rfiId/export  (single RFI PDF — pure PDFKit) ─
router.get("/projects/:projectId/rfis/:rfiId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) { res.status(404).json({ error: "RFI not found" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const responses = await db.select().from(rfiResponsesTable)
      .where(and(eq(rfiResponsesTable.rfiId, rfiId), eq(rfiResponsesTable.projectId, projectId)))
      .orderBy(rfiResponsesTable.responseNumber);

    const doc = createPdfDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${rfi.number}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    makeRfiPdf(doc, rfi, responses, project);
    doc.end();

    db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName || "User",
      userCompanyName: req.user!.companyName || "",
      actionType: "export",
      entityType: "rfi",
      entityId: rfiId,
      details: `PDF exported: ${rfi.number}`,
    }).catch((activityError) => {
      console.error("[rfis] Failed to log PDF export activity:", activityError instanceof Error ? activityError.message : activityError);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/generate-response  (AI) ──────────
router.post("/projects/:projectId/rfis/:rfiId/generate-response", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    // userDraft is the text the user has typed in the Official Response field (may be empty)
    const userDraft: string = (req.body?.userDraft ?? "").toString().trim();

    const questionText = stripMarkdown(rfi.question || rfi.description || "");

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      projectId,
      feature: "rfis.generate_response",
    });

    const prompt = userDraft.length > 0
      ? `You are responding to an AEC construction RFI. The RFI subject is ${rfi.subject}. The question asked is ${questionText}. The user has drafted the following response: ${userDraft}. Rewrite this draft as a professional formal RFI response. Fix spelling and grammar. Improve technical language. Keep all the user's actual content and intent — do not add new technical details that the user did not mention. Do not invent answers. Output only the rewritten response text with no preamble.`
      : `You are responding to an AEC construction RFI. The RFI subject is ${rfi.subject}. The question asked is ${questionText}. Draft a professional formal response acknowledging the question and requesting the specific clarifications or information needed to provide a complete answer. Keep it concise. Output only the response text with no preamble.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const response = block.type === "text" ? block.text : "";

    res.json({ response });
  } catch (error) {
    if (sendAiUsageError(res, error)) return;
    const message = error instanceof Error ? error.message : "Failed to generate response";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/generate-email-preview  (AI) ──────
// Turns the already-drafted formal RFI content into a natural cover email for the
// manual copy-paste send flow. Pulls only from stored RFI fields — invents no new
// technical content, preserves every factual detail. Output is the email body only.
router.post("/projects/:projectId/rfis/:rfiId/generate-email-preview", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    const userContext: string = (req.body?.userContext ?? "").toString().trim();
    const questionText = stripMarkdown(rfi.question || rfi.description || "");
    const recipient = rfi.submittedToPerson || rfi.submittedToCompany || "the recipient";
    const recipientCompany = rfi.submittedToCompany || "";
    const sender = rfi.submittedByContact || "";
    const senderCompany = rfi.submittedByCompany || "";
    const dueDate = rfi.dateRequired ? new Date(rfi.dateRequired).toISOString().slice(0, 10) : "";

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      projectId,
      feature: "rfis.generate_email_preview",
    });

    const prompt = `You are a construction project manager writing the cover email that accompanies a formal RFI (Request for Information) being sent to a project stakeholder.

Write a complete, natural-sounding professional email that:
- Opens with an appropriate greeting addressed to the named recipient
- Briefly frames the issue in plain, professional English (1-2 sentences)
- Presents the formal RFI question/request in full
- States the response due date, if one is provided
- Closes professionally with the sender's name and company

CRITICAL: preserve EVERY technical and factual detail from the original RFI question text exactly. Do not summarize, omit, soften, or alter any technical specifics, dimensions, locations, drawing or spec references, or quantities. Reference the RFI number and subject naturally within the email.

RFI Number: ${rfi.number}
RFI Subject: ${rfi.subject}
Recipient: ${recipient}${recipientCompany ? `, ${recipientCompany}` : ""}
Sender: ${sender || "the project team"}${senderCompany ? `, ${senderCompany}` : ""}
${dueDate ? `Response Required By: ${dueDate}` : ""}
Original RFI Question Text:
${questionText}
${userContext ? `\nAdditional context from the user (incorporate this naturally into the email): ${userContext}\n` : ""}
Write only the full email body text, starting from the greeting and ending with the closing. Do not include "To:" or "Subject:" header lines, and no preamble or commentary.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const email = block.type === "text" ? block.text : "";
    if (!email.trim()) {
      res.status(502).json({ error: "AI returned an empty email draft" });
      return;
    }

    res.json({ email });
  } catch (error) {
    if (sendAiUsageError(res, error)) return;
    const message = error instanceof Error ? error.message : "Failed to generate email preview";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/mark-sent ─────────────────────────
// Author self-reports that they manually delivered the RFI (copy/paste into their
// own email client). This is the ONLY place the ball-in-court flips to the
// recipient — it writes the first rfi_ball_in_court_history row. No platform send.
router.post("/projects/:projectId/rfis/:rfiId/mark-sent", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    // The transition (flip send status + flip ball-in-court + write the first
    // custody row) must be all-or-nothing, and exactly one caller may win the
    // flip. We do it in a transaction with a guarded conditional UPDATE: the
    // `send_status != 'sent'` predicate makes concurrent callers serialize on
    // the row lock — the loser updates 0 rows and gets a 409. No silent fallback.
    const outcome = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(rfisTable)
        .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
      if (!existing) return { status: 404 as const, error: "RFI not found" };
      if (existing.sendStatus === "sent") return { status: 409 as const, error: "This RFI has already been marked as sent." };

      const recipientCompany = existing.submittedToCompany;
      const recipientPerson = existing.submittedToPerson || existing.submittedToCompany;
      if (!recipientCompany || !recipientPerson) {
        return { status: 422 as const, error: "Set the Submitted To company before marking this RFI as sent." };
      }

      const sentAt = new Date();
      // Auto-advance the workflow: a just-sent RFI moves to "in review" (the reviewer now
      // holds the ball). Don't downgrade one that's already responded/approved/closed.
      const advanceStatus = (existing.status === "open" || existing.status === "draft") ? "in_review" : existing.status;
      const updatedRows = await tx.update(rfisTable).set({
        sendStatus: "sent",
        sentAt,
        sentById: req.user!.userId,
        sendMethod: "copy_paste",
        ballInCourt: recipientCompany,
        status: advanceStatus,
        updatedAt: sentAt,
      }).where(and(
        eq(rfisTable.id, rfiId),
        or(ne(rfisTable.sendStatus, "sent"), isNull(rfisTable.sendStatus)),
      )).returning();

      // Lost the race: another request flipped it first.
      if (updatedRows.length === 0) return { status: 409 as const, error: "This RFI has already been marked as sent." };
      const updated = updatedRows[0];

      // First ball-in-court entry: the recipient now holds the ball as of send time.
      await tx.insert(rfiBallInCourtHistoryTable).values({
        rfiId,
        heldBy: recipientPerson,
        heldByCompany: recipientCompany,
        fromDate: sentAt,
        toDate: null,
        daysHeld: null,
      });

      await tx.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName,
        userCompanyName: req.user!.companyName,
        actionType: "update",
        entityType: "rfi",
        entityId: rfiId,
        details: `Manually marked RFI ${existing.number} as sent to ${recipientCompany}`,
      });

      const [creator] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
        .where(eq(usersTable.id, existing.createdById)).limit(1);
      return { status: 200 as const, body: rfiToJson(updated, { createdByName: creator?.fullName }) };
    });

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.json(outcome.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/send ──────────────────────────────
// Sends the RFI email through the AUTHOR'S OWN connected SendGrid account (per
// user, not a platform key). On a successful send it performs the same
// mark-sent transition. Requires the user to have connected SendGrid first.
router.post("/projects/:projectId/rfis/:rfiId/send", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    const { to, cc, subject, body } = req.body as { to?: unknown; cc?: unknown; subject?: unknown; body?: unknown };
    if (typeof to !== "string" || !to.includes("@")) { res.status(422).json({ error: "A valid recipient email (Submitted To) is required to send." }); return; }
    if (typeof subject !== "string" || !subject.trim()) { res.status(400).json({ error: "subject is required" }); return; }
    if (typeof body !== "string" || !body.trim()) { res.status(400).json({ error: "email body is required" }); return; }

    // The author's own SendGrid connection.
    const [conn] = await db.select().from(userConnectionsTable)
      .where(and(eq(userConnectionsTable.userId, req.user!.userId), eq(userConnectionsTable.provider, "sendgrid")));
    if (!conn || conn.status !== "connected") {
      res.status(428).json({ error: "Connect your SendGrid account before sending.", code: "SENDGRID_NOT_CONNECTED" });
      return;
    }
    const apiKey = (conn.credentials as { apiKey?: string } | null)?.apiKey;
    const fromEmail = conn.accountLabel;
    if (!apiKey || !fromEmail) {
      res.status(428).json({ error: "Your SendGrid connection is incomplete — reconnect it.", code: "SENDGRID_NOT_CONNECTED" });
      return;
    }

    const ccList = Array.isArray(cc) ? cc.filter((e): e is string => typeof e === "string" && e.includes("@")).map(e => ({ email: e })) : [];
    const personalization: Record<string, unknown> = { to: [{ email: to }], subject };
    if (ccList.length) personalization.cc = ccList;

    // Send via SendGrid v3 using the user's key (per-request; no global state).
    let sendErr: string | null = null;
    try {
      const sg = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [personalization],
          from: { email: fromEmail },
          reply_to: { email: fromEmail },
          content: [{ type: "text/plain", value: body }],
        }),
      });
      if (!sg.ok) sendErr = `SendGrid rejected the send (${sg.status})`;
    } catch (err) {
      sendErr = err instanceof Error ? err.message : "network error";
    }

    // Record the attempt.
    try {
      await db.insert(emailLogTable).values({ toEmail: to, subject, triggerType: "rfi_send", status: sendErr ? "failed" : "sent", errorMessage: sendErr });
    } catch { /* non-fatal */ }

    if (sendErr) {
      // Flag the connection so the UI can prompt a reconnect if the key went bad.
      if (/\b401\b/.test(sendErr)) {
        await db.update(userConnectionsTable).set({ status: "error", lastError: sendErr, updatedAt: new Date() })
          .where(eq(userConnectionsTable.id, conn.id));
      }
      res.status(502).json({ error: `Could not send: ${sendErr}` });
      return;
    }

    // Sent successfully — perform the same mark-sent transition.
    const outcome = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(rfisTable)
        .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
      if (!existing) return { status: 404 as const, error: "RFI not found" };

      const recipientCompany = existing.submittedToCompany;
      const recipientPerson = existing.submittedToPerson || existing.submittedToCompany;
      const sentAt = new Date();
      const advanceStatus = (existing.status === "open" || existing.status === "draft") ? "in_review" : existing.status;
      const updatedRows = await tx.update(rfisTable).set({
        sendStatus: "sent",
        sentAt,
        sentById: req.user!.userId,
        sendMethod: "sendgrid",
        ballInCourt: recipientCompany,
        status: advanceStatus,
        updatedAt: sentAt,
      }).where(and(
        eq(rfisTable.id, rfiId),
        or(ne(rfisTable.sendStatus, "sent"), isNull(rfisTable.sendStatus)),
      )).returning();

      // Already sent by another path — the email still went out; report success.
      if (updatedRows.length === 0) {
        const [creator] = await tx.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, existing.createdById)).limit(1);
        return { status: 200 as const, body: rfiToJson(existing, { createdByName: creator?.fullName }) };
      }
      const updated = updatedRows[0];

      if (recipientCompany && recipientPerson) {
        await tx.insert(rfiBallInCourtHistoryTable).values({
          rfiId, heldBy: recipientPerson, heldByCompany: recipientCompany, fromDate: sentAt, toDate: null, daysHeld: null,
        });
      }
      await tx.insert(activityLogTable).values({
        projectId, userId: req.user!.userId, userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
        actionType: "update", entityType: "rfi", entityId: rfiId,
        details: `Sent RFI ${existing.number} to ${to} via SendGrid`,
      });
      const [creator] = await tx.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, existing.createdById)).limit(1);
      return { status: 200 as const, body: rfiToJson(updated, { createdByName: creator?.fullName }) };
    });

    if (outcome.status !== 200) { res.status(outcome.status).json({ error: outcome.error }); return; }
    res.json(outcome.body);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Bad request" });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/view (Track view event) ───────────
router.post("/projects/:projectId/rfis/:rfiId/view", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    await db.insert(rfiViewEventsTable).values({
      rfiId,
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

// ─── GET /projects/:projectId/rfis/:rfiId/viewed-by (Who viewed) ─────────────
router.get("/projects/:projectId/rfis/:rfiId/viewed-by", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    const events = await db.select().from(rfiViewEventsTable)
      .where(eq(rfiViewEventsTable.rfiId, rfiId))
      .orderBy(rfiViewEventsTable.viewedAt);
    res.json(events.map(e => ({
      ...e,
      viewedAt: e.viewedAt.toISOString(),
    })));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.get("/projects/:projectId/rfis/:rfiId/ball-in-court-history", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    const [rfi] = await db.select({ id: rfisTable.id }).from(rfisTable)
      .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) { res.status(404).json({ error: "RFI not found" }); return; }
    const rows = await db.select().from(rfiBallInCourtHistoryTable)
      .where(eq(rfiBallInCourtHistoryTable.rfiId, rfiId))
      .orderBy(rfiBallInCourtHistoryTable.fromDate);
    res.json(rows.map(row => ({
      ...row,
      fromDate: row.fromDate.toISOString(),
      toDate: row.toDate?.toISOString() ?? null,
    })));
  } catch (error) {
    res.status(400).json({ error: "Could not load ball-in-court history" });
  }
});

// ─── GET /projects/:projectId/rfis/:rfiId/audit-certificate ──────────────────
router.get("/projects/:projectId/rfis/:rfiId/audit-certificate", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) { res.status(404).json({ error: "RFI not found" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const viewEvents = await db.select().from(rfiViewEventsTable)
      .where(eq(rfiViewEventsTable.rfiId, rfiId))
      .orderBy(rfiViewEventsTable.viewedAt);
    const creator = await db.select().from(usersTable).where(eq(usersTable.id, rfi.createdById)).limit(1);

    const fmtD = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";
    const fmtTs = (d: Date | string) =>
      new Date(d).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const doc = createPdfDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
    doc.page.margins.bottom = 0;
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${rfi.number}-AuditCert.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    let y = MARGIN;
    const contentW = LETTER_WIDTH - MARGIN * 2;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, contentW, 44).fill("#1E3A5F");
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
      .text("IMMUTABLE AUDIT CERTIFICATE", MARGIN + 12, y + 8, { lineBreak: false });
    doc.fontSize(9).font("Helvetica")
      .text(`BIMLog by IgniteSmart  |  Generated ${new Date().toLocaleString()}`, MARGIN + 12, y + 28, { lineBreak: false });
    doc.fillColor("black");
    y += 52;

    // ── RFI Summary box ───────────────────────────────────────────────────────
    doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("RFI INFORMATION", MARGIN + 6, y + 4.5);
    doc.fillColor("black");
    y += 16;

    const half = contentW / 2 - 2;
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
    drawAuditRow("RFI Number", rfi.number, "Project", project?.name || "—");
    drawAuditRow("Subject", rfi.subject);
    drawAuditRow("Status", (rfi.status || "").replace("_", " "), "Priority", rfi.priority || "—");
    drawAuditRow("Date Created", fmtD(rfi.createdAt), "Created By", creator[0]?.fullName || "—");
    drawAuditRow("Date Required", fmtD(rfi.dateRequired || rfi.dueDate), "Date Answered", fmtD(rfi.dateAnswered || rfi.respondedAt));
    drawAuditRow("Answered By", rfi.answeredBy || "—", "Cost Impact", rfi.costImpact || "—");
    y += 6;

    // ── Immutable Activity Log ────────────────────────────────────────────────
    doc.rect(MARGIN, y, contentW, 16).fill("#0F4C75");
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold").text("IMMUTABLE ACTIVITY LOG — VIEW & ACCESS EVENTS", MARGIN + 6, y + 4.5);
    doc.fillColor("black");
    y += 16;

    if (viewEvents.length === 0) {
      doc.rect(MARGIN, y, contentW, 24).stroke("#E2E8F0");
      doc.fillColor("#94A3B8").fontSize(9).font("Helvetica").text("No view events recorded.", MARGIN + 6, y + 7.5, { width: contentW - 12, lineBreak: false });
      y += 28;
    } else {
      // Fixed column widths: #=30, Timestamp=140, User=160, Company=160
      const columnWidths = [30, 140, 160, 160];
      const colX = [MARGIN, MARGIN + 30, MARGIN + 170, MARGIN + 330];
      const dividerOffsets = [30, 170, 330];

      // Helper: truncate text to fit column using ellipsis
      const truncateCol = (text: string, maxW: number): string => {
        doc.fontSize(8).font("Helvetica");
        if (doc.widthOfString(text) <= maxW) return text;
        let t = text;
        while (t.length > 1 && doc.widthOfString(t + "…") > maxW) t = t.slice(0, -1);
        return t + "…";
      };

      doc.rect(MARGIN, y, contentW, 14).fill("#E2E8F0");
      ["#", "Timestamp (UTC)", "User", "Company"].forEach((h, i) => {
        doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold")
          .text(h, colX[i] + 3, y + 3.5, { width: columnWidths[i] - 4, lineBreak: false });
      });
      y += 14;

      viewEvents.forEach((evt, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(MARGIN, y, contentW, 14).fill(rowBg);
        const vals = [String(idx + 1), fmtTs(evt.viewedAt), evt.userFullName, evt.userCompanyName];
        vals.forEach((v, i) => {
          doc.fillColor("#1E293B").fontSize(8).font("Helvetica");
          if (i === 3) {
            // company column: fixed width 120 with ellipsis truncation
            doc.text(v, colX[i] + 3, y + 3, { width: 120, lineBreak: false, ellipsis: true });
          } else {
            doc.text(truncateCol(v, columnWidths[i] - 6), colX[i] + 3, y + 3, { width: columnWidths[i] - 4, lineBreak: false });
          }
        });
        // vertical dividers
        dividerOffsets.forEach(x => {
          doc.moveTo(MARGIN + x, y).lineTo(MARGIN + x, y + 14).stroke("#E2E8F0");
        });
        y += 14;
        if (y > CONTENT_BOTTOM - 20) {
          drawFooter(doc, `BIMLog by IgniteSmart  |  Audit Certificate: ${rfi.number}  |  Page continued`);
          doc.addPage();
          doc.page.margins.bottom = 0;
          y = MARGIN;
        }
      });
      y += 6;
    }

    // ── Certification block ───────────────────────────────────────────────────
    const certH = 84;
    if (y + certH > CONTENT_BOTTOM) {
      drawFooter(doc, `BIMLog by IgniteSmart  |  Audit Certificate: ${rfi.number}`);
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = MARGIN;
    }
    doc.rect(MARGIN, y, contentW, certH).fillAndStroke("#F0FDF4", "#86EFAC");
    doc.fillColor("#14532D").fontSize(8.5).font("Helvetica-Bold")
      .text("CERTIFICATION STATEMENT", MARGIN + 10, y + 10);
    doc.fillColor("#1E293B").fontSize(8).font("Helvetica")
      .text(
        `This document certifies that the above RFI (${rfi.number}) record and its associated activity log are accurate as of ${new Date().toLocaleString()}. ` +
        `The activity log is maintained by BIMLog by IgniteSmart as an immutable audit trail. ` +
        `Total view events recorded: ${viewEvents.length}. ` +
        `This certificate was generated for project: ${project?.name || projectId}.`,
        MARGIN + 10, y + 24, { width: contentW - 20 }
      );
    y += certH + 8;

    drawFooter(doc, `BIMLog by IgniteSmart  |  Audit Certificate: ${rfi.number}  |  Generated ${new Date().toLocaleDateString()}`);
    doc.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/rfis/generate-question", authMiddleware, async (req, res) => {
  try {
    const { description, projectName, subject, viewpointCode, drawingRef, specRef, location, attachments, costImpact, scheduleImpact } = req.body as {
      description?: string; projectName?: string; subject?: string; viewpointCode?: string; drawingRef?: string; specRef?: string; location?: string; attachments?: string[]; costImpact?: string; scheduleImpact?: string;
    };
    if (!description && !subject && !viewpointCode) {
      res.status(400).json({ error: "description or context is required" });
      return;
    }

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      feature: "rfi_generate_question",
    });

    const context = [
      projectName ? `Project: ${projectName}` : "",
      subject ? `RFI subject: ${subject}` : "",
      viewpointCode ? `Source coordination viewpoint: ${viewpointCode}` : "",
      location ? `Location / floor: ${location}` : "",
      drawingRef ? `Drawing reference: ${drawingRef}` : "",
      specRef ? `Spec section: ${specRef}` : "",
      Array.isArray(attachments) && attachments.length ? `Attached references (sketches, markups, submittals): ${attachments.join(", ")}` : "",
      costImpact ? `Flagged cost impact: ${costImpact}` : "",
      scheduleImpact ? `Flagged schedule impact: ${scheduleImpact}` : "",
      description ? `Issue description from the coordinator: ${description}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `You are a senior BIM coordination manager writing a construction RFI (Request for Information). Use ONLY the context provided below — never invent dimensions, part numbers, drawing numbers, or facts that are not given.

If the context clearly conveys a specific coordination issue (a clash, a fit or clearance problem, a missing detail, or a discrepancy between drawings, specs, or submittals), write a formal, professional RFI question in AEC construction language: state the exact issue and its location, reference the relevant drawings / specs / submittals / viewpoint that are provided, and request a specific decision or clarification. Keep it to 2-4 short paragraphs.

If the context is too thin to write a specific technical question — i.e. you would have to guess what the actual conflict is — do NOT make something up. Instead reply with a single line beginning exactly with:
NEED_MORE_INFO: <a short, specific question asking the coordinator for the one or two missing details you need>

Context:
${context}

Reply with either the finished RFI question text, or a single NEED_MORE_INFO line.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const question = block.type === "text" ? block.text : "";

    res.json({ question });
  } catch (error) {
    if (sendAiUsageError(res, error)) return;
    const message = error instanceof Error ? error.message : "Failed to generate question";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/rfis/attachments/from-google-drive ────────────
// Downloads a file from the user's connected Google Drive and stores it as a
// downloadable attachment (same file-record shape as a local upload).
router.post("/projects/:projectId/rfis/attachments/from-google-drive",
  authMiddleware, requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const { fileId, fileName, mimeType, rfiId } = req.body as { fileId?: string; fileName?: string; mimeType?: string; rfiId?: number };
    if (!fileId || !fileName) { res.status(400).json({ error: "fileId and fileName are required" }); return; }
    try {
      const token = await getValidAccessToken(req.user!.userId, "google_drive");
      const isGoogleDoc = (mimeType || "").startsWith("application/vnd.google-apps");
      // Google-native docs must be exported; regular files stream with alt=media.
      const url = isGoogleDoc
        ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`
        : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const dl = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!dl.ok) { res.status(502).json({ error: `Google Drive download failed (${dl.status})` }); return; }
      const buffer = Buffer.from(await dl.arrayBuffer());
      const finalName = isGoogleDoc && !/\.pdf$/i.test(fileName) ? `${fileName}.pdf` : fileName;
      const ext = (finalName.split(".").pop() || "").toLowerCase();
      const storagePath = await storage.upload(buffer, projectId, `rfi-attach-${Date.now()}-${finalName}`);
      const defaultFileStatus = await getDefaultValue("file_status");
      const [row] = await db.insert(filesTable).values({
        projectId, fileName: finalName, fileSize: buffer.length, fileType: ext || "bin",
        status: defaultFileStatus, uploadedById: req.user!.userId, source: "rfi-attachment",
        storagePath, linkedRfiId: rfiId ? Number(rfiId) : null,
      }).returning();
      res.json({ fileId: row.id, fileName: finalName, downloadUrl: `/api/v1/projects/${projectId}/files/${row.id}/download?name=${encodeURIComponent(finalName)}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      res.status(msg === "not_connected" ? 428 : 500).json({ error: msg === "not_connected" ? "Connect Google Drive first." : msg });
    }
  }
);

router.post("/projects/:projectId/rfis/attachments/from-cloud",
  authMiddleware, requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const { provider, ref, fileName, mimeType, rfiId } = req.body as {
      provider?: string; ref?: string; fileName?: string; mimeType?: string; rfiId?: number;
    };
    const key = provider ? providerFromParam(provider) : null;
    if (!key || !ref || !fileName) {
      res.status(400).json({ error: "provider, ref and fileName are required" });
      return;
    }
    try {
      const { buffer, exportedPdf } = await downloadCloud(req.user!.userId, key, ref, mimeType);
      const finalName = exportedPdf && !/\.pdf$/i.test(fileName) ? `${fileName}.pdf` : fileName;
      const ext = (finalName.split(".").pop() || "").toLowerCase();
      const storagePath = await storage.upload(buffer, projectId, `rfi-attach-${Date.now()}-${finalName}`);
      const defaultFileStatus = await getDefaultValue("file_status");
      const [row] = await db.insert(filesTable).values({
        projectId,
        fileName: finalName,
        fileSize: buffer.length,
        fileType: ext || "bin",
        status: defaultFileStatus,
        uploadedById: req.user!.userId,
        source: "rfi-attachment",
        storagePath,
        linkedRfiId: rfiId ? Number(rfiId) : null,
      }).returning();
      res.json({
        fileId: row.id,
        fileName: finalName,
        downloadUrl: `/api/v1/projects/${projectId}/files/${row.id}/download?name=${encodeURIComponent(finalName)}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      res.status(msg === "not_connected" ? 428 : 500).json({
        error: msg === "not_connected" ? "Connect this file source before importing." : "Could not import that file.",
      });
    }
  }
);

// ─── POST /projects/:projectId/rfis/import-prefill ───────────────────────────
// Reads ONE uploaded document (PDF/Word/Excel/image-of-text) and returns a
// single set of proposed RFI fields for the user to REVIEW in the create form.
// It does not create anything. Uses only what's in the document — no invention.
router.post("/projects/:projectId/rfis/import-prefill",
  authMiddleware,
  requirePermission("admin", "write"),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).single("file"),
  async (req, res) => {
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const projectId = Number(req.params.projectId);
      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "rfi_import_prefill",
      });
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      const schemaHint = `{"subject":"","rfiType":"one of Coordination|General|Drawing|Spec|Submittal|Safety Data Sheet|Change|Other, or null","question":"","submittedToCompany":"","submittedToPerson":"","submittedToEmail":"","submittedByCompany":"","submittedByContact":"","submittedByEmail":"","drawingNumber":"","specSection":"","locationDescription":"","costImpact":"one of No Cost Impact|Cost Increase TBD|Cost Increase Known|Cost Decrease, or null","scheduleImpact":"one of No Schedule Impact|Increase in Calendar Days|Decrease in Calendar Days, or null","priority":"one of low|medium|high, or null","dateRequired":"YYYY-MM-DD or null"}`;
      const instruction = `You are reading a construction document that describes ONE RFI (Request for Information) or an issue that should become one. Extract the fields into a SINGLE JSON object (no markdown fences, no array). Use ONLY information present in the document; leave a field as "" or null if it is not stated — never invent drawing numbers, companies, names, dates, or amounts. Fields: ${schemaHint}`;

      let raw = "";
      if (isPdf && pdfBase64) {
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
              { type: "text", text: instruction },
            ] as any,
          }],
        });
        raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      } else {
        const text = (chunks || []).join("\n").slice(0, 20000);
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1500,
          messages: [{ role: "user", content: `${instruction}\n\nDocument:\n${text}` }],
        });
        raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      }

      let fields: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) fields = parsed;
      } catch { /* leave empty on unparseable output — no fabrication */ }

      res.json({ fields, sourceFileName: req.file.originalname });
    } catch (error) {
      if (sendAiUsageError(res, error)) return;
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to read document" });
    }
  }
);

// ─── POST /projects/:projectId/rfis/attachments/upload ───────────────────────
// Uploads a file from the user's computer, stores it via the storage adapter as
// a downloadable file record, and returns a download URL to add to an RFI's
// attachments. rfiId is optional (the create form has no RFI yet).
router.post("/projects/:projectId/rfis/attachments/upload",
  authMiddleware,
  requirePermission("admin", "write"),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const rfiId = req.body?.rfiId ? Number(req.body.rfiId) : null;
      const fileName = req.file.originalname || "attachment";
      const ext = (fileName.split(".").pop() || "").toLowerCase();
      const storagePath = await storage.upload(req.file.buffer, projectId, `rfi-attach-${Date.now()}-${fileName}`);
      const defaultFileStatus = await getDefaultValue("file_status");
      const [row] = await db.insert(filesTable).values({
        projectId,
        fileName,
        fileSize: req.file.size,
        fileType: ext || "bin",
        status: defaultFileStatus,
        uploadedById: req.user!.userId,
        source: "rfi-attachment",
        storagePath,
        linkedRfiId: rfiId,
      }).returning();
      res.json({ fileId: row.id, fileName, downloadUrl: `/api/v1/projects/${projectId}/files/${row.id}/download?name=${encodeURIComponent(fileName)}` });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
    }
  }
);

// ─── GET /projects/:projectId/rfis/:rfiId/responses ──────────────────────────
router.get("/projects/:projectId/rfis/:rfiId/responses", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params["projectId"] as string);
    const rfiId = parseInt(req.params["rfiId"] as string);
    const responses = await db.select().from(rfiResponsesTable)
      .where(and(eq(rfiResponsesTable.rfiId, rfiId), eq(rfiResponsesTable.projectId, projectId)))
      .orderBy(rfiResponsesTable.createdAt);
    res.json(responses.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/rfis/:rfiId/responses ─────────────────────────
router.post("/projects/:projectId/rfis/:rfiId/responses", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params["projectId"] as string);
    const rfiId = parseInt(req.params["rfiId"] as string);
    const userId = req.user!.userId;
    const body = req.body as {
      responseText: string;
      answeredBy?: string;
      answeredByEmail?: string;
      answeredByCompany?: string;
      costImpact?: string;
      costImpactAmount?: string;
      scheduleImpact?: string;
      scheduleImpactDays?: number;
      closingStatus?: string;
      responseAttachmentsJson?: string[];
    };

    if (!body.responseText?.trim()) {
      res.status(400).json({ error: "Response text is required." });
      return;
    }

    const [rfi] = await db.select().from(rfisTable)
      .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) { res.status(404).json({ error: "RFI not found" }); return; }

    const [responder] = await db.select({ email: usersTable.email, fullName: usersTable.fullName })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const responderEmail = responder?.email || (req.user as any).email || "";
    const responderCompany = (req.user as any).companyName || "";

    const isCoi = !!(
      (responderEmail && rfi.submittedByEmail && responderEmail.toLowerCase() === rfi.submittedByEmail.toLowerCase()) ||
      (responderCompany && rfi.submittedByCompany && responderCompany.toLowerCase() === rfi.submittedByCompany.toLowerCase())
    );

    // Compute next response_number for this RFI
    const newResponse = await db.transaction(async (tx) => {
      const [{ maxNum }] = await tx.select({ maxNum: max(rfiResponsesTable.responseNumber) })
      .from(rfiResponsesTable).where(eq(rfiResponsesTable.rfiId, rfiId));
      const responseNumber = (maxNum ?? 0) + 1;

      const [inserted] = await tx.insert(rfiResponsesTable).values({
      rfiId,
      projectId,
      responseNumber,
      responseText: body.responseText.trim(),
      answeredBy: body.answeredBy || undefined,
      answeredByEmail: body.answeredByEmail || responderEmail || undefined,
      answeredByCompany: body.answeredByCompany || responderCompany || undefined,
      costImpact: body.costImpact || undefined,
      costImpactAmount: body.costImpactAmount || undefined,
      scheduleImpact: body.scheduleImpact || undefined,
      scheduleImpactDays: body.scheduleImpactDays || undefined,
      isConflictOfInterest: isCoi,
    }).returning();

      const answeredAt = new Date();
      const closesRfi = body.closingStatus === "closed";
      const submitterCompany = rfi.submittedByCompany || rfi.submittedByContact || "Submitter";
      const submitterPerson = rfi.submittedByContact || rfi.submittedByEmail || submitterCompany;
      await tx.update(rfisTable).set({
      answer: body.responseText.trim(),
      answeredBy: body.answeredBy || undefined,
      dateAnswered: answeredAt,
      costImpact: body.costImpact || undefined,
      costImpactAmount: body.costImpactAmount || undefined,
      scheduleImpact: body.scheduleImpact || undefined,
      scheduleImpactDays: body.scheduleImpactDays || undefined,
      responseAttachmentsJson: body.responseAttachmentsJson || [],
      ballInCourt: closesRfi ? null : submitterCompany,
      ...(body.closingStatus ? { status: body.closingStatus } : { status: "responded" }),
      updatedAt: answeredAt,
    }).where(eq(rfisTable.id, rfiId));

      const [openCustody] = await tx.select().from(rfiBallInCourtHistoryTable)
        .where(and(eq(rfiBallInCourtHistoryTable.rfiId, rfiId), isNull(rfiBallInCourtHistoryTable.toDate)))
        .limit(1);
      if (openCustody) {
        await tx.update(rfiBallInCourtHistoryTable).set({
          toDate: answeredAt,
          daysHeld: Math.max(0, daysSince(openCustody.fromDate)),
        }).where(eq(rfiBallInCourtHistoryTable.id, openCustody.id));
      }
      if (!closesRfi) {
        await tx.insert(rfiBallInCourtHistoryTable).values({
          rfiId,
          heldBy: submitterPerson,
          heldByCompany: submitterCompany,
          fromDate: answeredAt,
          toDate: null,
          daysHeld: null,
        });
      }

    // Log COI in activity trail if applicable
    if (isCoi) {
      await tx.insert(activityLogTable).values({
        projectId,
        userId,
        userFullName: req.user!.fullName,
        userCompanyName: req.user!.companyName,
        actionType: "warning",
        entityType: "rfi",
        entityId: rfiId,
        fileNameAfter: rfi.number,
        details: `CONFLICT OF INTEREST: ${body.answeredBy || responderEmail || "Unknown"} responded to their own RFI (${rfi.number}) — ${rfi.subject}`,
      });
    }

    // Log normal activity
      await tx.insert(activityLogTable).values({
      projectId,
      userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "rfi",
      entityId: rfiId,
      fileNameAfter: rfi.number,
      details: `RFI ${rfi.number} received official response from ${body.answeredBy || responderEmail || "Unknown"}`,
      });

      return inserted;
    });

    res.json({ ...newResponse, createdAt: newResponse.createdAt.toISOString(), isConflictOfInterest: isCoi });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/rfis/:rfiId/export-word ────────────────────────
router.get("/projects/:projectId/rfis/:rfiId/export-word", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params["projectId"] as string);
    const rfiId = parseInt(req.params["rfiId"] as string);

    const [rfi] = await db.select().from(rfisTable)
      .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) { res.status(404).json({ error: "RFI not found" }); return; }

    const responses = await db.select().from(rfiResponsesTable)
      .where(and(eq(rfiResponsesTable.rfiId, rfiId), eq(rfiResponsesTable.projectId, projectId)))
      .orderBy(rfiResponsesTable.responseNumber);

    const doc = buildRfiDocxDocument(rfi, responses);
    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${rfi.number}.docx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/rfis/import",
  authMiddleware,
  requirePermission("admin", "write"),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const anthropicClient = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "rfi_import",
      });
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      let records: any[] = [];
      if (isPdf && pdfBase64) {
        try {
          const extractMsg = await anthropicClient.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: `Extract all RFI records from this PDF document. Return ONLY a JSON array, no markdown. If no RFIs found return []:
[{"number":"RFI-001","subject":"subject text","description":"full description","status":"open/closed/pending","priority":"high/medium/low","submittedByCompany":"company","submittedByContact":"person name","dueDate":"date or null"}]` }
              ] as any
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          records = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          console.log("[rfi-import] PDF direct extraction:", records.length, "records");
        } catch (e) {
          console.error("[rfi-import] PDF direct extraction failed:", e);
        }
      } else {
      for (const chunk of chunks) {
        try {
          const extractMsg = await anthropicClient.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `Extract all RFI records from this construction document chunk. Return ONLY a JSON array, no markdown. If no RFIs found return empty array []:
[{"number":"RFI-001","subject":"subject text","description":"full description","status":"open/closed/pending","priority":"high/medium/low","submittedByCompany":"company","submittedByContact":"person name","dueDate":"date or null"}]
Document chunk:
${chunk}`
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          const chunkRecords = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          records = [...records, ...chunkRecords];
        } catch (e) {
          console.error("[rfi-import] chunk extraction failed:", e);
        }
      }
      } // end else (non-PDF)

      const forceImport = req.body?.forceImport === "true";
      if (!forceImport && records.length > 0) {
        const { checkImportIntelligence } = await import("../lib/import-intelligence");
        const intelligence = await checkImportIntelligence(req.user!.userId, projectId, records, "rfi");
        if (intelligence.warnings.length > 0) {
          res.json({ requiresConfirmation: true, warnings: intelligence.warnings, crossLinks: intelligence.crossLinks, safeCount: intelligence.safeIndices.length, total: records.length });
          return;
        }
      }

      const existingRfisForDrf = await db.select({ number: rfisTable.number })
        .from(rfisTable).where(eq(rfisTable.projectId, projectId));
      const usedNumbers = new Set(existingRfisForDrf.map(r => r.number));

      const getDrfNumber = (num: string): string => {
        if (!usedNumbers.has(num)) return num;
        let i = 1;
        while (usedNumbers.has(`${num}-DRF-${String(i).padStart(3,"0")}`)) i++;
        return `${num}-DRF-${String(i).padStart(3,"0")}`;
      };

      let imported = 0;
      const renamedItems: { original: string; renamed: string }[] = [];
      for (const r of records) {
        if (!r.subject && !r.number) continue;
        const proposed = r.number || `RFI-${String(imported + 1).padStart(3, "0")}`;
        const finalNum = getDrfNumber(proposed);
        if (finalNum !== proposed) renamedItems.push({ original: proposed, renamed: finalNum });
        usedNumbers.add(finalNum);
        await db.insert(rfisTable).values({
          projectId,
          number: finalNum,
          subject: r.subject || "Imported RFI",
          description: r.description || null,
          status: r.status || "open",
          priority: r.priority || "medium",
          createdById: req.user!.userId,
          submittedByCompany: r.submittedByCompany || null,
          submittedByContact: r.submittedByContact || null,
          dueDate: r.dueDate ? new Date(r.dueDate) : null,
        });
        imported++;
      }
      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "", userCompanyName: req.user!.companyName ?? "",
        actionType: "import", entityType: "rfi", entityId: projectId,
        details: `Imported ${imported} RFIs from ${req.file.originalname}`,
      });
      res.json({
        imported,
        message: `${imported} RFIs imported successfully`,
        renamed: renamedItems,
        renameCount: renamedItems.length,
      });
    } catch (err) {
      console.error("[rfi-import]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── DELETE RFI (soft delete) ──────────────────────────────────────────────────
router.delete("/projects/:projectId/rfis/:rfiId",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const rfiId = Number(req.params.rfiId);
    const reason = (req.body?.reason as string | undefined) ?? null;
    try {
      const [existing] = await db.select().from(rfisTable)
        .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId)));
      if (!existing) { res.status(404).json({ error: "not_found" }); return; }

      await db.update(rfisTable)
        .set({ deletedAt: new Date(), deleteReason: reason })
        .where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId)));

      await db.delete(linkedItemsTable).where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, "rfi"), eq(linkedItemsTable.fromId, rfiId)),
          and(eq(linkedItemsTable.toType, "rfi"), eq(linkedItemsTable.toId, rfiId)),
        ),
      ));

      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "delete", entityType: "rfi", entityId: rfiId,
        details: JSON.stringify({ reason, number: existing.number, subject: existing.subject }),
      });

      await db.insert(agentInsightsTable).values({
        projectId, agentType: "rfi", entityType: "rfi", entityId: rfiId,
        insightType: "delete_pattern",
        message: `RFI ${existing.number} deleted: ${reason ?? "no reason"}`,
        recommendation: "Investigate delete reasons to surface duplicate-creation or workflow issues.",
        severity: "info",
      });

      res.json({ success: true });
    } catch (err) {
      if (sendAiUsageError(res, err)) return;
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;


