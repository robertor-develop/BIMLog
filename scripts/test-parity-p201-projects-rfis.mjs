import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/rfis.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/project/RfisTab.tsx", "utf8");
const project = readFileSync("artifacts/bimlog/src/pages/ProjectDetail.tsx", "utf8");
const presentation = readFileSync("artifacts/bimlog/src/pages/project/rfi-frontend/rfi-action-presentation.ts", "utf8");

for (const identity of [
  'router.post("/projects/:projectId/rfis/:rfiId/revise"',
  'post("/projects/:projectId/rfis/attachments/from-google-drive"',
  'post("/projects/:projectId/rfis/attachments/paste-image"',
  'post("/projects/:projectId/rfis/attachments/screen-snip"',
  'router.post("/projects/:projectId/rfis/from-viewpoint"',
  'router.post("/projects/:projectId/rfis/report-settings/preview"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);

assert.match(project, /tab === "rfis"\s+&& <RfisTab\s+projectId=\{projectId\} canWrite=\{canWrite\}/);
for (const contract of [
  'requirePermission("admin", "write")',
  'requireProjectMember()',
  'eq(rfisTable.projectId, projectId)',
  'error: "project_mismatch"',
]) assert.ok(route.includes(contract), `${contract} must protect RFI actions`);

for (const visible of [
  "Create Revision", "Crear Revision",
  "Paste Image", "Pegar Imagen",
  "Capture Screen", "Capturar Pantalla",
  "Verify Preview", "Verificar vista previa",
  'role="status"', 'aria-live="polite"',
]) assert.ok(`${ui}\n${presentation}`.includes(visible), `${visible} must remain discoverable`);

for (const focused of [
  "scripts/test-parity-p198-rfi-revision.mjs",
  "scripts/test-parity-p199-rfi-attachment-channels.mjs",
  "scripts/test-parity-p200-rfi-viewpoint-report-preview.mjs",
]) {
  const result = spawnSync(process.execPath, [focused], { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("P201 projects/rfis consolidated parity, discovery, permission, project isolation, bilingual operation, error/success feedback, accessibility, and connected RFI regressions passed.");
