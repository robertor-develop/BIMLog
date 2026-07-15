import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { addPageNumbers, computeContentHash, PALETTE, REPORT_THEMES } from "./pdf-kit";

const PDF_MARGIN = 46;
const PDF_BOTTOM = 724;
const PDF_CONTENT_WIDTH = 612 - PDF_MARGIN * 2;
const DOCX_CONTENT_WIDTH = 9360;
const EMPTY_VALUE = "Not recorded";

export type RfiExportImage = {
  buffer: Buffer;
  type: "png" | "jpg";
  width: number;
  height: number;
  fileName: string;
  kind: "viewpoint" | "upload" | "paste" | "screen-snip";
  crop: { x: number; y: number; width: number; height: number } | null;
};

export type RfiExportSource = {
  id: number;
  number: string;
  subject: string;
  rfiType?: string | null;
  status?: string | null;
  priority?: string | null;
  revisionNumber?: number | null;
  sendStatus?: string | null;
  sentAt?: Date | string | null;
  createdAt: Date | string;
  dateRequested?: Date | string | null;
  dateRequired?: Date | string | null;
  dueDate?: Date | string | null;
  dateAnswered?: Date | string | null;
  respondedAt?: Date | string | null;
  closedAt?: Date | string | null;
  reopenedAt?: Date | string | null;
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
  answer?: string | null;
  response?: string | null;
  answeredBy?: string | null;
};

export type RfiResponseExportSource = {
  id: number;
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
  createdAt: Date | string;
  isConflictOfInterest?: boolean | null;
};

export type CanonicalRfiExportModel = {
  generatedAt: string;
  project: { name: string; code: string; address: string };
  header: {
    number: string;
    subject: string;
    type: string;
    priority: string;
    revision: string;
    status: string;
    lifecycleState: string;
    dateRequested: string;
    dateRequired: string;
    dateAnswered: string;
    daysOutstanding: string;
    ballInCourt: string;
  };
  submittedBy: { company: string; person: string; email: string; phone: string; address: string };
  submittedTo: { company: string; person: string; email: string; phone: string; address: string };
  references: {
    drawingNumber: string;
    drawingTitle: string;
    specificationSection: string;
    detailNumber: string;
    noteNumber: string;
    location: string;
    projectAddress: string;
    sourceViewpoint: string;
    manualReferences: string[];
    attachments: string[];
    image: { name: string; kind: string } | null;
  };
  question: string;
  impact: {
    cost: string;
    costAmount: string;
    costReason: string;
    schedule: string;
    scheduleDays: string;
    scheduleReason: string;
  };
  distribution: Array<{ name: string; email: string; phone: string; company: string; display: string }>;
  email: { description: string; draft: string };
  responses: Array<{
    number: number;
    responder: string;
    responderEmail: string;
    responderCompany: string;
    date: string;
    text: string;
    attachments: string[];
    cost: string;
    costAmount: string;
    costReason: string;
    schedule: string;
    scheduleDays: string;
    scheduleReason: string;
    closingStatus: string;
  }>;
};

export type RfiAuditEventSource = {
  actionType: string;
  userFullName: string;
  userCompanyName?: string | null;
  details?: string | null;
  createdAt: Date | string;
};

export type RfiCustodySource = {
  heldBy: string;
  heldByCompany: string;
  fromDate: Date | string;
  toDate?: Date | string | null;
  daysHeld?: number | null;
};

export type RfiViewEventSource = {
  userFullName: string;
  userCompanyName: string;
  viewedAt: Date | string;
};

export type RfiAuditModel = {
  events: Array<{ timestamp: string; actor: string; company: string; action: string; summary: string; changes: string[]; category: string }>;
  categoryCounts: Array<{ category: string; count: number }>;
  custody: Array<{ holder: string; company: string; from: string; to: string; days: string }>;
  responseHistory: Array<{ response: string; responder: string; date: string; status: string }>;
  views: Array<{ timestamp: string; actor: string; company: string }>;
};

type DirectoryRecipient = { name: string; email: string; phone?: string; company?: string };

function cleanText(value: unknown, fallback = EMPTY_VALUE): string {
  if (value == null) return fallback;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text || /^(?:undefined|null|\[object Object\])$/i.test(text)) return fallback;
  return text;
}

function preserveText(value: unknown, fallback = EMPTY_VALUE): string {
  if (value == null) return fallback;
  const text = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return text && !/^(?:undefined|null|\[object Object\])$/i.test(text) ? text : fallback;
}

function dateValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date | string | null | undefined): string {
  const date = dateValue(value);
  return date ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : EMPTY_VALUE;
}

function formatTimestamp(value: Date | string | null | undefined): string {
  const date = dateValue(value);
  return date ? date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : EMPTY_VALUE;
}

function humanize(value: unknown): string {
  const text = cleanText(value, "");
  if (!text) return EMPTY_VALUE;
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function lifecycleState(rfi: RfiExportSource): string {
  if (String(rfi.status || "").toLowerCase() === "closed") return "Closed";
  const reopened = dateValue(rfi.reopenedAt);
  const closed = dateValue(rfi.closedAt);
  if (reopened && (!closed || reopened.getTime() > closed.getTime())) return "Reopened";
  if ((rfi.revisionNumber || 0) > 0) return "Revised";
  if (rfi.sendStatus === "sent" || rfi.sentAt) return "Sent";
  return "Draft";
}

function daysOutstanding(rfi: RfiExportSource, generatedAt: Date): string {
  const start = dateValue(rfi.dateRequested || rfi.createdAt);
  if (!start) return EMPTY_VALUE;
  const end = dateValue(rfi.dateAnswered || rfi.respondedAt || rfi.closedAt) || generatedAt;
  return String(Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000)));
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return ""; }
}

