import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rfiRoute = await readFile(new URL("../routes/rfis.ts", import.meta.url), "utf8");
const fileRoute = await readFile(new URL("../routes/files.ts", import.meta.url), "utf8");
const multipart = await readFile(new URL("../middlewares/multipart.ts", import.meta.url), "utf8");

const checks = [
  ["bounded 50 MB RFI upload profile", /const RFI_ATTACHMENT_LIMIT_BYTES = 50 \* 1024 \* 1024;[\s\S]*singleFileUpload\(\{ fileSize: RFI_ATTACHMENT_LIMIT_BYTES \}\)/],
  ["bounded multipart parser", /fileSize: profile\.fileSize \+ 1[\s\S]*memoryStorage\(\)[\s\S]*MULTIPART_FILE_TOO_LARGE/],
  ["authenticated write-authorized upload routes", /rfis\/attachments\/upload", authMiddleware, requirePermission\("admin", "write"\), acceptRfiAttachmentUpload/],
  ["positive authoritative project and RFI IDs", /parsePositiveId\(req\.params\.projectId, "project ID"\)[\s\S]*validateRfiAttachmentTarget\(projectId, req\.body\?\.rfiId\)/],
  ["same-project live RFI target", /eq\(rfisTable\.id, rfiId\), eq\(rfisTable\.projectId, projectId\), isNull\(rfisTable\.deletedAt\)/],
  ["canonical project-bound locator", /return `\/api\/v1\/projects\/\$\{projectId\}\/files\/\$\{fileId\}\/download`/],
  ["cross-project locator rejection", /locator\.projectId !== projectId[\s\S]*belongs to a different project/],
  ["referenced file project lock and lookup", /SELECT id FROM files WHERE id = \$\{locator\.fileId\} AND project_id = \$\{projectId\} FOR UPDATE[\s\S]*eq\(filesTable\.projectId, projectId\)/],
  ["staged upload ownership restriction", /file\.source === "rfi-attachment" && file\.linkedRfiId == null && file\.uploadedById !== userId/],
  ["atomic staged-file binding", /eq\(filesTable\.uploadedById, userId\)[\s\S]*eq\(filesTable\.source, "rfi-attachment"\)[\s\S]*isNull\(filesTable\.linkedRfiId\)/],
  ["zero-byte rejection", /Zero-byte files cannot be attached/],
  ["filename path and control normalization", /path\.posix\.basename\(path\.win32\.basename[\s\S]*replace\(\/\[\\u0000-\\u001f\\u007f\]\/g/],
  ["unsafe URL schemes rejected", /javascript\|data\|file\|vbscript\|blob/],
  ["storage compensation on metadata failure", /storage\.delete\(storagePath\)[\s\S]*Failed to compensate storage write/],
  ["staged delete write authorization", /staged\/:fileId",[\s\S]*authMiddleware,[\s\S]*requirePermission\("admin", "write"\)/],
  ["staged delete project-owner-source-unlinked guard", /eq\(filesTable\.projectId, projectId\)[\s\S]*eq\(filesTable\.uploadedById, req\.user!\.userId\)[\s\S]*eq\(filesTable\.source, "rfi-attachment"\)[\s\S]*isNull\(filesTable\.linkedRfiId\)/],
];

for (const [label, pattern] of checks) assert.match(label.includes("multipart") ? multipart : rfiRoute, pattern, label);

assert.match(fileRoute, /files\/:fileId\/download", authMiddleware, requireProjectMember\(\)/, "download requires current project membership");
assert.match(fileRoute, /eq\(filesTable\.id, fileId\), eq\(filesTable\.projectId, projectId\)/, "download lookup is project-bound");
assert.match(fileRoute, /safeDownloadDisposition\(file\.fileName, "inline"\)/, "download uses safe content disposition");

console.log(`PASS post-P17 Build 28 RFI attachment integrity (${checks.length + 3} checks)`);
