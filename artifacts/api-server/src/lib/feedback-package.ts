import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { AlignmentType, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun, PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import ExcelJS from "exceljs";
import { FEEDBACK_MAX_FILE_BYTES, FEEDBACK_RELEASE } from "./feedback-evidence-contract";
import { FEEDBACK_CUSTOMER_EVENT_TYPES } from "./feedback-follow-up";

export const FEEDBACK_PACKAGE_MAX_BYTES = 100 * 1024 * 1024;
export const FEEDBACK_PACKAGE_MAX_ASSETS = 10;
export const FEEDBACK_PACKAGE_MAX_EVENTS = 2_000;
const MAX_EMBEDDED_IMAGE_PIXELS = 24_000_000;

export type FeedbackPackageVisibility = "customer" | "internal";
export type FeedbackPackageCustody = {
  metadataAuthority: "PostgreSQL";
  byteStorage: string;
  backendId: string;
  accessPolicy: "private-bimlog-authorized-access";
};
export type FeedbackPackageItem = {
  id: number; stableId: string; feedbackType: string; priority: string; module: string | null; pageUrl: string;
  message: string; status: string; version: number; targetRelease: string | null; dispositionReason: string | null;
  customerVisible: boolean; createdAt: Date; updatedAt: Date; resolvedAt: Date | null;
  submitter: { id: number; name: string | null; email: string | null };
  project: { id: number; name: string | null; code: string | null } | null;
};
export type FeedbackPackageEvent = { id: number; eventType: string; beforeState: unknown; afterState: unknown; reason: string | null; createdAt: Date };
export type FeedbackPackageAsset = { id: number; kind: string; safeName: string; mediaType: string; byteSize: number; sha256: string; scanState: string; scannedAt: Date | null; createdAt: Date; bytes?: Buffer };

export class FeedbackPackageError extends Error {
  constructor(message: string, readonly code: "PACKAGE_LIMIT" | "PACKAGE_INTEGRITY" | "PACKAGE_ASSET_UNAVAILABLE") { super(message); }
}

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
};
const packageName = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "evidence.bin";
const customerEvents = new Set(["created", "assets_added", "transcription_requested", "transcription_reviewed", "triage_updated", "reopened", ...FEEDBACK_CUSTOMER_EVENT_TYPES]);
export const FEEDBACK_PACKAGE_EXCLUDED_EVENTS = ["package_snapshot_created", "feedback_telegram_delivery", "admin_package_exported", "admin_package_snapshot_exported", "admin_exported", "admin_follow_up_exported", "admin_asset_exported", "evidence_scan_started", "evidence_scan_failed"] as const;
const packageExcludedEvents = new Set<string>(FEEDBACK_PACKAGE_EXCLUDED_EVENTS);
const eventLabels: Record<string, string> = {
  created: "Feedback submitted",
  submission_acknowledged: "Submission acknowledged",
  internal_reviewer_notifications_created: "Review team notified",
  assets_added: "Evidence attached",
  evidence_scan_clean: "Evidence verified safe",
  evidence_scan_rejected: "Evidence rejected by controlled scanning",
  triage_updated: "Review status updated",
  customer_response: "Customer response sent",
  customer_decision: "Decision shared with customer",
  customer_fix: "Resolution shared with customer",
  customer_answer: "Answer shared with customer",
  reopened: "Feedback reopened",
};
const eventLabel = (type: string) => eventLabels[type] || type.replace(/_/g, " ").replace(/^./, value => value.toUpperCase());
const customerState = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>, allowed = ["status", "version", "count", "scanState", "reviewState"];
  return Object.fromEntries(allowed.filter(key => key in record).map(key => [key, record[key]]));
};