function parseDistribution(entry: string, directory: Map<string, DirectoryRecipient>) {
  const trimmed = String(entry || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("EXT:")) {
    const parts = trimmed.slice(4).split(":");
    const name = cleanText(safeDecode(parts[0] || ""), "");
    const email = cleanText(safeDecode(parts[1] || ""), "").toLowerCase();
    const phone = cleanText(safeDecode(parts.slice(2).join(":") || ""), "");
    if (!name && !email && !phone) return null;
    const display = [name, email ? `<${email}>` : "", phone].filter(Boolean).join(" | ");
    return { name, email, phone, company: "", display };
  }
  const email = trimmed.toLowerCase();
  const match = directory.get(email);
  const name = cleanText(match?.name, "");
  const company = cleanText(match?.company, "");
  const phone = cleanText(match?.phone, "");
  const display = match ? `${name || email}${company ? ` - ${company}` : ""} <${match.email}>` : email;
  return { name, email: match?.email || email, phone, company, display };
}

export function buildCanonicalRfiExportModel(input: {
  rfi: RfiExportSource;
  responses: RfiResponseExportSource[];
  project: { name?: string | null; code?: string | null; location?: string | null };
  manualReferences: string[];
  attachments: string[];
  responseAttachments: Map<number, string[]>;
  directoryRecipients?: DirectoryRecipient[];
  image?: RfiExportImage | null;
  generatedAt?: Date;
}): CanonicalRfiExportModel {
  const { rfi } = input;
  const generatedAt = input.generatedAt || new Date();
  const directory = new Map((input.directoryRecipients || []).map(item => [item.email.toLowerCase(), item]));
  const distribution = (rfi.distributionList || []).map(entry => parseDistribution(entry, directory)).filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const state = lifecycleState(rfi);
  const ballInCourt = cleanText(rfi.ballInCourt, "") || (state === "Closed" ? "No active custody" : state === "Draft"
    ? cleanText(rfi.submittedByContact || rfi.submittedByCompany || rfi.submittedByEmail)
    : cleanText(rfi.submittedToPerson || rfi.submittedToCompany || rfi.submittedToEmail));
  const projectAddress = cleanText(rfi.projectAddress || input.project.location);

  const responses = [...input.responses].sort((a, b) => a.responseNumber - b.responseNumber).map(response => ({
    number: response.responseNumber,
    responder: cleanText(response.answeredBy),
    responderEmail: cleanText(response.answeredByEmail),
    responderCompany: cleanText(response.answeredByCompany),
    date: formatDate(response.createdAt),
    text: preserveText(response.responseText),
    attachments: input.responseAttachments.get(response.id) || [],
    cost: cleanText(response.costImpact),
    costAmount: cleanText(response.costImpactAmount),
    costReason: cleanText(response.costImpactReason),
    schedule: cleanText(response.scheduleImpact),
    scheduleDays: response.scheduleImpactDays == null ? EMPTY_VALUE : String(response.scheduleImpactDays),
    scheduleReason: cleanText(response.scheduleImpactReason),
    closingStatus: String(rfi.status || "").toLowerCase() === "closed" && response.responseNumber === Math.max(...input.responses.map(item => item.responseNumber), 0) ? "Closed RFI" : "Response recorded",
  }));
  if (responses.length === 0 && (rfi.answer || rfi.response)) {
    responses.push({
      number: 1,
      responder: cleanText(rfi.answeredBy), responderEmail: EMPTY_VALUE, responderCompany: EMPTY_VALUE,
      date: formatDate(rfi.dateAnswered || rfi.respondedAt), text: preserveText(rfi.answer || rfi.response), attachments: [],
      cost: cleanText(rfi.costImpact), costAmount: cleanText(rfi.costImpactAmount), costReason: cleanText(rfi.costImpactReason),
      schedule: cleanText(rfi.scheduleImpact), scheduleDays: rfi.scheduleImpactDays == null ? EMPTY_VALUE : String(rfi.scheduleImpactDays),
      scheduleReason: cleanText(rfi.scheduleImpactReason), closingStatus: state === "Closed" ? "Closed RFI" : "Response recorded",
    });
  }

  return {
    generatedAt: generatedAt.toISOString(),
    project: { name: cleanText(input.project.name), code: cleanText(input.project.code), address: projectAddress },
    header: {
      number: cleanText(rfi.number), subject: cleanText(rfi.subject), type: cleanText(rfi.rfiType), priority: humanize(rfi.priority),
      revision: (rfi.revisionNumber || 0) > 0 ? `Revision ${rfi.revisionNumber}` : "Original issue",
      status: humanize(rfi.status), lifecycleState: state,
      dateRequested: formatDate(rfi.dateRequested || rfi.createdAt), dateRequired: formatDate(rfi.dateRequired || rfi.dueDate),
      dateAnswered: formatDate(rfi.dateAnswered || rfi.respondedAt), daysOutstanding: daysOutstanding(rfi, generatedAt), ballInCourt,
    },
    submittedBy: {
      company: cleanText(rfi.submittedByCompany), person: cleanText(rfi.submittedByContact), email: cleanText(rfi.submittedByEmail),
      phone: cleanText(rfi.submittedByPhone), address: cleanText(rfi.submittedByAddress),
    },
    submittedTo: {
      company: cleanText(rfi.submittedToCompany), person: cleanText(rfi.submittedToPerson), email: cleanText(rfi.submittedToEmail),
      phone: EMPTY_VALUE, address: EMPTY_VALUE,
    },
    references: {
      drawingNumber: cleanText(rfi.drawingNumber), drawingTitle: cleanText(rfi.drawingTitle), specificationSection: cleanText(rfi.specSection),
      detailNumber: cleanText(rfi.detailNumber), noteNumber: cleanText(rfi.noteNumber), location: cleanText(rfi.locationDescription),
      projectAddress, sourceViewpoint: cleanText(rfi.sourceViewpointLabel), manualReferences: input.manualReferences,
      attachments: input.attachments, image: input.image ? { name: cleanText(input.image.fileName), kind: humanize(input.image.kind) } : null,
    },
    question: preserveText(rfi.question || rfi.description),
    impact: {
      cost: cleanText(rfi.costImpact), costAmount: cleanText(rfi.costImpactAmount), costReason: cleanText(rfi.costImpactReason),
      schedule: cleanText(rfi.scheduleImpact), scheduleDays: rfi.scheduleImpactDays == null ? EMPTY_VALUE : String(rfi.scheduleImpactDays),
      scheduleReason: cleanText(rfi.scheduleImpactReason),
    },
    distribution,
    email: { description: preserveText(rfi.emailDescription), draft: preserveText(rfi.emailDraft) },
    responses,
  };
}

