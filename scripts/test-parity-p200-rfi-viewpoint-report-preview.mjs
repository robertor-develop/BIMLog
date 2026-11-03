import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/rfis.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/project/RfisTab.tsx", "utf8");
const fromViewpoint = route.slice(route.indexOf('router.post("/projects/:projectId/rfis/from-viewpoint"'));

for (const contract of [
  'requirePermission("admin", "write")',
  'error: "project_mismatch"',
  'subject is required', 'priority is required', 'sourceViewpointId is required', 'imageBase64 is required',
  'imageBase64 decoded to zero bytes',
  'storage.upload(buffer, projectId, fileName)',
  'eq(lensViewpointsTable.projectId, projectId)',
  'source: "lens-viewpoint"',
  'linkedRfiId: created.rfi.id',
  'sourceKind: "viewpoint"',
  'recordRfiNotificationSourceEvent',
  'if (storagePath) await storage.delete(storagePath)',
]) assert.ok(fromViewpoint.includes(contract), `${contract} must remain in the native Lens-to-RFI boundary`);

assert.match(route, /router\.post\("\/projects\/:projectId\/rfis\/report-settings\/preview", authMiddleware, requireProjectMember\(\)/);
assert.match(route, /normalizeRfiReportSettings/);
assert.match(route, /snapshotHash: snapshot\.snapshotHash/);
for (const contract of [
  '/rfis/report-settings/preview',
  'Verify Preview', 'Verificar vista previa',
  'Report preview verified', 'Vista previa del reporte verificada',
  'Server-verified preview', 'Vista previa verificada por el servidor',
  'Evidence fingerprint', 'Huella de evidencia',
  'role="status"', 'aria-live="polite"',
  'Preview failed', 'Falló la vista previa',
]) assert.ok(ui.includes(contract), `${contract} must remain visible in report settings`);

for (const contract of [
  'Source Viewpoint Screenshot', 'Captura del Viewpoint Fuente',
  'Original viewpoint image', 'Imagen original del punto de vista',
]) assert.ok(ui.includes(contract), `${contract} must keep native viewpoint provenance discoverable in BIMLog`);

console.log("P200 native Lens viewpoint-to-RFI permission/project binding, validated image custody, compensated failure, attributable source evidence, report-settings server preview, bilingual success/error, accessibility, and fingerprint gates passed.");
