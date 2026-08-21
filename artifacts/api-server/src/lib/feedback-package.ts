import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { AlignmentType, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun, PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import * as XLSX from "xlsx";
import { FEEDBACK_MAX_FILE_BYTES, FEEDBACK_RELEASE } from "./feedback-evidence-contract";
import { FEEDBACK_CUSTOMER_EVENT_TYPES } from "./feedback-follow-up";

export const FEEDBACK_PACKAGE_MAX_BYTES = 100 * 1024 * 1024;
export const FEEDBACK_PACKAGE_MAX_ASSETS = 10;
export const FEEDBACK_PACKAGE_MAX_EVENTS = 2_000;
const MAX_EMBEDDED_IMAGE_PIXELS = 24_000_000;

export type FeedbackPackageVisibility = "customer" | "internal";
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
const packageExcludedEvents = new Set(["package_snapshot_created", "feedback_telegram_delivery", "admin_package_exported", "admin_package_snapshot_exported", "admin_exported", "admin_follow_up_exported", "admin_asset_exported"]);
const customerState = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>, allowed = ["status", "version", "count", "scanState", "reviewState"];
  return Object.fromEntries(allowed.filter(key => key in record).map(key => [key, record[key]]));
};

export async function buildFeedbackPackage(args: {
  feedback: FeedbackPackageItem; events: FeedbackPackageEvent[]; assets: FeedbackPackageAsset[]; visibility: FeedbackPackageVisibility; baseUrl: string;
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
    const downloadPath = args.visibility === "internal" ? `/api/v1/feedback/admin/${args.feedback.id}/assets/${asset.id}/download` : `/api/v1/feedback/${args.feedback.id}/assets/${asset.id}/download`;
    const reviewPath = args.visibility === "internal" ? `/admin/feedback?feedback=${encodeURIComponent(args.feedback.stableId)}&asset=${asset.id}` : `/feedback?view=mine&feedback=${encodeURIComponent(args.feedback.stableId)}&asset=${asset.id}`;
    evidence.push({ ...asset, zipName: `evidence/${String(asset.id).padStart(6, "0")}-${packageName(asset.safeName)}`, downloadUrl: clean ? `${args.baseUrl}${downloadPath}` : null, reviewUrl: `${args.baseUrl}${reviewPath}` });
  }
  const events = args.events.filter(event => !packageExcludedEvents.has(event.eventType) && (args.visibility === "internal" || customerEvents.has(event.eventType))).map(event => ({
    id: event.id, type: event.eventType, at: event.createdAt.toISOString(),
    before: args.visibility === "customer" ? customerState(event.beforeState) : event.beforeState,
    after: args.visibility === "customer" ? customerState(event.afterState) : event.afterState,
    reason: args.visibility === "internal" || FEEDBACK_CUSTOMER_EVENT_TYPES.has(event.eventType) ? event.reason : null,
  }));
  const manifestObject = {
    schema: "bimlog.feedback-package.v1", release: FEEDBACK_RELEASE, visibility: args.visibility,
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
  const workbook = createFeedbackWorkbook(manifestObject, evidence, manifestSha256);
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
    const field = (label: string, value: unknown) => { doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(String(value ?? "—")); };
    doc.fontSize(18).font("Helvetica-Bold").text("BIMLog Feedback Package"); doc.moveDown(0.5).fontSize(10);
    field("Release", manifest.release); field("Feedback", manifest.feedback.stableId); field("Submitted by", `${manifest.feedback.submitter.name ?? "Unknown"}${manifest.feedback.submitter.email ? ` <${manifest.feedback.submitter.email}>` : ""}`);
    field("Submitted date/time", manifest.feedback.createdAt); field("Last updated", manifest.feedback.updatedAt); field("Status", manifest.feedback.status); field("Type / priority", `${manifest.feedback.feedbackType} / ${manifest.feedback.priority}`); field("Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : "None"); field("Module / page", `${manifest.feedback.module ?? "—"} / ${manifest.feedback.pageUrl}`);
    doc.moveDown().font("Helvetica-Bold").text("Message"); doc.font("Helvetica").text(manifest.feedback.message); doc.moveDown().font("Helvetica-Bold").text("Status history");
    for (const event of manifest.history) doc.font("Helvetica").text(`${event.at} — ${event.type}${event.reason ? ` — ${event.reason}` : ""}`);
    doc.addPage().font("Helvetica-Bold").text("Evidence inventory");
    for (const asset of manifest.evidence) { doc.moveDown(0.4).font("Helvetica-Bold").text(`${asset.id} · ${asset.name}`); doc.font("Helvetica").text(`${asset.kind} · ${asset.mediaType} · ${asset.byteSize} bytes · scan ${asset.scanState}`); doc.text(`SHA-256 ${asset.sha256}`); doc.fillColor("blue").text("Open evidence record (sign-in required)", { link: asset.reviewUrl, underline: true }).fillColor("black"); if (asset.secureDownloadUrl) doc.fillColor("blue").text("Secure authenticated download", { link: asset.secureDownloadUrl, underline: true }).fillColor("black"); else doc.fillColor("#92400e").text("Preview and download remain locked until controlled scanning completes.").fillColor("black"); }
    void (async () => {
      try {
        for (const asset of evidence) if (asset.scanState === "clean" && asset.scannedAt && asset.bytes && /^image\/(png|jpe?g)$/.test(asset.mediaType)) {
          const metadata = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).metadata();
          if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_EMBEDDED_IMAGE_PIXELS) throw new FeedbackPackageError(`Image evidence ${asset.id} exceeds the render bound`, "PACKAGE_LIMIT");
          const rendered = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).rotate().resize({ width: 1500, height: 1900, fit: "inside", withoutEnlargement: true }).png().toBuffer();
          doc.addPage().font("Helvetica-Bold").text(`Image evidence ${asset.id}: ${asset.safeName}`); doc.moveDown().image(rendered, { fit: [510, 650], align: "center", valign: "center" });
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
  const evidenceRows = [new TableRow({ children: ["File", "Type", "Scan", "Size", "Links"].map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) })];
  for (const asset of evidence) {
    const links = [new ExternalHyperlink({ link: asset.reviewUrl, children: [new TextRun({ text: "Open evidence record", style: "Hyperlink" })] })];
    if (asset.downloadUrl) links.push(new ExternalHyperlink({ link: asset.downloadUrl, children: [new TextRun({ text: " · Secure download", style: "Hyperlink" })] }));
    evidenceRows.push(new TableRow({ children: [
      new TableCell({ children: [new Paragraph(asset.safeName), new Paragraph({ children: [new TextRun({ text: `SHA-256 ${asset.sha256}`, size: 16, color: "64748B" })] })] }),
      new TableCell({ children: [new Paragraph(`${asset.kind} / ${asset.mediaType}`)] }),
      new TableCell({ children: [new Paragraph(asset.scanState), ...(!asset.downloadUrl ? [new Paragraph({ children: [new TextRun({ text: "Bytes locked pending controlled scan", color: "92400E" })] })] : [])] }),
      new TableCell({ children: [new Paragraph(asset.byteSize.toLocaleString())] }),
      new TableCell({ children: [new Paragraph({ children: links })] }),
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
  const document = new Document({ sections: [{
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(`BIMLog by IgniteSmart · ${manifest.feedback.stableId} · ${manifest.release} · `), new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] })] })] }) },
    children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("BIMLog Feedback Package")] }),
      field("Release", manifest.release), field("Feedback", manifest.feedback.stableId), field("Submitted by", `${manifest.feedback.submitter.name ?? "Unknown"}${manifest.feedback.submitter.email ? ` <${manifest.feedback.submitter.email}>` : ""}`), field("Submitted", manifest.feedback.createdAt), field("Updated", manifest.feedback.updatedAt), field("Status", manifest.feedback.status), field("Type / priority", `${manifest.feedback.feedbackType} / ${manifest.feedback.priority}`), field("Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : "None"), field("Reported page", manifest.feedback.pageUrl),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Customer message")] }), new Paragraph(manifest.feedback.message),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Evidence inventory")] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: evidenceRows }),
      ...imageSections,
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Status history")] }),
      ...manifest.history.map((event: any) => new Paragraph(`${event.at} — ${event.type}${event.reason ? ` — ${event.reason}` : ""}`)),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Snapshot fingerprint")] }), field("Canonical manifest SHA-256", manifestSha256),
    ],
  }] });
  return Buffer.from(await Packer.toBuffer(document));
}