export async function buildFeedbackPackage(args: {
  feedback: FeedbackPackageItem; events: FeedbackPackageEvent[]; assets: FeedbackPackageAsset[]; visibility: FeedbackPackageVisibility; baseUrl: string; custody: FeedbackPackageCustody;
}) {
  if (args.assets.length > FEEDBACK_PACKAGE_MAX_ASSETS) throw new FeedbackPackageError("Feedback evidence count exceeds the package bound", "PACKAGE_LIMIT");
  if (args.events.length > FEEDBACK_PACKAGE_MAX_EVENTS) throw new FeedbackPackageError("Feedback history exceeds the package event bound", "PACKAGE_LIMIT");
  let total = 0;
  const evidence = [] as Array<FeedbackPackageAsset & { zipName: string; downloadUrl: string | null; reviewUrl: string }>;
  for (const asset of args.assets) {
    const clean = asset.scanState === "clean" && asset.scannedAt instanceof Date;
    if (asset.scanState === "clean" && !clean) throw new FeedbackPackageError(`Evidence ${asset.id} has no completed scanner receipt`, "PACKAGE_INTEGRITY");
    if (clean && (!asset.bytes || asset.bytes.byteLength !== asset.byteSize || asset.byteSize > FEEDBACK_MAX_FILE_BYTES || sha256(asset.bytes) !== asset.sha256))
      throw new FeedbackPackageError(`Evidence ${asset.id} failed bounded integrity verification`, "PACKAGE_INTEGRITY");
    if (clean) total += asset.byteSize;
    if (total > FEEDBACK_PACKAGE_MAX_BYTES) throw new FeedbackPackageError("Feedback evidence exceeds the package byte bound", "PACKAGE_LIMIT");
    const reviewPath = args.visibility === "internal" ? `/admin/feedback?feedback=${encodeURIComponent(args.feedback.stableId)}&asset=${asset.id}` : `/feedback?view=mine&feedback=${encodeURIComponent(args.feedback.stableId)}&asset=${asset.id}`;
    const downloadPath = `${reviewPath}&downloadAsset=${asset.id}`;
    evidence.push({ ...asset, zipName: `evidence/${String(asset.id).padStart(6, "0")}-${packageName(asset.safeName)}`, downloadUrl: clean ? `${args.baseUrl}${downloadPath}` : null, reviewUrl: `${args.baseUrl}${reviewPath}` });
  }
  const events = args.events.filter(event => !packageExcludedEvents.has(event.eventType) && (args.visibility === "internal" || customerEvents.has(event.eventType))).map(event => ({
    id: event.id, type: event.eventType, at: event.createdAt.toISOString(),
    before: args.visibility === "customer" ? customerState(event.beforeState) : event.beforeState,
    after: args.visibility === "customer" ? customerState(event.afterState) : event.afterState,
    reason: args.visibility === "internal" || FEEDBACK_CUSTOMER_EVENT_TYPES.has(event.eventType) ? event.reason : null,
  }));
  const manifestObject = {
    schema: "bimlog.feedback-package.v1", release: FEEDBACK_RELEASE, visibility: args.visibility, custody: args.custody,
    feedback: { ...args.feedback, createdAt: args.feedback.createdAt.toISOString(), updatedAt: args.feedback.updatedAt.toISOString(), resolvedAt: args.feedback.resolvedAt?.toISOString() ?? null,
      submitter: args.visibility === "internal" ? args.feedback.submitter : { id: args.feedback.submitter.id, name: args.feedback.submitter.name, email: null },
      dispositionReason: args.visibility === "internal" ? args.feedback.dispositionReason : null },
    history: events,
    evidence: evidence.map(asset => ({ id: asset.id, kind: asset.kind, name: asset.safeName, mediaType: asset.mediaType, byteSize: asset.byteSize, sha256: asset.sha256, scanState: asset.scanState, scannedAt: asset.scannedAt?.toISOString() ?? null, createdAt: asset.createdAt.toISOString(), included: asset.scanState === "clean" && !!asset.scannedAt, zipPath: asset.scanState === "clean" && asset.scannedAt ? asset.zipName : null, reviewUrl: asset.reviewUrl, secureDownloadUrl: asset.downloadUrl })),
  };
  const manifest = Buffer.from(`${canonical(manifestObject)}\n`, "utf8");
  const manifestSha256 = sha256(manifest);
  const pdf = await createHumanPdf(manifestObject, evidence, manifestSha256);
  const docx = await createHumanDocx(manifestObject, evidence, manifestSha256);
  const workbook = await createFeedbackWorkbook(manifestObject, evidence, manifestSha256);
  const zip = new AdmZip(); zip.addFile("manifest.json", manifest); zip.addFile(`${packageName(args.feedback.stableId)}-feedback.pdf`, pdf); zip.addFile(`${packageName(args.feedback.stableId)}-feedback.docx`, docx); zip.addFile(`${packageName(args.feedback.stableId)}-follow-up.xlsx`, workbook);
  for (const asset of evidence) if (asset.scanState === "clean" && asset.scannedAt && asset.bytes) zip.addFile(asset.zipName, asset.bytes);
  const archive = zip.toBuffer();
  if (archive.byteLength > FEEDBACK_PACKAGE_MAX_BYTES + 10 * 1024 * 1024) throw new FeedbackPackageError("Generated feedback package exceeds the archive bound", "PACKAGE_LIMIT");
  return { archive, manifest, pdf, docx, workbook, manifestSha256, archiveSha256: sha256(archive) };
}