function splitLongWord(doc: PDFKit.PDFDocument, word: string, width: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    if (current && doc.widthOfString(current + character) > width) { parts.push(current); current = character; }
    else current += character;
  }
  if (current) parts.push(current);
  return parts;
}

function wrappedLines(doc: PDFKit.PDFDocument, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of preserveText(text).split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const rawWord of paragraph.trim().split(/\s+/)) {
      const words = doc.widthOfString(rawWord) > width ? splitLongWord(doc, rawWord, width) : [rawWord];
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && doc.widthOfString(candidate) > width) { lines.push(line); line = word; }
        else line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [EMPTY_VALUE];
}

class PdfFlow {
  y = 0;
  private first = true;
  constructor(private readonly doc: PDFKit.PDFDocument, private readonly title: string, private readonly project: string, private readonly number: string) {
    this.startPage();
  }

  private startPage() {
    if (!this.first) this.doc.addPage();
    this.first = false;
    this.doc.page.margins.bottom = 0;
    this.doc.rect(0, 0, this.doc.page.width, 54).fill(REPORT_THEMES.rfi.detail.dark);
    this.doc.fillColor("white").font(PALETTE.FONT_BOLD).fontSize(15).text("BIMLog", PDF_MARGIN, 14, { lineBreak: false });
    this.doc.fontSize(10).text(this.title, PDF_MARGIN, 15, { width: PDF_CONTENT_WIDTH, align: "right", lineBreak: false });
    this.doc.fillColor("#DCE7F3").font(PALETTE.FONT).fontSize(8).text(`${this.project} | ${this.number}`, PDF_MARGIN, 36, { width: PDF_CONTENT_WIDTH, lineBreak: false });
    this.y = 68;
  }

  ensure(height: number) { if (this.y + height > PDF_BOTTOM) this.startPage(); }

  section(number: string, label: string) {
    this.ensure(30);
    this.doc.rect(PDF_MARGIN, this.y, PDF_CONTENT_WIDTH, 22).fill(REPORT_THEMES.rfi.detail.primary);
    this.doc.fillColor("white").font(PALETTE.FONT_BOLD).fontSize(10).text(`${number}. ${label}`, PDF_MARGIN + 8, this.y + 6, { lineBreak: false });
    this.y += 29;
  }

  subheading(label: string) {
    this.ensure(22);
    this.doc.fillColor(REPORT_THEMES.rfi.detail.dark).font(PALETTE.FONT_BOLD).fontSize(9).text(label, PDF_MARGIN, this.y + 2, { width: PDF_CONTENT_WIDTH });
    this.y += 17;
  }

  paragraph(text: string, options: { fontSize?: number; color?: string; leftRule?: boolean } = {}) {
    const size = options.fontSize || 9;
    const lineHeight = size + 3;
    const x = PDF_MARGIN + (options.leftRule ? 8 : 0);
    const width = PDF_CONTENT_WIDTH - (options.leftRule ? 8 : 0);
    this.doc.font(PALETTE.FONT).fontSize(size);
    const lines = wrappedLines(this.doc, text, width);
    for (const line of lines) {
      this.ensure(lineHeight + 2);
      if (options.leftRule) this.doc.rect(PDF_MARGIN, this.y, 2, lineHeight).fill(REPORT_THEMES.rfi.detail.light);
      this.doc.fillColor(options.color || PALETTE.TEXT).font(PALETTE.FONT).fontSize(size).text(line || " ", x, this.y, { width, lineBreak: false });
      this.y += lineHeight;
    }
    this.y += 5;
  }