function createFeedbackWorkbook(manifest: Record<string, any>, evidence: Array<FeedbackPackageAsset & { downloadUrl: string | null; reviewUrl: string }>, manifestSha256: string): Buffer {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["BIMLog Feedback Follow-up"], ["Feedback ID", manifest.feedback.stableId], ["Release", manifest.release], ["Status", manifest.feedback.status], ["Priority", manifest.feedback.priority], ["Type", manifest.feedback.feedbackType], ["Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : ""], ["Submitter", manifest.feedback.submitter.name ?? ""], ["Submitted", manifest.feedback.createdAt], ["Updated", manifest.feedback.updatedAt], ["Target release", manifest.feedback.targetRelease ?? ""], ["Decision / resolution", manifest.feedback.dispositionReason ?? ""], ["Message", manifest.feedback.message], ["Reported page", manifest.feedback.pageUrl], ["Snapshot SHA-256", manifestSha256],
  ]);
  summary["!cols"] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, summary, "Follow-up");
  const evidenceSheet = XLSX.utils.aoa_to_sheet([["ID", "File", "Kind", "Media type", "Bytes", "Scan state", "SHA-256", "Review link", "Secure download"], ...evidence.map(asset => [asset.id, asset.safeName, asset.kind, asset.mediaType, asset.byteSize, asset.scanState, asset.sha256, asset.reviewUrl, asset.downloadUrl ?? "Locked pending scan"])]);
  evidenceSheet["!cols"] = [{ wch: 8 }, { wch: 40 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 66 }, { wch: 72 }, { wch: 72 }];
  evidenceSheet["!autofilter"] = { ref: `A1:I${evidence.length + 1}` }; evidenceSheet["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  for (let row = 2; row <= evidence.length + 1; row++) { const review = evidenceSheet[`H${row}`]; if (review?.v) review.l = { Target: String(review.v), Tooltip: "Open evidence record" }; const download = evidenceSheet[`I${row}`]; if (download?.v && String(download.v).startsWith("http")) download.l = { Target: String(download.v), Tooltip: "Secure authenticated download" }; }
  XLSX.utils.book_append_sheet(workbook, evidenceSheet, "Evidence");
  const history = XLSX.utils.aoa_to_sheet([["Date/time", "Event", "Reason"], ...manifest.history.map((event: any) => [event.at, event.type, event.reason ?? ""])]); history["!cols"] = [{ wch: 28 }, { wch: 34 }, { wch: 90 }]; history["!autofilter"] = { ref: `A1:C${manifest.history.length + 1}` }; history["!freeze"] = { xSplit: 0, ySplit: 1 } as any; XLSX.utils.book_append_sheet(workbook, history, "Activity");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true, bookSST: true }));
}
