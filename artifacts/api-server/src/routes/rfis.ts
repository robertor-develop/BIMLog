import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rfisTable, usersTable, activityLogTable, projectsTable, namingConventionsTable, namingFieldsTable, filesTable, rfiViewEventsTable, rfiResponsesTable } from "@workspace/db/schema";
import { eq, and, count, max } from "drizzle-orm";
import { CreateRfiBody, ListRfisParams, UpdateRfiParams, UpdateRfiBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue, getDefaultValue, getConfigOptionMeta } from "../middlewares/config-validator";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";
import { Document, Paragraph, TextRun, SymbolRun, Table, TableRow, TableCell, Packer, WidthType, BorderStyle, HeadingLevel, AlignmentType, ShadingType } from "docx";
const router: IRouter = Router();

function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

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
  project: { name: string } | undefined,
  creatorName: string,
  startY = MARGIN,
  isFirstPage = true,
): number {
  const fmtD = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";
  const val = (v: string | null | undefined) => v || "—";

  // Disable PDFKit auto-paging so only our addPageIfNeeded triggers new pages
  doc.page.margins.bottom = 0;

  let y = startY;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > CONTENT_BOTTOM) {
      drawFooter(doc, `BIMLog by IgniteSmart  |  ${rfi.number}  |  ${new Date().toLocaleDateString()}`);
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = MARGIN;
    }
  };

  if (isFirstPage) {
    doc.rect(MARGIN, y, 512, 58).fill("#1E3A5F");
    doc.fillColor("white").fontSize(17).font("Helvetica-Bold")
      .text("REQUEST FOR INFORMATION", MARGIN + 10, y + 10, { width: 380 });
    doc.fontSize(22).font("Helvetica-Bold")
      .text(rfi.number, MARGIN + 10, y + 28, { width: 490, align: "right" });
    doc.fillColor("black");
    y += 62;

    doc.rect(MARGIN, y, 512, 46).stroke("#CBD5E1");
    doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold")
      .text("PROJECT", MARGIN + 10, y + 6)
      .text("ADDRESS", 240, y + 6)
      .text("DATE REQUESTED", 390, y + 6)
      .text("DATE REQUIRED", 490, y + 6);
    doc.fontSize(10).fillColor("black").font("Helvetica")
      .text(project?.name || "—", MARGIN + 10, y + 18, { width: 180 })
      .text(val(rfi.projectAddress), 240, y + 18, { width: 140 })
      .text(fmtD(rfi.dateRequested || rfi.createdAt), 390, y + 18, { width: 90 })
      .text(fmtD(rfi.dateRequired || rfi.dueDate), 490, y + 18, { width: 70 });
    y += 50;
  }

  const drawSection = (title: string, fields: [string, string | null | undefined][]) => {
    const rows = Math.ceil(fields.length / 2);
    const sectionH = 18 + rows * 28 + 6;
    addPageIfNeeded(sectionH + 10);

    doc.rect(MARGIN, y, 512, 18).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text(title, MARGIN + 6, y + 5);
    doc.fillColor("black");
    y += 18;

    fields.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const fx = col === 0 ? MARGIN : MARGIN + COL_W;
      const fy = y + row * 28;
      doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold")
        .text(label.toUpperCase(), fx + 6, fy + 4, { width: COL_W - 12 });
      doc.fontSize(10).fillColor("black").font("Helvetica")
        .text(val(value), fx + 6, fy + 14, { width: COL_W - 12 });
      if (col === 1 || i === fields.length - 1) {
        doc.moveTo(MARGIN, fy + 28).lineTo(MARGIN + 512, fy + 28).stroke("#E2E8F0");
      }
    });
    y += rows * 28 + 4;
  };

  addPageIfNeeded(56);
  doc.rect(MARGIN, y, 512, 18).fill("#F1F5F9");
  doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("SUBJECT & PRIORITY", MARGIN + 6, y + 5);
  y += 18;
  doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold").text("SUBJECT", MARGIN + 6, y + 4);
  doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold").text("PRIORITY / STATUS", 420, y + 4);
  doc.fontSize(11).fillColor("black").font("Helvetica").text(rfi.subject, MARGIN + 6, y + 14, { width: 340 });
  doc.fontSize(10).fillColor("black").font("Helvetica")
    .text(`${(rfi.priority || "").toUpperCase()} / ${(rfi.status || "").replace("_", " ").toUpperCase()}`, 420, y + 14, { width: 140 });
  doc.moveTo(MARGIN, y + 34).lineTo(MARGIN + 512, y + 34).stroke("#E2E8F0");
  y += 38;

  drawSection("SUBMITTED BY", [
    ["Company", rfi.submittedByCompany || creatorName],
    ["Contact Person", rfi.submittedByContact],
    ["Address", rfi.submittedByAddress],
    ["Phone", rfi.submittedByPhone],
    ["Email", rfi.submittedByEmail],
  ]);

  drawSection("SUBMITTED TO", [
    ["Company", rfi.submittedToCompany],
    ["Contact Person", rfi.submittedToPerson],
    ["Email", rfi.submittedToEmail],
  ]);

  drawSection("REFERENCE INFORMATION", [
    ["Drawing Number", rfi.drawingNumber],
    ["Drawing Title", rfi.drawingTitle],
    ["Spec Section", rfi.specSection],
    ["Detail Number", rfi.detailNumber],
    ["Note Number", rfi.noteNumber],
    ["Location", rfi.locationDescription],
  ]);

  const questionText = rfi.question || rfi.description || "No question text provided.";
  const estimatedQH = Math.min(Math.max(doc.heightOfString(questionText, { width: 500 }) + 36, 60), 300);
  addPageIfNeeded(estimatedQH + 30);
  doc.rect(MARGIN, y, 512, 18).fill("#F1F5F9");
  doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("DESCRIPTION OF QUESTION", MARGIN + 6, y + 5);
  y += 18;
  const beforeQ = y;
  doc.fontSize(10).fillColor("black").font("Helvetica").text(questionText, MARGIN + 6, y + 6, { width: 500 });
  const actualQH = doc.heightOfString(questionText, { width: 500 }) + 18;
  doc.rect(MARGIN, beforeQ, 512, actualQH).stroke("#E2E8F0");
  y = beforeQ + actualQH + 6;

  const attList = (rfi.attachmentsJson as string[] | null) || [];
  if (attList.length > 0) {
    addPageIfNeeded(24 + attList.length * 16);
    doc.rect(MARGIN, y, 512, 18).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("QUESTION ATTACHMENTS", MARGIN + 6, y + 5);
    y += 18;
    attList.forEach((a, i) => {
      doc.fontSize(9).fillColor("#1D4ED8").font("Helvetica").text(`${i + 1}. ${a}`, MARGIN + 6, y + 4, { width: 500 });
      y += 16;
    });
    y += 4;
  }

  drawSection("IMPACT ASSESSMENT", [
    ["Cost Impact", rfi.costImpact],
    ["Cost Impact Amount", rfi.costImpact === "Cost Increase Known" ? rfi.costImpactAmount : undefined],
    ["Schedule Impact", rfi.scheduleImpact],
    ["Schedule Impact Days", rfi.scheduleImpactDays != null ? `${rfi.scheduleImpactDays} calendar days` : undefined],
  ]);

  const distList = (rfi.distributionList as string[] | null) || [];
  if (distList.length > 0) {
    addPageIfNeeded(24 + distList.length * 14);
    doc.rect(MARGIN, y, 512, 18).fill("#F1F5F9");
    doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("DISTRIBUTION LIST", MARGIN + 6, y + 5);
    y += 18;
    distList.forEach((entry, i) => {
      doc.fontSize(9).fillColor("black").font("Helvetica").text(`${i + 1}. ${entry}`, MARGIN + 6, y + 4, { width: 500 });
      y += 14;
    });
    y += 4;
  }

  const hasResponse = !!(rfi.answer || rfi.response);
  const responseText = rfi.answer || rfi.response || "";
  const estimatedRespH = hasResponse
    ? Math.min(Math.max(doc.heightOfString(responseText, { width: 500 }) + 60, 80), 300)
    : 100;
  addPageIfNeeded(estimatedRespH + 30);
  doc.rect(MARGIN, y, 512, 18).fill("#0F4C75");
  doc.fillColor("white").fontSize(8).font("Helvetica-Bold").text("OFFICIAL RESPONSE", MARGIN + 6, y + 5);
  doc.fillColor("black");
  y += 18;
  if (hasResponse) {
    const beforeAns = y;
    doc.fontSize(10).fillColor("black").font("Helvetica")
      .text(responseText, MARGIN + 6, y + 6, { width: 500 });
    const ansH = doc.heightOfString(responseText, { width: 500 }) + 18;
    doc.rect(MARGIN, beforeAns, 512, ansH).stroke("#E2E8F0");
    y = beforeAns + ansH + 4;

    doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold")
      .text("ANSWERED BY", MARGIN + 6, y + 4)
      .text("DATE ANSWERED", 306, y + 4);
    doc.fontSize(10).fillColor("black").font("Helvetica")
      .text(val(rfi.answeredBy), MARGIN + 6, y + 14)
      .text(fmtD(rfi.dateAnswered || rfi.respondedAt), 306, y + 14);
    doc.moveTo(MARGIN, y + 32).lineTo(MARGIN + 512, y + 32).stroke("#E2E8F0");
    y += 36;

    const respAtts = (rfi.responseAttachmentsJson as string[] | null) || [];
    if (respAtts.length > 0) {
      addPageIfNeeded(24 + respAtts.length * 14);
      doc.rect(MARGIN, y, 512, 18).fill("#F1F5F9");
      doc.fillColor("#1E3A5F").fontSize(8).font("Helvetica-Bold").text("RESPONSE DOCUMENTS", MARGIN + 6, y + 5);
      y += 18;
      respAtts.forEach((a, i) => {
        doc.fontSize(9).fillColor("#1D4ED8").font("Helvetica").text(`${i + 1}. ${a}`, MARGIN + 6, y + 4, { width: 500 });
        y += 14;
      });
      y += 4;
    }
  } else {
    // Blank response section for external parties to fill in
    doc.rect(MARGIN, y, 512, 18).fill("#F8FAFC");
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("RESPONSE TEXT", MARGIN + 6, y + 5);
    y += 18;
    doc.rect(MARGIN, y, 512, 60).stroke("#E2E8F0");
    y += 64;

    doc.fontSize(7).fillColor("#64748B").font("Helvetica-Bold")
      .text("ANSWERED BY", MARGIN + 6, y + 4)
      .text("DATE ANSWERED", 200, y + 4)
      .text("COST IMPACT", 360, y + 4)
      .text("SCHEDULE IMPACT", 460, y + 4);
    doc.moveTo(MARGIN, y + 14).lineTo(MARGIN + 512, y + 14).stroke("#E2E8F0");
    doc.moveTo(MARGIN, y + 32).lineTo(MARGIN + 512, y + 32).stroke("#E2E8F0");
    y += 36;
  }

  drawFooter(doc, `Generated by BIMLog by IgniteSmart  |  ${rfi.number}  |  ${new Date().toLocaleDateString()}`);

  return y;
}