  keyValues(items: Array<[string, string]>) {
    for (let index = 0; index < items.length; index += 2) {
      const pairs = items.slice(index, index + 2);
      const cellWidth = PDF_CONTENT_WIDTH / 2;
      this.doc.font(PALETTE.FONT).fontSize(8.5);
      const lineSets = pairs.map(([, value]) => wrappedLines(this.doc, value, cellWidth - 16));
      const height = Math.max(33, ...lineSets.map(lines => 19 + lines.length * 11));
      this.ensure(height);
      pairs.forEach(([label], pairIndex) => {
        const x = PDF_MARGIN + pairIndex * cellWidth;
        this.doc.rect(x, this.y, cellWidth, height).fillAndStroke(pairIndex % 2 ? "#FFFFFF" : "#F8FAFC", PALETTE.BORDER);
        this.doc.fillColor(PALETTE.MUTED).font(PALETTE.FONT_BOLD).fontSize(7).text(label.toUpperCase(), x + 8, this.y + 6, { width: cellWidth - 16, lineBreak: false });
        lineSets[pairIndex].forEach((line, lineIndex) => this.doc.fillColor(PALETTE.TEXT).font(PALETTE.FONT).fontSize(8.5).text(line, x + 8, this.y + 18 + lineIndex * 11, { width: cellWidth - 16, lineBreak: false }));
      });
      this.y += height;
    }
    this.y += 7;
  }

  list(items: string[], emptyText: string) {
    if (!items.length) { this.paragraph(emptyText, { color: PALETTE.MUTED }); return; }
    items.forEach((item, index) => this.paragraph(`${index + 1}. ${item}`, { fontSize: 8.5 }));
  }

  image(image: RfiExportImage) {
    const crop = image.crop || { x: 0, y: 0, width: 1, height: 1 };
    const ratio = (image.width * crop.width) / (image.height * crop.height);
    let width = PDF_CONTENT_WIDTH;
    let height = width / ratio;
    if (height > 300) { height = 300; width = height * ratio; }
    this.ensure(height + 24);
    const x = PDF_MARGIN + (PDF_CONTENT_WIDTH - width) / 2;
    this.doc.save().rect(x, this.y, width, height).clip();
    this.doc.image(image.buffer, x - crop.x * (width / crop.width), this.y - crop.y * (height / crop.height), { width: width / crop.width, height: height / crop.height });
    this.doc.restore().rect(x, this.y, width, height).stroke(PALETTE.LINE);
    this.y += height + 8;
  }

  table(headers: string[], widths: number[], rows: string[][]) {
    const drawHeader = () => {
      this.ensure(22);
      let x = PDF_MARGIN;
      headers.forEach((header, index) => {
        this.doc.rect(x, this.y, widths[index], 18).fill(REPORT_THEMES.rfi.detail.dark);
        this.doc.fillColor("white").font(PALETTE.FONT_BOLD).fontSize(6.5).text(header.toUpperCase(), x + 4, this.y + 5, { width: widths[index] - 8, lineBreak: false });
        x += widths[index];
      });
      this.y += 18;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      this.doc.font(PALETTE.FONT).fontSize(7);
      const cellLines = row.map((value, index) => wrappedLines(this.doc, value, widths[index] - 8));
      const height = Math.max(22, ...cellLines.map(lines => lines.length * 9 + 8));
      if (this.y + height > PDF_BOTTOM) { this.startPage(); drawHeader(); }
      let x = PDF_MARGIN;
      row.forEach((_value, index) => {
        this.doc.rect(x, this.y, widths[index], height).fillAndStroke(rowIndex % 2 ? "#F8FAFC" : "#FFFFFF", PALETTE.BORDER);
        cellLines[index].forEach((line, lineIndex) => this.doc.fillColor(PALETTE.TEXT).font(PALETTE.FONT).fontSize(7).text(line, x + 4, this.y + 5 + lineIndex * 9, { width: widths[index] - 8, lineBreak: false }));
        x += widths[index];
      });
      this.y += height;
    });
    this.y += 7;
  }
}

function participantFields(participant: CanonicalRfiExportModel["submittedBy"]): Array<[string, string]> {
  return [["Company", participant.company], ["Person", participant.person], ["Email", participant.email], ["Phone", participant.phone], ["Address", participant.address]];
}

function reportTimestamp(model: CanonicalRfiExportModel): string {
  return `Generated ${formatTimestamp(model.generatedAt)}`;
}

