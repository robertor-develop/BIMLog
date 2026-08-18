import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";
import sharp from "sharp";
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
  const evidence = [] as Array<FeedbackPackageAsset & { zipName: string; downloadUrl: string | null }>;
  for (const asset of args.assets) {
    const clean = asset.scanState === "clean" && asset.scannedAt instanceof Date;
    if (asset.scanState === "clean" && !clean) throw new FeedbackPackageError(`Evidence ${asset.id} has no completed scanner receipt`, "PACKAGE_INTEGRITY");
    if (clean && (!asset.bytes || asset.bytes.byteLength !== asset.byteSize || asset.byteSize > FEEDBACK_MAX_FILE_BYTES || sha256(asset.bytes) !== asset.sha256))
      throw new FeedbackPackageError(`Evidence ${asset.id} failed bounded integrity verification`, "PACKAGE_INTEGRITY");
    if (clean) total += asset.byteSize;
    if (total > FEEDBACK_PACKAGE_MAX_BYTES) throw new FeedbackPackageError("Feedback evidence exceeds the package byte bound", "PACKAGE_LIMIT");
    const downloadPath = args.visibility === "internal" ? `/api/v1/feedback/admin/${args.feedback.id}/assets/${asset.id}/download` : `/api/v1/feedback/${args.feedback.id}/assets/${asset.id}/download`;
    evidence.push({ ...asset, zipName: `evidence/${String(asset.id).padStart(6, "0")}-${packageName(asset.safeName)}`, downloadUrl: clean ? `${args.baseUrl}${downloadPath}` : null });
  }
  const events = args.events.filter(event => args.visibility === "internal" || customerEvents.has(event.eventType)).map(event => ({
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
    evidence: evidence.map(asset => ({ id: asset.id, kind: asset.kind, name: asset.safeName, mediaType: asset.mediaType, byteSize: asset.byteSize, sha256: asset.sha256, scanState: asset.scanState, scannedAt: asset.scannedAt?.toISOString() ?? null, createdAt: asset.createdAt.toISOString(), included: asset.scanState === "clean" && !!asset.scannedAt, zipPath: asset.scanState === "clean" && asset.scannedAt ? asset.zipName : null, secureDownloadUrl: asset.downloadUrl })),
  };
  const manifest = Buffer.from(`${canonical(manifestObject)}\n`, "utf8");
  const pdf = await createHumanPdf(manifestObject, evidence);
  const zip = new AdmZip(); zip.addFile("manifest.json", manifest); zip.addFile(`${packageName(args.feedback.stableId)}-feedback.pdf`, pdf);
  for (const asset of evidence) if (asset.scanState === "clean" && asset.scannedAt && asset.bytes) zip.addFile(asset.zipName, asset.bytes);
  const archive = zip.toBuffer();
  if (archive.byteLength > FEEDBACK_PACKAGE_MAX_BYTES + 10 * 1024 * 1024) throw new FeedbackPackageError("Generated feedback package exceeds the archive bound", "PACKAGE_LIMIT");
  return { archive, manifest, pdf, manifestSha256: sha256(manifest), archiveSha256: sha256(archive) };
}

async function createHumanPdf(manifest: Record<string, any>, evidence: Array<FeedbackPackageAsset & { downloadUrl: string | null }>): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; const doc = new PDFDocument({ size: "LETTER", margin: 50, info: { Title: `${manifest.feedback.stableId} Feedback Package`, Author: "BIMLog" } });
    doc.on("data", chunk => chunks.push(Buffer.from(chunk))); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
    const field = (label: string, value: unknown) => { doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(String(value ?? "—")); };
    doc.fontSize(18).font("Helvetica-Bold").text("BIMLog Feedback Package"); doc.moveDown(0.5).fontSize(10);
    field("Release", manifest.release); field("Feedback", manifest.feedback.stableId); field("Submitted by", `${manifest.feedback.submitter.name ?? "Unknown"}${manifest.feedback.submitter.email ? ` <${manifest.feedback.submitter.email}>` : ""}`);
    field("Submitted date/time", manifest.feedback.createdAt); field("Last updated", manifest.feedback.updatedAt); field("Status", manifest.feedback.status); field("Type / priority", `${manifest.feedback.feedbackType} / ${manifest.feedback.priority}`); field("Project", manifest.feedback.project ? `${manifest.feedback.project.code ?? ""} ${manifest.feedback.project.name ?? ""}`.trim() : "None"); field("Module / page", `${manifest.feedback.module ?? "—"} / ${manifest.feedback.pageUrl}`);
    doc.moveDown().font("Helvetica-Bold").text("Message"); doc.font("Helvetica").text(manifest.feedback.message); doc.moveDown().font("Helvetica-Bold").text("Status history");
    for (const event of manifest.history) doc.font("Helvetica").text(`${event.at} — ${event.type}${event.reason ? ` — ${event.reason}` : ""}`);
    doc.addPage().font("Helvetica-Bold").text("Evidence inventory");
    for (const asset of manifest.evidence) { doc.moveDown(0.4).font("Helvetica-Bold").text(`${asset.id} · ${asset.name}`); doc.font("Helvetica").text(`${asset.kind} · ${asset.mediaType} · ${asset.byteSize} bytes · scan ${asset.scanState}`); doc.text(`SHA-256 ${asset.sha256}`); if (asset.secureDownloadUrl) doc.fillColor("blue").text("Secure authenticated download", { link: asset.secureDownloadUrl, underline: true }).fillColor("black"); }
    void (async () => {
      try {
        for (const asset of evidence) if (asset.scanState === "clean" && asset.scannedAt && asset.bytes && /^image\/(png|jpe?g)$/.test(asset.mediaType)) {
          const metadata = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).metadata();
          if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_EMBEDDED_IMAGE_PIXELS) throw new FeedbackPackageError(`Image evidence ${asset.id} exceeds the render bound`, "PACKAGE_LIMIT");
          const rendered = await sharp(asset.bytes, { limitInputPixels: MAX_EMBEDDED_IMAGE_PIXELS }).rotate().resize({ width: 1500, height: 1900, fit: "inside", withoutEnlargement: true }).png().toBuffer();
          doc.addPage().font("Helvetica-Bold").text(`Image evidence ${asset.id}: ${asset.safeName}`); doc.moveDown().image(rendered, { fit: [510, 650], align: "center", valign: "center" });
        }
        doc.end();
      } catch (error) { doc.removeAllListeners("data"); doc.removeAllListeners("end"); doc.end(); reject(error); }
    })();
  });
}