async function createHumanPdf(manifest: Record<string, any>, evidence: Array<FeedbackPackageAsset & { downloadUrl: string | null }>, manifestSha256: string): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true, info: { Title: `${manifest.feedback.stableId} Feedback Package`, Author: "BIMLog by IgniteSmart", Subject: `Feedback package ${manifest.feedback.stableId} - ${manifest.release}` } });
    doc.on("data", chunk => chunks.push(Buffer.from(chunk))); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
    const field = (label: string, value: unknown) => { doc.font("Helvetica-Bold").fillColor("#173b63").text(`${label}: `, { continued: true }).font("Helvetica").fillColor("#111827").text(String(value ?? "—")); };
    doc.rect(0, 0, doc.page.width, 112).fill("#173b63"); doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text("BIMLOG BY IGNITESMART", 50, 34); doc.fontSize(22).text("Feedback review package", 50, 53); doc.fontSize(10).font("Helvetica").text(`${manifest.feedback.stableId}  ·  ${manifest.release}`, 50, 84); doc.fillColor("#111827").y = 134;
    doc.fontSize(10); field("Submitted by", `${manifest.feedback.submitter.name ?? "Unknown"}${manifest.feedback.submitter.email ? ` <${manifest.feedback.submitter.email}>` : ""}`);
    field("Submitted", manifest.feedback.createdAt); field("Last updated", manifest.feedback.updatedAt); field("Status", manifest.feedback.status); field("Type / priority", `${manifest.feedback.feedbackType} / ${manifest.feedback.priority}`); field("Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : "None");
    const messageWidth = doc.page.width - 128; doc.font("Helvetica").fontSize(10); const messageHeight = Math.min(150, Math.max(30, doc.heightOfString(manifest.feedback.message, { width: messageWidth }))); const messageTop = doc.y + 30; const messageBoxHeight = messageHeight + 48;
    doc.moveDown(0.7).roundedRect(50, doc.y, doc.page.width - 100, messageBoxHeight, 6).fillAndStroke("#eef5fb", "#b8cadd"); doc.fillColor("#173b63").font("Helvetica-Bold").text("CUSTOMER MESSAGE", 64, doc.y + 13); doc.fillColor("#111827").font("Helvetica").text(manifest.feedback.message, 64, messageTop, { width: messageWidth, height: messageHeight, ellipsis: true }); doc.y = messageTop + messageHeight + 18;
    doc.moveDown(0.5).font("Helvetica-Bold").fillColor("#173b63").text("Meaningful activity"); doc.moveDown(0.25);
    for (const event of manifest.history) doc.font("Helvetica").fillColor("#111827").text(`${event.at}  ·  ${eventLabel(event.type)}${event.reason ? `  ·  ${event.reason}` : ""}`, { paragraphGap: 3 });
    doc.addPage().font("Helvetica-Bold").fillColor("#173b63").fontSize(16).text("Evidence inventory"); doc.moveDown(0.3).font("Helvetica").fillColor("#475569").fontSize(9).text("File records are held in PostgreSQL. Verified bytes are held in the private storage location below. Links open BIMLog first so your signed-in session can authorize access.");
    doc.moveDown(0.5).font("Helvetica-Bold").fillColor("#173b63").text("Metadata record: ", { continued: true }).font("Helvetica").fillColor("#111827").text(manifest.custody.metadataAuthority);
    doc.font("Helvetica-Bold").fillColor("#173b63").text("File bytes: ", { continued: true }).font("Helvetica").fillColor("#111827").text(manifest.custody.byteStorage);
    doc.font("Helvetica-Bold").fillColor("#173b63").text("Access: ", { continued: true }).font("Helvetica").fillColor("#111827").text("Private. Sign in to BIMLog; the application verifies your authority before downloading.");
    for (const asset of manifest.evidence) { doc.moveDown(0.7).font("Helvetica-Bold").fillColor("#173b63").text(`${asset.id} · ${asset.name}`); doc.font("Helvetica").fillColor("#111827").text(`${asset.kind} · ${asset.mediaType} · ${asset.byteSize.toLocaleString()} bytes · ${asset.scanState === "clean" ? "verified safe" : asset.scanState}`); doc.fontSize(8).fillColor("#64748b").text(`SHA-256 ${asset.sha256}`).fontSize(10); doc.fillColor("#0563c1").text("Open evidence record in BIMLog", { link: asset.reviewUrl, underline: true }).fillColor("#111827"); if (asset.secureDownloadUrl) doc.fillColor("#0563c1").text("Open BIMLog and download verified file", { link: asset.secureDownloadUrl, underline: true }).fillColor("#111827"); else doc.fillColor("#92400e").text("Preview and download remain locked until controlled scanning completes.").fillColor("#111827"); }
    void (async () => {
      try {
        for (const asset of evidence) if (asset.scanState === "clean" && asset.scannedAt && asset.bytes && /^image\/(png|jpe?g)$/.test(asset.mediaType)) {
          const metadata = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).metadata();
          if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_EMBEDDED_IMAGE_PIXELS) throw new FeedbackPackageError(`Image evidence ${asset.id} exceeds the render bound`, "PACKAGE_LIMIT");
          const rendered = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).rotate().resize({ width: 1500, height: 1900, fit: "inside", withoutEnlargement: true }).png().toBuffer();
          doc.addPage().font("Helvetica-Bold").fillColor("#173b63").fontSize(15).text(`Image evidence ${asset.id}`); doc.font("Helvetica").fillColor("#475569").fontSize(9).text(`${asset.safeName} · ${asset.byteSize.toLocaleString()} bytes · verified safe`); doc.moveDown().image(rendered, { fit: [510, 635], align: "center", valign: "center" }); doc.moveDown(0.4).fillColor("#0563c1").text("Open BIMLog and download verified original", { link: asset.downloadUrl!, underline: true }).fillColor("#111827");
        }
        doc.addPage().fontSize(14).font("Helvetica-Bold").text("Package snapshot fingerprint");
        doc.moveDown(0.6).fontSize(10).font("Helvetica").text("This fingerprint binds the canonical JSON snapshot used to generate this human-readable report.");
        doc.moveDown(0.6); field("Feedback", manifest.feedback.stableId); field("Release", manifest.release); field("Snapshot date/time", manifest.feedback.updatedAt); field("Canonical manifest SHA-256", manifestSha256);
        const range = doc.bufferedPageRange();
        for (let index = range.start; index < range.start + range.count; index++) {
          doc.switchToPage(index);
          const footerY = doc.page.height - 36;
          doc.page.margins.bottom = 0;
          doc.fontSize(8).font("Helvetica").fillColor("#4b5563").text(
            `BIMLog by IgniteSmart · ${manifest.feedback.stableId} · ${manifest.release} · Snapshot ${manifest.feedback.updatedAt} · Page ${index - range.start + 1} of ${range.count}`,
            50, footerY, { width: doc.page.width - 100, align: "center", lineBreak: false },
          ).fillColor("black");
        }
        doc.end();
      } catch (error) { doc.removeAllListeners("data"); doc.removeAllListeners("end"); doc.end(); reject(error); }
    })();
  });
}