export function renderCanonicalRfiPdf(doc: PDFKit.PDFDocument, model: CanonicalRfiExportModel, image: RfiExportImage | null): void {
  doc.info.Title = `${model.header.number} - Request for Information`;
  doc.info.Author = "BIMLog by IgniteSmart";
  doc.info.Subject = model.header.subject;
  doc.info.Keywords = "BIMLog, RFI, Request for Information, construction record";
  const flow = new PdfFlow(doc, "REQUEST FOR INFORMATION", model.project.name, model.header.number);
  flow.section("1", "Header / RFI Status");
  flow.keyValues([
    ["Project", model.project.name], ["Project Code", model.project.code], ["RFI Number", model.header.number], ["Revision", model.header.revision],
    ["Subject", model.header.subject], ["RFI Type", model.header.type], ["Current Status", model.header.status], ["Lifecycle State", model.header.lifecycleState],
    ["Priority", model.header.priority], ["Date Requested", model.header.dateRequested], ["Date Required", model.header.dateRequired], ["Date Answered", model.header.dateAnswered],
    ["Days Outstanding", model.header.daysOutstanding], ["Current Ball in Court", model.header.ballInCourt],
  ]);
  flow.section("2", "Submitted By"); flow.keyValues(participantFields(model.submittedBy));
  flow.section("3", "Submitted To"); flow.keyValues(participantFields(model.submittedTo));
  flow.section("4", "Reference Information / Attachments");
  flow.keyValues([
    ["Drawing Number", model.references.drawingNumber], ["Drawing Title", model.references.drawingTitle],
    ["Specification Section", model.references.specificationSection], ["Detail Number", model.references.detailNumber],
    ["Note Number", model.references.noteNumber], ["Location", model.references.location],
    ["Project Address", model.references.projectAddress], ["Source Viewpoint", model.references.sourceViewpoint],
  ]);
  flow.subheading("References"); flow.list(model.references.manualReferences, "No manual references recorded.");
  flow.subheading("Attachments"); flow.list(model.references.attachments, "No files attached.");
  if (image) { flow.subheading(`Displayed RFI Image - ${model.references.image?.name || image.fileName}`); flow.image(image); }
  flow.section("5", "Description of Question"); flow.paragraph(model.question, { leftRule: true });
  flow.section("6", "Impact Assessment");
  flow.keyValues([
    ["Cost Impact", model.impact.cost], ["Cost Amount", model.impact.costAmount], ["Cost Reason / Explanation", model.impact.costReason], ["Schedule Impact", model.impact.schedule],
    ["Calendar Days", model.impact.scheduleDays], ["Schedule Reason / Explanation", model.impact.scheduleReason],
  ]);
  flow.section("7", "Distribution / Email / Responses");
  flow.subheading("Distribution"); flow.list(model.distribution.map(item => item.display), "No distribution recipients recorded.");
  flow.subheading("Description of Email"); flow.paragraph(model.email.description, { color: model.email.description === EMPTY_VALUE ? PALETTE.MUTED : PALETTE.TEXT });
  flow.subheading("Email Draft"); flow.paragraph(model.email.draft, { color: model.email.draft === EMPTY_VALUE ? PALETTE.MUTED : PALETTE.TEXT });
  flow.subheading("Official Responses");
  if (!model.responses.length) flow.paragraph("No official responses recorded.", { color: PALETTE.MUTED });
  model.responses.forEach(response => {
    flow.subheading(`Response ${response.number} | ${response.responder} | ${response.date}`);
    flow.paragraph(response.text, { leftRule: true });
    flow.keyValues([
      ["Responder Email", response.responderEmail], ["Responder Company", response.responderCompany],
      ["Cost Impact", response.cost], ["Cost Amount", response.costAmount], ["Cost Reason", response.costReason], ["Schedule Impact", response.schedule],
      ["Calendar Days", response.scheduleDays], ["Schedule Reason", response.scheduleReason], ["Closing Status", response.closingStatus], ["Response Date", response.date],
    ]);
    flow.subheading(`Response ${response.number} Attachments`); flow.list(response.attachments, "No response attachments recorded.");
  });
  addPageNumbers(doc, {
    margin: PDF_MARGIN, footerY: 768, fingerprintY: 750, contentHash: computeContentHash(model),
    companyName: "BIMLog", projectName: model.project.name, reportNumber: model.header.number, timestamp: reportTimestamp(model),
    watermarkText: model.header.lifecycleState === "Draft" ? "DRAFT" : undefined,
  });
}

const DOCX_BORDER = { style: BorderStyle.SINGLE, size: 2, color: "D5DEE8" } as const;
const DOCX_BORDERS = { top: DOCX_BORDER, bottom: DOCX_BORDER, left: DOCX_BORDER, right: DOCX_BORDER, insideHorizontal: DOCX_BORDER, insideVertical: DOCX_BORDER };
const DOCX_CELL_MARGIN = { top: 90, bottom: 90, left: 120, right: 120 };

function docxCell(text: string, width: number, options: { bold?: boolean; fill?: string; color?: string; allowEmpty?: boolean } = {}) {
  const cellText = options.allowEmpty && text === "" ? " " : preserveText(text);
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders: DOCX_BORDERS, margins: DOCX_CELL_MARGIN,
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill } : undefined,
    children: cellText.split("\n").map(line => new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: line || " ", bold: options.bold, color: options.color, size: 18, font: "Arial" })] })),
  });
}

function docxKeyValueTable(items: Array<[string, string]>): Table {
  const rows: TableRow[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const left = items[index];
    const right = items[index + 1];
    rows.push(new TableRow({ children: [
      docxCell(left[0], 1800, { bold: true, fill: "EAF2FA", color: "173F6B" }),
      docxCell(left[1], 2880),
      docxCell(right?.[0] ?? "", 1800, { bold: true, fill: "EAF2FA", color: "173F6B", allowEmpty: !right }),
      docxCell(right?.[1] ?? "", 2880, { allowEmpty: !right }),
    ] }));
  }
  return new Table({ width: { size: DOCX_CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [1800, 2880, 1800, 2880], rows });
}

function docxSection(number: string, label: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 260, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: "2563A6" }, indent: { left: 120, right: 120 },
    children: [new TextRun({ text: `${number}. ${label}`, bold: true, color: "FFFFFF", size: 22, font: "Arial" })],
  });
}

