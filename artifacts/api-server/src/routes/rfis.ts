import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rfisTable, usersTable, activityLogTable, projectsTable, namingConventionsTable, namingFieldsTable, filesTable, rfiViewEventsTable, rfiResponsesTable, projectMembersTable } from "@workspace/db/schema";
import { sendEmail, makeRfiAssignedEmail, getUserLang, notifEnabled } from "../lib/email";
import { getNextAvailableNumber } from "../lib/import-intelligence";
import { eq, and, count, max } from "drizzle-orm";
import { CreateRfiBody, ListRfisParams, UpdateRfiParams, UpdateRfiBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue, getDefaultValue, getConfigOptionMeta } from "../middlewares/config-validator";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import PDFDocument from "pdfkit";
import { extractFileText } from "../lib/extract-file-text";
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

// Unicode checkbox characters — ☐ unchecked (\u2610), ☑ checked (\u2611)
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
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
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
    ["Status",         (rfi.status || "").replace(/_/g, " ") || "—"],
    ["Priority",       rfi.priority || "—"],
    ["Date Requested", fmtD(rfi.dateRequested || rfi.createdAt)],
    ["Date Required",  fmtD(rfi.dateRequired || rfi.dueDate)],
    ["Submitted By",   `${rfi.submittedByCompany || "—"} / ${rfi.submittedByContact || "—"}`],
    ["Submitted To",   `${rfi.submittedToCompany || "—"} / ${rfi.submittedToPerson || "—"}`],
    ["Drawing Number", rfi.drawingNumber || "—"],
    ["Spec Section",   rfi.specSection || "—"],
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

  // ── Section 5: Cost Impact checkboxes ───────────────────────────────────────
  const costOpts = ["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"];
  checkPage(20 + costOpts.length * 16);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("COST IMPACT", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  for (const opt of costOpts) {
    const checked = rfi.costImpact === opt;
    const label   = opt === "Cost Increase Known" && rfi.costImpactAmount ? `${opt}: ${rfi.costImpactAmount}` : opt;
    drawCheckbox(MARGIN + 8, y + 2, checked);
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(label, MARGIN + 22, y + 2, { lineBreak: false });
    y += 16;
  }
  y += 4;

  // ── Section 6: Schedule Impact checkboxes ────────────────────────────────────
  const schedOpts = ["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"];
  checkPage(20 + schedOpts.length * 16);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("SCHEDULE IMPACT", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  for (const opt of schedOpts) {
    const checked = rfi.scheduleImpact === opt;
    const label   = opt !== "No Schedule Impact" && rfi.scheduleImpactDays != null
      ? `${opt}: ${rfi.scheduleImpactDays} days` : opt;
    drawCheckbox(MARGIN + 8, y + 2, checked);
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(label, MARGIN + 22, y + 2, { lineBreak: false });
    y += 16;
  }
  y += 4;

  // ── Section 7: Attachments checkboxes ───────────────────────────────────────
  const attachOpts = ["See marked up drawings", "See attached specifications", "See attached schedules", "None"];
  checkPage(20 + attachOpts.length * 16);
  doc.rect(MARGIN, y, contentW, 16).fill("#F1F5F9");
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold")
    .text("ATTACHMENTS", MARGIN + 8, y + 5, { lineBreak: false });
  y += 16;
  for (const opt of attachOpts) {
    drawCheckbox(MARGIN + 8, y + 2, false);
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(opt, MARGIN + 22, y + 2, { lineBreak: false });
    y += 16;
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
  const measDoc = new PDFDocument({ autoFirstPage: false });
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
    const proposedNumber = (req.body.number as string | undefined) || `RFI-${String((rfiCount.count as number) + 1).padStart(4, "0")}`;
    const { isDuplicate, suggestedNumber } = await getNextAvailableNumber(projectId, "rfi", proposedNumber);
    if (isDuplicate && !(req.body.forceNumber as boolean | undefined)) {
      res.status(409).json({
        error: "duplicate_number",
        message: `An RFI with number ${proposedNumber} already exists.`,
        suggestedNumber,
        canForce: true,
      });
      return;
    }
    const number = isDuplicate ? suggestedNumber : proposedNumber;

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

    // ── T2: RFI Assigned email ──────────────────────────────────────────────
    if (rfi.submittedToEmail) {
      setImmediate(async () => {
        try {
          const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
          const recipientUser = await db.select().from(usersTable).where(eq(usersTable.email, rfi.submittedToEmail!)).limit(1);
          const prefs = recipientUser[0]?.notificationPreferences;
          if (!notifEnabled(prefs, "rfi_assigned")) return;
          const lang = getUserLang(prefs);
          const dueStr = rfi.dateRequired ? new Date(rfi.dateRequired).toLocaleDateString("en-US") : null;
          await sendEmail({
            to: rfi.submittedToEmail!,
            subject: lang === "es"
              ? `Nuevo RFI Asignado: ${rfi.number} — ${rfi.subject}`
              : `New RFI Assigned: ${rfi.number} — ${rfi.subject}`,
            html: makeRfiAssignedEmail({
              lang,
              rfiNumber: rfi.number,
              subject: rfi.subject,
              projectName: project[0]?.name || "Unknown Project",
              submittedByName: req.user!.fullName,
              dateRequired: dueStr,
              projectId,
              rfiId: rfi.id,
            }),
          });
        } catch (_) {}
      });
    }
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

  const attachOpts = ["See marked up drawings", "See attached specifications", "See attached schedules", "None"];
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
                          ...respAtts.map((a: string) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `• ${a}`, size: 18 })] })),
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

    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
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
    }).catch(() => {});
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

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
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
    const message = error instanceof Error ? error.message : "Failed to generate response";
    res.status(500).json({ error: message });
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

    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
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
    const [{ maxNum }] = await db.select({ maxNum: max(rfiResponsesTable.responseNumber) })
      .from(rfiResponsesTable).where(eq(rfiResponsesTable.rfiId, rfiId));
    const responseNumber = (maxNum ?? 0) + 1;

    const [newResponse] = await db.insert(rfiResponsesTable).values({
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

    // Update legacy rfi.answer for backward compat with PDF/Word export
    await db.update(rfisTable).set({
      answer: body.responseText.trim(),
      answeredBy: body.answeredBy || undefined,
      dateAnswered: new Date(),
      costImpact: body.costImpact || undefined,
      costImpactAmount: body.costImpactAmount || undefined,
      scheduleImpact: body.scheduleImpact || undefined,
      scheduleImpactDays: body.scheduleImpactDays || undefined,
      responseAttachmentsJson: body.responseAttachmentsJson || [],
      ...(body.closingStatus ? { status: body.closingStatus } : {}),
      updatedAt: new Date(),
    }).where(eq(rfisTable.id, rfiId));

    // Log COI in activity trail if applicable
    if (isCoi) {
      await db.insert(activityLogTable).values({
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
    await db.insert(activityLogTable).values({
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
      const anthropicClient = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "",
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
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
        const intelligence = await checkImportIntelligence(projectId, records, "rfi");
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

export default router;
