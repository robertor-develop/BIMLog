import { createHash } from "node:crypto";
import path from "node:path";

export const FEEDBACK_MAX_FILES = 10;
export const FEEDBACK_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FEEDBACK_RELEASE = "v F-1.60.35.8";
const EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".txt", ".log", ".json", ".webm", ".ogg", ".wav", ".m4a"]);
const MEDIA_TYPES: Record<string, string> = { ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".csv": "text/csv", ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".txt": "text/plain", ".log": "text/plain", ".json": "application/json", ".webm": "audio/webm", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4" };

export class FeedbackEvidenceError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export function sanitizeFeedbackFilename(name: string) {
  return path.basename(name).normalize("NFKC").replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_").replace(/^\.+/, "").slice(0, 160) || "attachment";
}
const signature = (buffer: Buffer, bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);

export function inspectFeedbackEvidence(input: { originalname: string; size: number; buffer: Buffer }) {
  const name = sanitizeFeedbackFilename(input.originalname), ext = path.extname(name).toLowerCase(), b = input.buffer;
  if (!EXTENSIONS.has(ext)) throw new FeedbackEvidenceError(415, "FEEDBACK_FILE_TYPE_REJECTED", "This file type is not supported");
  if (!input.size || input.size > FEEDBACK_MAX_FILE_BYTES) throw new FeedbackEvidenceError(413, "FEEDBACK_FILE_SIZE_REJECTED", "The file exceeds the 20 MB limit");
  const zip = signature(b, [0x50, 0x4b, 0x03, 0x04]), ole = signature(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const archiveText = zip ? b.toString("latin1") : "";
  const expectedOfficeRoot = ext === ".docx" ? "word/" : ext === ".xlsx" ? "xl/" : "ppt/";
  const safeOoxml = zip && archiveText.includes("[Content_Types].xml") && archiveText.includes(expectedOfficeRoot)
    && !/(vbaProject\.bin|macrosheets|encryptedpackage|encryptioninfo)/i.test(archiveText);
  const valid = ext === ".pdf" ? signature(b, [0x25, 0x50, 0x44, 0x46]) && b.subarray(Math.max(0, b.length - 2048)).includes(Buffer.from("%%EOF")) : ext === ".png" ? signature(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : [".jpg", ".jpeg"].includes(ext) ? signature(b, [0xff, 0xd8, 0xff]) : [".docx", ".xlsx", ".pptx"].includes(ext) ? zip
    : [".doc", ".xls", ".ppt"].includes(ext) ? ole : ext === ".wav" ? b.subarray(0, 4).toString("ascii") === "RIFF"
    : ext === ".ogg" ? b.subarray(0, 4).toString("ascii") === "OggS" : ext === ".webm" ? signature(b, [0x1a, 0x45, 0xdf, 0xa3])
    : ext === ".m4a" ? b.subarray(4, 8).toString("ascii") === "ftyp" : !b.includes(0);
  if (!valid) throw new FeedbackEvidenceError(415, "FEEDBACK_FILE_SIGNATURE_MISMATCH", "File content does not match its extension");
  if ([".docx", ".xlsx", ".pptx"].includes(ext) && !safeOoxml) throw new FeedbackEvidenceError(415, "FEEDBACK_OOXML_UNSAFE", "Office package structure is missing, encrypted, or macro-enabled");
  return { name, mediaType: MEDIA_TYPES[ext], sha256: createHash("sha256").update(b).digest("hex") };
}