function docxSubheading(label: string) {
  return new Paragraph({ keepNext: true, spacing: { before: 160, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "A8BDD2" } }, children: [new TextRun({ text: label, bold: true, color: "173F6B", size: 19, font: "Arial" })] });
}

function docxParagraphs(text: string, options: { muted?: boolean; indent?: number } = {}): Paragraph[] {
  return preserveText(text).split("\n").map(line => new Paragraph({ spacing: { after: 90, line: 280 }, indent: options.indent ? { left: options.indent } : undefined, children: [new TextRun({ text: line || " ", size: 19, color: options.muted ? "6B7280" : "111827", font: "Arial" })] }));
}

function docxList(items: string[], emptyText: string): Paragraph[] {
  if (!items.length) return docxParagraphs(emptyText, { muted: true });
  return items.map((item, index) => new Paragraph({ spacing: { after: 70 }, indent: { left: 240, hanging: 180 }, children: [new TextRun({ text: `${index + 1}. ${item}`, size: 18, font: "Arial" })] }));
}

function docxImage(image: RfiExportImage): Paragraph {
  const crop = image.crop || { x: 0, y: 0, width: 1, height: 1 };
  const ratio = (image.width * crop.width) / (image.height * crop.height);
  let width = 600;
  let height = width / ratio;
  if (height > 360) { height = 360; width = height * ratio; }
  const options = image.crop ? {
    type: "svg" as const,
    data: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x * image.width} ${crop.y * image.height} ${crop.width * image.width} ${crop.height * image.height}"><image href="data:image/${image.type === "jpg" ? "jpeg" : "png"};base64,${image.buffer.toString("base64")}" width="${image.width}" height="${image.height}"/></svg>`),
    fallback: { type: image.type, data: image.buffer }, transformation: { width, height },
    altText: { title: image.fileName, description: "Persisted RFI image presentation", name: image.fileName },
  } : { type: image.type, data: image.buffer, transformation: { width, height }, altText: { title: image.fileName, description: "Persisted RFI image presentation", name: image.fileName } };
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new ImageRun(options)] });
}

export function buildCanonicalRfiDocx(model: CanonicalRfiExportModel, image: RfiExportImage | null): Document {
  const children: Array<Paragraph | Table> = [
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "BIMLog", bold: true, color: "173F6B", size: 28, font: "Arial" })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "REQUEST FOR INFORMATION", bold: true, color: "173F6B", size: 34, font: "Arial" })] }),
    new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: `${model.header.number} | ${model.header.subject}`, bold: true, color: "2563A6", size: 24, font: "Arial" })] }),
    docxSection("1", "Header / RFI Status"),
    docxKeyValueTable([
      ["Project", model.project.name], ["Project Code", model.project.code], ["RFI Number", model.header.number], ["Revision", model.header.revision],
      ["Subject", model.header.subject], ["RFI Type", model.header.type], ["Current Status", model.header.status], ["Lifecycle State", model.header.lifecycleState],
      ["Priority", model.header.priority], ["Date Requested", model.header.dateRequested], ["Date Required", model.header.dateRequired], ["Date Answered", model.header.dateAnswered],
      ["Days Outstanding", model.header.daysOutstanding], ["Current Ball in Court", model.header.ballInCourt],
    ]),
    docxSection("2", "Submitted By"), docxKeyValueTable(participantFields(model.submittedBy)),
    docxSection("3", "Submitted To"), docxKeyValueTable(participantFields(model.submittedTo)),
    docxSection("4", "Reference Information / Attachments"),
    docxKeyValueTable([
      ["Drawing Number", model.references.drawingNumber], ["Drawing Title", model.references.drawingTitle], ["Specification Section", model.references.specificationSection], ["Detail Number", model.references.detailNumber],
      ["Note Number", model.references.noteNumber], ["Location", model.references.location], ["Project Address", model.references.projectAddress], ["Source Viewpoint", model.references.sourceViewpoint],
    ]),
    docxSubheading("References"), ...docxList(model.references.manualReferences, "No manual references recorded."),
    docxSubheading("Attachments"), ...docxList(model.references.attachments, "No files attached."),
  ];
  if (image) children.push(docxSubheading(`Displayed RFI Image - ${model.references.image?.name || image.fileName}`), docxImage(image));
  children.push(
    docxSection("5", "Description of Question"), ...docxParagraphs(model.question, { indent: 120 }),
    docxSection("6", "Impact Assessment"),
    docxKeyValueTable([
      ["Cost Impact", model.impact.cost], ["Cost Amount", model.impact.costAmount], ["Cost Reason / Explanation", model.impact.costReason], ["Schedule Impact", model.impact.schedule],
      ["Calendar Days", model.impact.scheduleDays], ["Schedule Reason / Explanation", model.impact.scheduleReason],
    ]),
    docxSection("7", "Distribution / Email / Responses"),
    docxSubheading("Distribution"), ...docxList(model.distribution.map(item => item.display), "No distribution recipients recorded."),
    docxSubheading("Description of Email"), ...docxParagraphs(model.email.description, { muted: model.email.description === EMPTY_VALUE }),
    docxSubheading("Email Draft"), ...docxParagraphs(model.email.draft, { muted: model.email.draft === EMPTY_VALUE }),
    docxSubheading("Official Responses"),
  );
  if (!model.responses.length) children.push(...docxParagraphs("No official responses recorded.", { muted: true }));
  model.responses.forEach(response => {
    children.push(
      docxSubheading(`Response ${response.number} | ${response.responder} | ${response.date}`),
      ...docxParagraphs(response.text, { indent: 120 }),
      docxKeyValueTable([
        ["Responder Email", response.responderEmail], ["Responder Company", response.responderCompany], ["Cost Impact", response.cost], ["Cost Amount", response.costAmount],
        ["Cost Reason", response.costReason], ["Schedule Impact", response.schedule], ["Calendar Days", response.scheduleDays], ["Schedule Reason", response.scheduleReason],
        ["Closing Status", response.closingStatus], ["Response Date", response.date],
      ]),
      docxSubheading(`Response ${response.number} Attachments`), ...docxList(response.attachments, "No response attachments recorded."),
    );
  });
  return new Document({
    creator: "BIMLog by IgniteSmart", title: `${model.header.number} - Request for Information`, subject: model.header.subject,
    description: "Professional BIMLog construction RFI record", keywords: "BIMLog RFI construction",
    styles: {
      default: { document: { run: { font: "Arial", size: 20, color: "111827" }, paragraph: { spacing: { after: 80 } } } },
      paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 22, bold: true }, paragraph: { outlineLevel: 0, spacing: { before: 260, after: 100 } } }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1440, bottom: 900, left: 1440, header: 450, footer: 450 } } },
      headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2563A6" } }, children: [new TextRun({ text: `BIMLog | ${model.project.name} | ${model.header.number}`, bold: true, color: "173F6B", size: 16, font: "Arial" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${reportTimestamp(model)} | Page `, color: "6B7280", size: 15, font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], color: "6B7280", size: 15, font: "Arial" }), new TextRun({ text: " of ", color: "6B7280", size: 15, font: "Arial" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "6B7280", size: 15, font: "Arial" }), new TextRun({ text: " | BIMLog by IgniteSmart", color: "6B7280", size: 15, font: "Arial" })] })] }) },
      children,
    }],
  });
}