async function createHumanDocx(manifest: Record<string, any>, evidence: Array<FeedbackPackageAsset & { downloadUrl: string | null; reviewUrl: string }>, manifestSha256: string): Promise<Buffer> {
  const field = (label: string, value: unknown) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(String(value ?? "—"))] });
  const columnWidths = [2500, 1500, 1200, 900, 3260];
  const evidenceRows = [new TableRow({ children: ["File", "Type", "Scan", "Size", "Links"].map((text, index) => new TableCell({ width: { size: columnWidths[index], type: WidthType.DXA }, shading: { fill: "DDEBF7" }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "173B63" })] })] })) })];
  for (const asset of evidence) {
    const linkParagraphs = [
      new Paragraph({ children: [new ExternalHyperlink({ link: asset.reviewUrl, children: [new TextRun({ text: "Open in BIMLog", style: "Hyperlink" })] })] }),
      new Paragraph({ children: [new TextRun({ text: "Copy into your signed-in browser if Office blocks the link:", bold: true, size: 16, color: "475569" })] }),
      new Paragraph({ children: [new TextRun({ text: asset.reviewUrl, size: 16, color: "0563C1" })] }),
    ];
    evidenceRows.push(new TableRow({ children: [
      new TableCell({ width: { size: columnWidths[0], type: WidthType.DXA }, children: [new Paragraph(asset.safeName), new Paragraph({ children: [new TextRun({ text: `SHA-256 ${asset.sha256}`, size: 16, color: "64748B" })] })] }),
      new TableCell({ width: { size: columnWidths[1], type: WidthType.DXA }, children: [new Paragraph(`${asset.kind} / ${asset.mediaType}`)] }),
      new TableCell({ width: { size: columnWidths[2], type: WidthType.DXA }, children: [new Paragraph(asset.scanState === "clean" ? "Verified safe" : asset.scanState), ...(!asset.downloadUrl ? [new Paragraph({ children: [new TextRun({ text: "Bytes locked pending controlled scan", color: "92400E" })] })] : [])] }),
      new TableCell({ width: { size: columnWidths[3], type: WidthType.DXA }, children: [new Paragraph(asset.byteSize.toLocaleString())] }),
      new TableCell({ width: { size: columnWidths[4], type: WidthType.DXA }, children: linkParagraphs }),
    ] }));
  }
  const imageSections: Paragraph[] = [];
  for (const asset of evidence) if (asset.downloadUrl && asset.bytes && /^image\/(png|jpe?g)$/.test(asset.mediaType)) {
    const metadata = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_EMBEDDED_IMAGE_PIXELS) continue;
    const width = Math.min(560, metadata.width); const height = Math.max(1, Math.round(width * metadata.height / metadata.width));
    imageSections.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`Image evidence ${asset.id}: ${asset.safeName}`)] }));
    imageSections.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: asset.bytes, transformation: { width, height }, type: asset.mediaType.includes("png") ? "png" : "jpg" })] }));
  }
  const document = new Document({ styles: { default: { document: { run: { font: "Aptos", size: 20 }, paragraph: { spacing: { after: 120 } } } }, paragraphStyles: [{ id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 38, bold: true, color: "173B63" }, paragraph: { spacing: { after: 240 } } }, { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 26, bold: true, color: "173B63" }, paragraph: { spacing: { before: 260, after: 120 } } }, { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 22, bold: true, color: "1F4E78" }, paragraph: { spacing: { before: 200, after: 100 } } }] }, sections: [{
    properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(`BIMLog by IgniteSmart · ${manifest.feedback.stableId} · ${manifest.release} · `), new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] })] })] }) },
    children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("BIMLog Feedback Package")] }),
      field("Release", manifest.release), field("Feedback", manifest.feedback.stableId), field("Submitted by", `${manifest.feedback.submitter.name ?? "Unknown"}${manifest.feedback.submitter.email ? ` <${manifest.feedback.submitter.email}>` : ""}`), field("Submitted", manifest.feedback.createdAt), field("Updated", manifest.feedback.updatedAt), field("Status", manifest.feedback.status), field("Type / priority", `${manifest.feedback.feedbackType} / ${manifest.feedback.priority}`), field("Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : "None"), field("Reported page", manifest.feedback.pageUrl),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Customer message")] }), new Paragraph(manifest.feedback.message),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Evidence custody")] }), field("Metadata record", manifest.custody.metadataAuthority), field("File bytes", manifest.custody.byteStorage), field("Access", "Private BIMLog-authorized access. Sign in before opening or downloading."),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Evidence inventory")] }),
      new Paragraph({ shading: { fill: "FFF2CC" }, children: [new TextRun({ text: "Microsoft Office security: If this downloaded document opens in Protected View, click Enable Editing before using its links. If your organization blocks external Office links, copy the complete BIMLog URL shown for the file into a browser where you are signed in. On the BIMLog evidence page, click Download verified file.", bold: true, color: "7F6000" })] }),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths, rows: evidenceRows }),
      ...imageSections,
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Status history")] }),
      ...manifest.history.map((event: any) => new Paragraph(`${event.at} — ${eventLabel(event.type)}${event.reason ? ` — ${event.reason}` : ""}`)),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Snapshot fingerprint")] }), field("Canonical manifest SHA-256", manifestSha256),
    ],
  }] });
  return Buffer.from(await Packer.toBuffer(document));
}

