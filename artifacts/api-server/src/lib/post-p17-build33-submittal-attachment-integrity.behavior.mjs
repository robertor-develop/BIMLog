import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../routes/submittals.ts", import.meta.url), "utf8");
const files = await readFile(new URL("../routes/files.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");

const checks = [
  ["upload requires authenticated project write authority", api, /submittals\/attachments\/upload"[\s\S]*authMiddleware,[\s\S]*requirePermission\("admin", "write"\)/],
  ["upload has a server-side 50 MB boundary", api, /singleFileUpload\(\{ fileSize: 50 \* 1024 \* 1024 \}\)/],
  ["stored file is bound to route project and uploader", api, /db\.insert\(filesTable\)\.values\(\{[\s\S]*projectId,[\s\S]*uploadedById: req\.user!\.userId,[\s\S]*source: "submittal-attachment"/],
  ["incomplete metadata persistence compensates stored object", api, /if \(pendingStoragePath\)[\s\S]*await storage\.delete\(pendingStoragePath\)/],
  ["download URL carries authoritative project and file IDs", api, /`\/api\/v1\/projects\/\$\{projectId\}\/files\/\$\{row\.id\}\/download\?name=/],
  ["download requires project membership", files, /router\.get\("\/projects\/:projectId\/files\/:fileId\/download", authMiddleware, requireProjectMember\(\)/],
  ["download lookup binds file and project", files, /eq\(filesTable\.id, fileId\), eq\(filesTable\.projectId, projectId\)/],
  ["stored attachment content is served through storage abstraction", files, /if \(file\.storagePath\)[\s\S]*storage\.download\(file\.storagePath\)/],
  ["UI uploads through the project-scoped endpoint", ui, /`\/api\/v1\/projects\/\$\{projectId\}\/submittals\/attachments\/upload`/],
  ["UI persists attachment references through authoritative submittal update", ui, /`\/api\/v1\/projects\/\$\{projectId\}\/submittals\/\$\{submittal\.id\}`[\s\S]*JSON\.stringify\(\{ attachmentsJson: nextAttachments \}\)/],
  ["UI opens authenticated project file URLs without changing relationships", ui, /<a href=\{name\} target="_blank" rel="noreferrer"/],
  ["attachment edits remain separate from linked RFI identity", ui, /linkedRfiId: editForm\.linkedRfiId[\s\S]*attachmentsJson: attachmentValues\(editForm\.attachmentsText\)/],
];

for (const [label, source, pattern] of checks) assert.match(source, pattern, label);
console.log(`PASS post-P17 Build 33 Submittal attachment integrity (${checks.length} checks)`);