function safeAuditScalar(value: unknown): string {
  if (value == null || value === "") return "Not recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = cleanText(value);
    if (/storage[_ ]?path|source[_ ]?location|\/api\/v1\/projects\/\d+\/files\/\d+|https?:\/\/\S*[?&](?:token|key|signature)=/i.test(text)) return "Protected value changed";
    return text.replace(/\bBIMLog file #\d+\b/gi, "BIMLog file");
  }
  if (Array.isArray(value)) return value.map(safeAuditScalar).filter(Boolean).join(", ") || "None";
  return "Structured value changed";
}

function parseAuditDetails(event: RfiAuditEventSource): { summary: string; changes: string[]; eventName: string } {
  const details = event.details?.trim();
  if (!details) return { summary: `${humanize(event.actionType)} recorded.`, changes: [], eventName: "" };
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const eventName = typeof parsed.event === "string" ? parsed.event : "";
    const changes = Array.isArray(parsed.changes) ? parsed.changes.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const change = item as Record<string, unknown>;
      const field = cleanText(change.field, "Field");
      if (/image presentation/i.test(field)) return [`${field}: presentation settings changed`];
      return [`${field}: ${safeAuditScalar(change.before)} -> ${safeAuditScalar(change.after)}`];
    }) : [];
    const knownSummary: Record<string, string> = {
      "rfi.closed": "RFI closed.", "rfi.reopened": "RFI reopened.", "rfi.revised": "RFI revision created.",
      "rfi.responded": "Official response recorded.", "rfi.responded_and_closed": "Official response recorded and RFI closed.",
      "rfi.marked_sent": "RFI marked as sent.",
      "rfi.complete_pdf_exported": "Complete RFI PDF package exported.",
      "rfi.complete_pdf_failed": "Complete RFI PDF package generation failed.",
    };
    const imageEvents = Array.isArray(parsed.imageEvents) ? parsed.imageEvents.map(value => humanize(value)).join(", ") : "";
    const summary = knownSummary[eventName] || (imageEvents ? `Image presentation updated: ${imageEvents}.` : `${humanize(event.actionType)} recorded.`);
    return { summary, changes, eventName };
  } catch {
    const summary = /^PDF exported:/i.test(details) ? "Standard RFI PDF exported."
      : /^Complete RFI PDF exported:/i.test(details) ? "Complete RFI PDF package exported."
      : /^Created RFI /i.test(details) ? "RFI created."
      : /^RFI marked as sent/i.test(details) ? "RFI marked as sent."
      : `${humanize(event.actionType)} recorded.`;
    return { summary, changes: [], eventName: "" };
  }
}

function auditCategory(actionType: string, eventName: string, summary: string, changes: string[]): string {
  const text = `${actionType} ${eventName} ${summary} ${changes.join(" ")}`.toLowerCase();
  if (text.includes("image")) return "Image presentation";
  if (text.includes("attachment") || text.includes("file")) return "Attachments";
  if (text.includes("revis")) return "Revised";
  if (text.includes("reopen")) return "Reopened";
  if (text.includes("clos")) return "Closed";
  if (text.includes("respond")) return "Responded";
  if (text.includes("sent")) return "Sent";
  if (text.includes("export")) return "Exports";
  if (text.includes("creat")) return "Created";
  if (text.includes("edit") || text.includes("update")) return "Edited";
  return "Other activity";
}