async function createFeedbackWorkbook(manifest: Record<string, any>, evidence: Array<FeedbackPackageAsset & { downloadUrl: string | null; reviewUrl: string }>, manifestSha256: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BIMLog by IgniteSmart"; workbook.title = `${manifest.feedback.stableId} Feedback Follow-up`; workbook.subject = `Feedback ${manifest.feedback.stableId} · ${manifest.release}`;
  const brand = "1F4E78", accent = "DDEBF7", grid = "B8C4D2";
  const titleRow = (sheet: ExcelJS.Worksheet, title: string, width: number) => {
    sheet.mergeCells(1, 1, 1, width); const cell = sheet.getCell(1, 1); cell.value = title; cell.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${brand}` } }; cell.alignment = { vertical: "middle" }; sheet.getRow(1).height = 34;
  };
  const headerRow = (row: ExcelJS.Row) => { row.font = { bold: true, color: { argb: "FFFFFFFF" } }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${brand}` } }; row.alignment = { vertical: "middle", wrapText: true }; row.height = 26; };

  const summary = workbook.addWorksheet("Follow-up", { views: [{ state: "frozen", ySplit: 1 }] }); titleRow(summary, "BIMLog Feedback Follow-up", 2);
  summary.columns = [{ width: 24 }, { width: 92 }];
  const fields: Array<[string, unknown]> = [["Feedback ID", manifest.feedback.stableId], ["Release", manifest.release], ["Status", manifest.feedback.status], ["Priority", manifest.feedback.priority], ["Type", manifest.feedback.feedbackType], ["Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : "None"], ["Submitter", manifest.feedback.submitter.name ?? "Unknown"], ["Submitted", manifest.feedback.createdAt], ["Updated", manifest.feedback.updatedAt], ["Target release", manifest.feedback.targetRelease ?? "Not assigned"], ["Decision / resolution", manifest.feedback.dispositionReason ?? "Pending review"], ["Message", manifest.feedback.message], ["Reported page", manifest.feedback.pageUrl], ["Metadata record", manifest.custody.metadataAuthority], ["File bytes", manifest.custody.byteStorage], ["Access", "Private BIMLog-authorized access"], ["Office link help", "If this workbook opens in Protected View, click Enable Editing. If links remain blocked, copy the complete BIMLog URL from the Evidence sheet into a signed-in browser, then click Download verified file."], ["Snapshot SHA-256", manifestSha256]];
  for (const [label, value] of fields) { const row = summary.addRow([label, String(value ?? "")]); row.getCell(1).font = { bold: true, color: { argb: `FF${brand}` } }; row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${accent}` } }; row.eachCell(cell => { cell.border = { bottom: { style: "thin", color: { argb: `FF${grid}` } } }; cell.alignment = { vertical: "top", wrapText: true }; }); if (label === "Reported page") row.getCell(2).value = { text: String(value), hyperlink: String(value), tooltip: "Open reported page" }; }
  summary.getRow(13).height = 72;

  const evidenceSheet = workbook.addWorksheet("Evidence", { views: [{ state: "frozen", ySplit: 2 }] }); titleRow(evidenceSheet, "Evidence inventory and governed links", 10);
  evidenceSheet.columns = [{ width: 8 }, { width: 38 }, { width: 16 }, { width: 22 }, { width: 14 }, { width: 16 }, { width: 66 }, { width: 24 }, { width: 58 }, { width: 44 }];
  const evidenceHeader = evidenceSheet.addRow(["ID", "File", "Kind", "Media type", "Bytes", "Scan state", "SHA-256", "Open in BIMLog", "BIMLog URL (copy/paste)", "Stored in"]); headerRow(evidenceHeader);
  for (const asset of evidence) { const row = evidenceSheet.addRow([asset.id, asset.safeName, asset.kind, asset.mediaType, asset.byteSize, asset.scanState, asset.sha256, { text: asset.downloadUrl ? "Open in BIMLog, then download" : "Open in BIMLog", hyperlink: asset.reviewUrl, tooltip: asset.downloadUrl ? "Open the evidence page, then click Download verified file" : "Open the evidence record; file bytes remain locked pending scan" }, asset.reviewUrl, manifest.custody.byteStorage]); row.eachCell(cell => { cell.alignment = { vertical: "top", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: `FF${grid}` } } }; }); }
  evidenceSheet.autoFilter = { from: "A2", to: `J${evidence.length + 2}` };

  const previews = workbook.addWorksheet("Evidence previews", { views: [{ state: "frozen", ySplit: 1 }] }); titleRow(previews, "Verified screenshot and image previews", 8); previews.columns = [{ width: 4 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 4 }];
  let previewRow = 3; let imageCount = 0;
  for (const asset of evidence) if (asset.downloadUrl && asset.bytes && /^image\/(png|jpe?g)$/.test(asset.mediaType)) {
    const metadata = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).metadata(); if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_EMBEDDED_IMAGE_PIXELS) continue;
    const preview = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).rotate().resize({ width: 1100, height: 760, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    previews.mergeCells(previewRow, 2, previewRow, 7); const caption = previews.getCell(previewRow, 2); caption.value = `${asset.safeName} · ${asset.mediaType} · ${asset.byteSize.toLocaleString()} bytes`; caption.font = { bold: true, color: { argb: `FF${brand}` } }; caption.alignment = { wrapText: true }; previewRow += 1;
    const imageId = workbook.addImage({ buffer: preview as unknown as ExcelJS.Buffer, extension: "png" }); previews.addImage(imageId, { tl: { col: 1.2, row: previewRow - 1 }, ext: { width: 700, height: Math.min(500, Math.max(180, Math.round(700 * metadata.height / metadata.width))) } });
    const rowsHigh = 27; for (let offset = 0; offset < rowsHigh; offset++) previews.getRow(previewRow + offset).height = 15; previewRow += rowsHigh;
    previews.mergeCells(previewRow, 2, previewRow, 7); const links = previews.getCell(previewRow, 2); links.value = { text: "Open in BIMLog, then download verified original", hyperlink: asset.reviewUrl, tooltip: "Open BIMLog evidence page" }; links.font = { color: { argb: "FF0563C1" }, underline: true }; previewRow += 1;
    previews.mergeCells(previewRow, 2, previewRow, 7); const rawUrl = previews.getCell(previewRow, 2); rawUrl.value = `Copy/paste URL: ${asset.reviewUrl}`; rawUrl.alignment = { wrapText: true }; rawUrl.font = { size: 9, color: { argb: "FF475569" } }; previewRow += 2; imageCount += 1;
  }
  if (!imageCount) { previews.mergeCells(3, 2, 5, 7); const note = previews.getCell(3, 2); note.value = "No verified image bytes are available yet. The evidence inventory retains secure review links and will include previews after controlled scanning completes."; note.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; note.font = { italic: true, color: { argb: "FF92400E" } }; }

  const history = workbook.addWorksheet("Activity", { views: [{ state: "frozen", ySplit: 2 }] }); titleRow(history, "Meaningful feedback activity", 3); history.columns = [{ width: 28 }, { width: 42 }, { width: 90 }]; const activityHeader = history.addRow(["Date/time", "Activity", "Customer-visible note"]); headerRow(activityHeader);
  for (const event of manifest.history) { const row = history.addRow([event.at, eventLabel(event.type), event.reason || "—"]); row.eachCell(cell => { cell.alignment = { vertical: "top", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: `FF${grid}` } } }; }); }
  const output = await workbook.xlsx.writeBuffer(); return Buffer.from(output);
}
