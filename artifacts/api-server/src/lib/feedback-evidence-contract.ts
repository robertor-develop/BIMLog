import { createHash } from "node:crypto";
import path from "node:path";

export const FEEDBACK_MAX_FILES = 10;
export const FEEDBACK_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FEEDBACK_RELEASE = "v F-1.60.35.8";
const EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".txt", ".log", ".json", ".webm", ".ogg", ".wav", ".m4a"]);

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
  const valid = ext === ".pdf" ? signature(b, [0x25, 0x50, 0x44, 0x46]) : ext === ".png" ? signature(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : [".jpg", ".jpeg"].includes(ext) ? signature(b, [0xff, 0xd8, 0xff]) : [".docx", ".xlsx", ".pptx"].includes(ext) ? zip
    : [".doc", ".xls", ".ppt"].includes(ext) ? ole : ext === ".wav" ? b.subarray(0, 4).toString("ascii") === "RIFF"
    : ext === ".ogg" ? b.subarray(0, 4).toString("ascii") === "OggS" : ext === ".webm" ? signature(b, [0x1a, 0x45, 0xdf, 0xa3])
    : ext === ".m4a" ? b.subarray(4, 8).toString("ascii") === "ftyp" : !b.includes(0);
  if (!valid) throw new FeedbackEvidenceError(415, "FEEDBACK_FILE_SIGNATURE_MISMATCH", "File content does not match its extension");
  return { name, sha256: createHash("sha256").update(b).digest("hex") };
}