export function buildRfiAuditModel(model: CanonicalRfiExportModel, input: { activity: RfiAuditEventSource[]; custody: RfiCustodySource[]; views: RfiViewEventSource[] }): RfiAuditModel {
  const events = [...input.activity].sort((a, b) => (dateValue(a.createdAt)?.getTime() || 0) - (dateValue(b.createdAt)?.getTime() || 0)).map(event => {
    const parsed = parseAuditDetails(event);
    return {
      timestamp: formatTimestamp(event.createdAt), actor: cleanText(event.userFullName), company: cleanText(event.userCompanyName),
      action: humanize(event.actionType), summary: parsed.summary, changes: parsed.changes,
      category: auditCategory(event.actionType, parsed.eventName, parsed.summary, parsed.changes),
    };
  });
  const categories = ["Created", "Edited", "Sent", "Responded", "Closed", "Reopened", "Revised", "Attachments", "Image presentation", "Exports"];
  return {
    events,
    categoryCounts: categories.map(category => ({ category, count: events.filter(event => event.category === category).length })),
    custody: [...input.custody].sort((a, b) => (dateValue(a.fromDate)?.getTime() || 0) - (dateValue(b.fromDate)?.getTime() || 0)).map(row => ({
      holder: cleanText(row.heldBy), company: cleanText(row.heldByCompany), from: formatTimestamp(row.fromDate), to: row.toDate ? formatTimestamp(row.toDate) : "Current",
      days: row.daysHeld == null ? (row.toDate ? EMPTY_VALUE : "In progress") : String(row.daysHeld),
    })),
    responseHistory: model.responses.map(response => ({ response: `Response ${response.number}`, responder: response.responder, date: response.date, status: response.closingStatus })),
    views: [...input.views].sort((a, b) => (dateValue(a.viewedAt)?.getTime() || 0) - (dateValue(b.viewedAt)?.getTime() || 0)).map(view => ({ timestamp: formatTimestamp(view.viewedAt), actor: cleanText(view.userFullName), company: cleanText(view.userCompanyName) })),
  };
}

export function renderRfiAuditPdf(doc: PDFKit.PDFDocument, model: CanonicalRfiExportModel, audit: RfiAuditModel): void {
  doc.info.Title = `${model.header.number} - RFI Audit Report`;
  doc.info.Author = "BIMLog by IgniteSmart";
  doc.info.Subject = `Lifecycle and custody evidence for ${model.header.number}`;
  const flow = new PdfFlow(doc, "RFI AUDIT REPORT", model.project.name, model.header.number);
  flow.section("A", "Record Identity and Generation");
  flow.keyValues([
    ["Project", model.project.name], ["Project Code", model.project.code], ["RFI Number", model.header.number], ["Subject", model.header.subject],
    ["Revision", model.header.revision], ["Current Status", model.header.status], ["Lifecycle State", model.header.lifecycleState], ["Generated", formatTimestamp(model.generatedAt)],
    ["Current Ball in Court", model.header.ballInCourt], ["Date Answered", model.header.dateAnswered],
  ]);
  flow.paragraph("This report presents recorded BIMLog lifecycle evidence. It does not invent missing events or certify facts outside the saved project record.", { color: PALETTE.MUTED });
  flow.section("B", "Event Coverage");
  flow.table(["Category", "Recorded Events"], [340, 180], audit.categoryCounts.map(item => [item.category, item.count ? String(item.count) : "No events recorded"]));
  flow.section("C", "Chronological Activity History");
  if (!audit.events.length) flow.paragraph("No activity events recorded.", { color: PALETTE.MUTED });
  else audit.events.forEach(event => {
    flow.subheading(`${event.timestamp} | ${event.action}`);
    flow.keyValues([["Actor", event.actor], ["Company", event.company], ["Category", event.category], ["Event", event.summary]]);
    if (event.changes.length) flow.list(event.changes, "");
  });
  flow.section("D", "Ball-in-Court / Custody History");
  if (!audit.custody.length) flow.paragraph("No custody events recorded.", { color: PALETTE.MUTED });
  else flow.table(["Holder", "Company", "From", "To", "Days"], [100, 100, 125, 125, 70], audit.custody.map(row => [row.holder, row.company, row.from, row.to, row.days]));
  flow.section("E", "Response and Lifecycle Evidence");
  if (!audit.responseHistory.length) flow.paragraph("No official responses recorded.", { color: PALETTE.MUTED });
  else flow.table(["Response", "Responder", "Date", "Result"], [85, 165, 125, 145], audit.responseHistory.map(row => [row.response, row.responder, row.date, row.status]));
  flow.section("F", "View / Access History");
  if (!audit.views.length) flow.paragraph("No view events recorded.", { color: PALETTE.MUTED });
  else flow.table(["Timestamp", "User", "Company"], [180, 170, 170], audit.views.map(view => [view.timestamp, view.actor, view.company]));
  addPageNumbers(doc, {
    margin: PDF_MARGIN, footerY: 768, fingerprintY: 750, contentHash: computeContentHash({ model, audit }),
    companyName: "BIMLog", projectName: model.project.name, reportNumber: `${model.header.number} Audit`, timestamp: reportTimestamp(model),
  });
}
