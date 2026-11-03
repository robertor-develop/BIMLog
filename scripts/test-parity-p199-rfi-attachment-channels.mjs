import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/rfis.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/project/RfisTab.tsx", "utf8");

for (const identity of [
  'post("/projects/:projectId/rfis/attachments/from-google-drive"',
  'post("/projects/:projectId/rfis/attachments/from-cloud"',
  'post("/projects/:projectId/rfis/attachments/paste-image"',
  'post("/projects/:projectId/rfis/attachments/screen-snip"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);

for (const contract of [
  'requirePermission("admin", "write")',
  'validateRfiAttachmentTarget(projectId, rfiId)',
  'getValidAccessToken(req.user!.userId, "google_drive")',
  'application/vnd.google-apps',
  'isProviderOperationCurrentlyAllowed(key, req.user!.companyId, "import")',
  'PROVIDER_NOT_APPROVED',
  'imageOrigin && !isImageUpload',
  'This image channel accepts PNG or JPEG files only.',
  'Zero-byte files cannot be attached.',
]) assert.ok(route.includes(contract), `${contract} must remain in attachment custody`);

for (const contract of [
  'Attach from ${provider.label}', 'Adjuntar desde ${provider.label}',
  '/rfis/attachments/from-cloud',
  'Attached from ${provider.label}', 'Adjuntado desde ${provider.label}',
  'Paste Image', 'Pegar Imagen',
  'Capture Screen', 'Capturar Pantalla',
  'Clipboard image access was denied.',
  'Screen capture was cancelled or permission was denied.',
  'state: "success"', 'state: "error"',
]) assert.ok(ui.includes(contract), `${contract} must remain visible`);

assert.match(ui, /navigator\.clipboard\?\.read/);
assert.match(ui, /acquireCapturedFrame/);
assert.match(ui, /RfiImageCropEditor/);
assert.match(ui, /result\.state === "success"/);

const result = spawnSync(process.execPath, [
  "artifacts/api-server/src/lib/post-p17-build28-rfi-attachment-integrity.behavior.mjs",
], { stdio: "inherit", windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P199 RFI Google/cloud import, provider approval, project/RFI isolation, paste and screen-snip image review, bounded custody, staged cleanup, bilingual success/error, and download integrity gates passed.");
