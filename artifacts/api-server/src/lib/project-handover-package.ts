import { createHash } from "node:crypto";
import path from "node:path";
import AdmZip from "adm-zip";

export type HandoverFileRecord = {
  id: number;
  fileName: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  status: string;
  relationship: string;
  version: number;
  createdAt: string;
  bytes?: Buffer;
};

export type HandoverProject = { id: number; code: string; name: string };
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const csvCell = (value: unknown) => {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const xml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const archiveName = (record: HandoverFileRecord) => `${String(record.id).padStart(8, "0")}-${path.basename(record.fileName).normalize("NFKC").replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_").replace(/^\.+/, "") || "file"}`;

export function buildProjectHandoverPackage(input: { project: HandoverProject; generatedAt: string; files: HandoverFileRecord[] }) {
  if (!Number.isSafeInteger(input.project.id) || input.project.id <= 0 || !input.project.code.trim() || !input.project.name.trim()) throw new Error("HANDOVER_PROJECT_INVALID");
  const files = [...input.files].sort((left, right) => left.id - right.id);
  const ids = new Set<number>();
  for (const file of files) {
    if (!Number.isSafeInteger(file.id) || file.id <= 0 || ids.has(file.id) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.byteSize) || file.byteSize < 0) throw new Error("HANDOVER_FILE_RECORD_INVALID");
    ids.add(file.id);
    if (file.bytes && (file.bytes.length !== file.byteSize || sha256(file.bytes) !== file.sha256)) throw new Error("HANDOVER_FILE_INTEGRITY_MISMATCH");
  }
  const columns = ["id", "file_name", "media_type", "byte_size", "sha256", "status", "relationship", "version", "created_at"];
  const csv = Buffer.from([columns.map(csvCell).join(","), ...files.map(file => [file.id, file.fileName, file.mediaType, file.byteSize, file.sha256, file.status, file.relationship, file.version, file.createdAt].map(csvCell).join(","))].join("\r\n") + "\r\n", "utf8");
  const xmlRegister = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<handover project-id="${input.project.id}" project-code="${xml(input.project.code)}" generated-at="${xml(input.generatedAt)}">\n${files.map(file => `  <file id="${file.id}" version="${file.version}" bytes="${file.byteSize}" sha256="${file.sha256}"><name>${xml(file.fileName)}</name><media-type>${xml(file.mediaType)}</media-type><status>${xml(file.status)}</status><relationship>${xml(file.relationship)}</relationship><created-at>${xml(file.createdAt)}</created-at></file>`).join("\n")}\n</handover>\n`, "utf8");
  const manifestObject = {
    schemaVersion: 1,
    project: input.project,
    generatedAt: input.generatedAt,
    artifacts: { "files.csv": sha256(csv), "files.xml": sha256(xmlRegister) },
    files: files.map(file => ({ id: file.id, archivePath: file.bytes ? `files/${archiveName(file)}` : null, fileName: file.fileName, mediaType: file.mediaType, byteSize: file.byteSize, sha256: file.sha256, status: file.status, relationship: file.relationship, version: file.version, createdAt: file.createdAt })),
  };
  const manifest = Buffer.from(`${JSON.stringify(manifestObject, null, 2)}\n`, "utf8");
  const zip = new AdmZip();
  zip.addFile("manifest.json", manifest); zip.addFile("files.csv", csv); zip.addFile("files.xml", xmlRegister);
  for (const file of files) if (file.bytes) zip.addFile(`files/${archiveName(file)}`, file.bytes);
  const archive = zip.toBuffer();
  return Object.freeze({ archive, archiveSha256: sha256(archive), manifest, manifestSha256: sha256(manifest), csv, xml: xmlRegister, fileCount: files.length });
}