// ─── RFI Log PDF (summary table, landscape) ──────────────────────────────────
const LOG_W = 792;   // landscape width
const LOG_H = 612;   // landscape height
const LOG_MARGIN = 36;
const LOG_CONTENT_W = LOG_W - LOG_MARGIN * 2;
const LOG_CONTENT_BOTTOM = LOG_H - 50;

function makeRfiLogPdf(
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

  // Column definitions: [header, width, getter]
  const cols: [string, number, (r: typeof rfisTable.$inferSelect) => string][] = [
    ["RFI #",       54,  r => r.number],
    ["Subject",     130, r => r.subject],
    ["Status",      52,  r => (r.status || "").replace("_", " ")],
    ["Priority",    46,  r => r.priority || "—"],
    ["Submitted By",72,  r => r.submittedByCompany || creatorMap.get(r.createdById) || "—"],
    ["Submitted To",72,  r => r.submittedToCompany || r.submittedToPerson || "—"],
    ["Date Req.",   50,  r => fmtD(r.dateRequested || r.createdAt)],
    ["Date Req'd",  50,  r => fmtD(r.dateRequired || r.dueDate)],
    ["Days Out",    42,  r => String(daysSince(r.createdAt))],
    ["Ball in Court",72, r => getBic(r)],
    ["Sched. Impact",62, r => r.scheduleImpact || "—"],
  ];

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

  // Draw header row
  const drawHeader = (atY: number) => {
    doc.rect(LOG_MARGIN, atY, LOG_CONTENT_W, 16).fill("#334155");
    let cx = LOG_MARGIN;
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
    // estimate row height
    const subjectH = Math.min(doc.heightOfString(rfi.subject, { width: 127 }), 30);
    const rowH = Math.max(subjectH + 8, 18);

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

    // draw gridlines
    let cx = LOG_MARGIN;
    cols.forEach(([, colW, getter], ci) => {
      const cellText = getter(rfi);
      const textColor = ci === 0 ? "#1D4ED8" : ci === 2
        ? (rfi.status === "closed" ? "#16A34A" : rfi.status === "responded" ? "#7C3AED" : "#D97706")
        : "#1E293B";

      doc.fontSize(6.5).fillColor(textColor).font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
        .text(cellText, cx + 3, y + 4, { width: colW - 6, lineBreak: false });

      doc.moveTo(cx + colW, y).lineTo(cx + colW, y + rowH).stroke("#E2E8F0");
      cx += colW;
    });

    // horizontal rule
    doc.moveTo(LOG_MARGIN, y + rowH).lineTo(LOG_MARGIN + LOG_CONTENT_W, y + rowH).stroke("#E2E8F0");
    // left border
    doc.moveTo(LOG_MARGIN, y).lineTo(LOG_MARGIN, y + rowH).stroke("#E2E8F0");

    y += rowH;
    rowIndex++;
  }

  // outer border
  drawLogFooter(pageNum);
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
      doc.fontSize(6.5).fillColor(textColor).font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
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
    const number = `RFI-${String((rfiCount.count as number) + 1).padStart(4, "0")}`;

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

    const [newRfi] = await db.insert(rfisTable).values({
      projectId,
      number: newNumber,
      subject: orig.subject,
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

// ─── GET /projects/:projectId/rfis/:rfiId/export  (single PDF) ──────────────
router.get("/projects/:projectId/rfis/:rfiId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const creator = await db.select().from(usersTable).where(eq(usersTable.id, rfi.createdById)).limit(1);

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

    makeRfiPdf(doc, rfi, project, creator[0]?.fullName || "", MARGIN, true);
    doc.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── GET /projects/:projectId/rfis/export-all  (RFI log or summary) ──────────
router.get("/projects/:projectId/rfis/export-all", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });
    const isList = req.query.view === "list";

    const rfis = await db.query.rfisTable.findMany({
      where: eq(rfisTable.projectId, projectId),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    if (rfis.length === 0) {
      res.status(404).json({ error: "No RFIs found" });
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const creatorMap = new Map<number, string>();
    for (const rfi of rfis) {
      if (!creatorMap.has(rfi.createdById)) {
        const creator = await db.select().from(usersTable).where(eq(usersTable.id, rfi.createdById)).limit(1);
        creatorMap.set(rfi.createdById, creator[0]?.fullName || "—");
      }
    }

    const docOptions = isList
      ? { margin: MARGIN, size: "LETTER" as const, autoFirstPage: true }
      : { margin: LOG_MARGIN, size: "LETTER" as const, layout: "landscape" as const, autoFirstPage: true };

    const doc = new PDFDocument(docOptions);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      const label = isList ? "RFI-Summary" : "RFI-Log";
      res.setHeader("Content-Disposition", `attachment; filename="${label}-${project?.name || projectId}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    if (isList) {
      makeRfiListPdf(doc, rfis, project, creatorMap);
    } else {
      makeRfiLogPdf(doc, rfis, project, creatorMap);
    }
    doc.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── GET /projects/:projectId/rfis/:rfiId/export-response  (Response PDF) ────
router.get("/projects/:projectId/rfis/:rfiId/export-response", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });

    const [rfi] = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (!rfi) { res.status(404).json({ error: "RFI not found" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    // Fix 7 — Build filename following project naming convention
    let responseFileName = `${rfi.number}-Response`;
    try {
      const conventions = await db.select().from(namingConventionsTable)
        .where(and(eq(namingConventionsTable.projectId, projectId), eq(namingConventionsTable.isActive, true)))
        .limit(1);
      if (conventions.length > 0) {
        const sep = conventions[0].separator;
        const fields = await db.select().from(namingFieldsTable)
          .where(eq(namingFieldsTable.conventionId, conventions[0].id))
          .orderBy(namingFieldsTable.fieldOrder);
        const parts: string[] = [];
        for (const field of fields) {
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
    } catch { /* fallback to default */ }

    const fmtD = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${responseFileName}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    let y = MARGIN;

    // Header bar
    doc.rect(MARGIN, y, LETTER_WIDTH - MARGIN * 2, 36).fill("#0F4C75");
    doc.fillColor("white").fontSize(14).font("Helvetica-Bold")
      .text("OFFICIAL RESPONSE DOCUMENT", MARGIN + 10, y + 6, { lineBreak: false });
    doc.fontSize(9).font("Helvetica")
      .text(`${rfi.number}  |  ${project?.name || ""}`, MARGIN + 10, y + 23, { lineBreak: false });
    doc.fillColor("black");
    y += 44;

    // RFI info rows (2 cols)
    const half = (LETTER_WIDTH - MARGIN * 2) / 2 - 2;
    const drawInfoRow = (l1: string, v1: string, l2: string, v2: string) => {
      const lw = half * 0.38;
      doc.rect(MARGIN, y, lw, 16).fill("#F1F5F9");
      doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold")
        .text(l1.toUpperCase(), MARGIN + 3, y + 4.5, { width: lw - 4, lineBreak: false });
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica")
        .text(v1, MARGIN + lw + 3, y + 4.5, { width: half - lw - 6, lineBreak: false });

      const col2x = MARGIN + half + 4;
      doc.rect(col2x, y, lw, 16).fill("#F1F5F9");
      doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold")
        .text(l2.toUpperCase(), col2x + 3, y + 4.5, { width: lw - 4, lineBreak: false });
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica")
        .text(v2, col2x + lw + 3, y + 4.5, { width: half - lw - 6, lineBreak: false });
      y += 16;
    };

    drawInfoRow("RFI #", rfi.number, "Subject", rfi.subject);
    drawInfoRow("Status", (rfi.status || "").replace("_", " "), "Priority", rfi.priority || "—");
    drawInfoRow("Date Requested", fmtD(rfi.dateRequested || rfi.createdAt), "Date Required", fmtD(rfi.dateRequired || rfi.dueDate));
    drawInfoRow("Submitted By", `${rfi.submittedByCompany || "—"} / ${rfi.submittedByContact || "—"}`, "Submitted To", `${rfi.submittedToCompany || "—"} / ${rfi.submittedToPerson || "—"}`);
    drawInfoRow("Drawing #", rfi.drawingNumber || "—", "Spec Section", rfi.specSection || "—");
    y += 6;

    // Question section
    const contentW = LETTER_WIDTH - MARGIN * 2;
    doc.rect(MARGIN, y, contentW, 14).fill("#E2E8F0");
    doc.fillColor("#1E3A5F").fontSize(7.5).font("Helvetica-Bold").text("DESCRIPTION OF QUESTION", MARGIN + 6, y + 3.5);
    y += 14;
    const questionText = rfi.question || rfi.description || "No description provided.";
    const questionH = Math.min(doc.heightOfString(questionText, { width: contentW - 12 }) + 12, 120);
    doc.rect(MARGIN, y, contentW, questionH).stroke("#E2E8F0");
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(questionText, MARGIN + 6, y + 6, { width: contentW - 12 });
    y += questionH + 8;

    // Official Response section
    doc.rect(MARGIN, y, contentW, 14).fill("#0F4C75");
    doc.fillColor("white").fontSize(7.5).font("Helvetica-Bold").text("OFFICIAL RESPONSE", MARGIN + 6, y + 3.5);
    y += 14;

    const respText = rfi.answer || rfi.response || "";
    if (respText) {
      const respH = Math.min(doc.heightOfString(respText, { width: contentW - 12 }) + 12, 160);
      doc.rect(MARGIN, y, contentW, respH).fillAndStroke("#F0FDF4", "#86EFAC");
      doc.fillColor("#14532D").fontSize(9).font("Helvetica").text(respText, MARGIN + 6, y + 6, { width: contentW - 12 });
      y += respH + 6;
    } else {
      doc.rect(MARGIN, y, contentW, 80).stroke("#E2E8F0");
      y += 84;
    }

    // Signature row
    const sigLabels = ["ANSWERED BY", "DATE OF RESPONSE", "COST IMPACT", "SCHEDULE IMPACT"];
    const sigVals = [
      rfi.answeredBy || (respText ? "—" : ""),
      fmtD(rfi.dateAnswered || rfi.respondedAt),
      rfi.costImpact || (respText ? "—" : ""),
      rfi.scheduleImpact ? `${rfi.scheduleImpact}${rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays}d)` : ""}` : (respText ? "—" : ""),
    ];
    const segW = contentW / 4;
    doc.rect(MARGIN, y, contentW, 14).fill("#F1F5F9");
    sigLabels.forEach((lbl, i) => {
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold")
        .text(lbl, MARGIN + i * segW + 4, y + 3.5, { width: segW - 6, lineBreak: false });
    });
    y += 14;
    doc.rect(MARGIN, y, contentW, 20).stroke("#E2E8F0");
    sigVals.forEach((val, i) => {
      if (val) {
        doc.fillColor("#1E293B").fontSize(8.5).font("Helvetica")
          .text(val, MARGIN + i * segW + 4, y + 5, { width: segW - 8, lineBreak: false });
      }
      if (i < 3) doc.moveTo(MARGIN + (i + 1) * segW, y).lineTo(MARGIN + (i + 1) * segW, y + 20).stroke("#E2E8F0");
    });
    y += 24;

    drawFooter(doc, `BIMLog by IgniteSmart  |  ${rfi.number} — Official Response  |  ${new Date().toLocaleDateString()}`);
    doc.end();

    // Log in activity
    db.insert(activityLogTable).values({
      projectId,
      userId: 0,
      userFullName: "System",
      userCompanyName: "",
      actionType: "export",
      entityType: "rfi",
      entityId: rfiId,
      details: `Response PDF generated: ${responseFileName}.pdf`,
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

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const prompt = `You are a senior construction project manager responding to an RFI (Request for Information) on behalf of the design or engineering team. Draft a professional, formal official response to the following RFI.

Project: ${project?.name || "Construction Project"}
RFI Number: ${rfi.number}
Subject: ${rfi.subject}
${rfi.drawingNumber ? `Drawing Number: ${rfi.drawingNumber}` : ""}
${rfi.specSection ? `Spec Section: ${rfi.specSection}` : ""}
${rfi.locationDescription ? `Location: ${rfi.locationDescription}` : ""}
${rfi.costImpact ? `Cost Impact: ${rfi.costImpact}${rfi.costImpactAmount ? ` — ${rfi.costImpactAmount}` : ""}` : ""}
${rfi.scheduleImpact ? `Schedule Impact: ${rfi.scheduleImpact}${rfi.scheduleImpactDays ? ` — ${rfi.scheduleImpactDays} days` : ""}` : ""}

Description of Question:
${rfi.question || rfi.description || "No question text provided."}

Write a professional official response that:
- Directly addresses the question with a clear, actionable answer
- Uses formal construction industry language
- Acknowledges any cost or schedule impact implications
- Is concise yet complete (2-4 paragraphs)
- Ends with a clear directive or clarification

Write only the response text itself, no headers or labels.`;

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
      // Column headers
      const cols = [64, 200, 180, contentW - 64 - 200 - 180 - 6];
      const colX = [MARGIN, MARGIN + 64, MARGIN + 264, MARGIN + 444];
      doc.rect(MARGIN, y, contentW, 14).fill("#E2E8F0");
      ["#", "Timestamp (UTC)", "User", "Company"].forEach((h, i) => {
        doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold")
          .text(h, colX[i] + 3, y + 3.5, { width: cols[i] - 4, lineBreak: false });
      });
      y += 14;

      viewEvents.forEach((evt, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(MARGIN, y, contentW, 14).fill(rowBg);
        const vals = [String(idx + 1), fmtTs(evt.viewedAt), evt.userFullName, evt.userCompanyName];
        vals.forEach((v, i) => {
          doc.fillColor("#1E293B").fontSize(8).font("Helvetica")
            .text(v, colX[i] + 3, y + 3, { width: cols[i] - 4, lineBreak: false });
        });
        // vertical dividers
        [64, 264, 444].forEach(x => {
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
    const certH = 72;
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

    const fmtD = (d: Date | string | null | undefined) => {
      if (!d) return "—";
      const dt = typeof d === "string" ? new Date(d) : d;
      if (isNaN(dt.getTime())) return "—";
      return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    };

    // Helper: CheckBox row using SymbolRun (Wingdings font)
    const checkRow = (label: string, checked: boolean) => new Paragraph({
      spacing: { after: 60 },
      children: [
        new SymbolRun({ char: checked ? "FC" : "A8", symbolfont: "Wingdings", size: 20 }),
        new TextRun({ text: `  ${label}`, size: 18 }),
      ],
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

    // Build cost impact checkbox section
    const costOpts = ["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"];
    const costCheckboxes = costOpts.map(opt => {
      const isChecked = rfi.costImpact === opt;
      const label = opt === "Cost Increase Known" && rfi.costImpactAmount
        ? `${opt}: ${rfi.costImpactAmount}`
        : opt;
      return checkRow(label, isChecked);
    });

    // Build schedule impact checkbox section
    const schedOpts = ["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"];
    const schedCheckboxes = schedOpts.map(opt => {
      const isChecked = rfi.scheduleImpact === opt;
      const label = opt !== "No Schedule Impact" && rfi.scheduleImpactDays != null
        ? `${opt}: ${rfi.scheduleImpactDays} days`
        : opt;
      return checkRow(label, isChecked);
    });

    // Build attachment checkbox section
    const attachOpts = ["See marked up drawings", "See attached specifications", "See attached schedules", "None"];
    const attachCheckboxes = attachOpts.map(opt => checkRow(opt, false));

    const hasResp = responses.length > 0 || !!(rfi.answer || rfi.response);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 200 },
            children: [new TextRun({ text: `REQUEST FOR INFORMATION — ${rfi.number}`, bold: true, size: 36, color: "1E3A5F" })],
          }),

          // Header table
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
            children: [new TextRun({ text: rfi.question || rfi.description || "—", size: 20 })],
          }),

          sectionHeader("Official Response"),
          ...(hasResp ? [
            ...(responses.length > 0 ? responses.flatMap((resp, i) => [
              new Paragraph({
                spacing: { before: 120, after: 60 },
                children: [new TextRun({ text: `Response ${resp.responseNumber ?? (i + 1)} — ${resp.answeredBy || ""}`, bold: true, size: 20 })],
              }),
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: resp.responseText, size: 20 })],
              }),
              ...(resp.isConflictOfInterest ? [
                new Paragraph({
                  spacing: { after: 80 },
                  children: [new TextRun({ text: "⚠ CONFLICT OF INTEREST — Logged in audit trail", bold: true, size: 18, color: "92400E" })],
                }),
              ] : []),
            ]) : [
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: rfi.answer || rfi.response || "", size: 20 })],
              }),
            ]),

            // Response metadata table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "COST IMPACT", bold: true, size: 16, color: "64748B" })] }),
                        ...costCheckboxes,
                      ],
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "SCHEDULE IMPACT", bold: true, size: 16, color: "64748B" })] }),
                        ...schedCheckboxes,
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "ATTACHMENTS", bold: true, size: 16, color: "64748B" })] }),
                        ...attachCheckboxes,
                      ],
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "ANSWERED BY", bold: true, size: 16, color: "64748B" })] }),
                        new Paragraph({ children: [new TextRun({ text: responses.length > 0 ? (responses[responses.length - 1].answeredBy || "—") : (rfi.answeredBy || "—"), size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: "DATE OF RESPONSE", bold: true, size: 16, color: "64748B" })] }),
                        new Paragraph({ children: [new TextRun({ text: fmtD(rfi.dateAnswered || rfi.respondedAt), size: 18 })] }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ] : [
            // Blank response section
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: "(No response provided)", size: 18, color: "94A3B8" })],
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
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "COST IMPACT", bold: true, size: 16, color: "64748B" })] }),
                        checkRow("No Cost Impact", false),
                        checkRow("Cost Increase TBD", false),
                        checkRow("Cost Increase Known: $__________", false),
                        checkRow("Cost Decrease", false),
                      ],
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "SCHEDULE IMPACT", bold: true, size: 16, color: "64748B" })] }),
                        checkRow("No Schedule Impact", false),
                        checkRow("Increase in Calendar Days: _______", false),
                        checkRow("Decrease in Calendar Days: _______", false),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "ATTACHMENTS", bold: true, size: 16, color: "64748B" })] }),
                        checkRow("See marked up drawings", false),
                        checkRow("See attached specifications", false),
                        checkRow("See attached schedules", false),
                        checkRow("None", false),
                      ],
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "SIGNATURE", bold: true, size: 16, color: "64748B" })] }),
                        new Paragraph({ children: [new TextRun({ text: "Name: ________________________________", size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Title: ________________________________", size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Company: ________________________________", size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Date: ________________________________", size: 18 })] }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ]),

          new Paragraph({
            spacing: { before: 300 },
            children: [new TextRun({ text: `Generated by BIMLog by IgniteSmart | ${rfi.number} | ${new Date().toLocaleDateString()}`, size: 14, color: "94A3B8" })],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${rfi.number}.docx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
