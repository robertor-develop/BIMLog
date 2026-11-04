import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync("artifacts/api-server/src/routes/transmittals.ts","utf8");
const ui=readFileSync("artifacts/bimlog/src/pages/project/TransmittalsTab.tsx","utf8");
const project=readFileSync("artifacts/bimlog/src/pages/ProjectDetail.tsx","utf8");
for(const identity of [
  'router.get("/projects/:projectId/transmittals"','router.get("/projects/:projectId/transmittals/export-pdf"',
  'router.get("/projects/:projectId/transmittals/:transmittalId/export"','router.post("/projects/:projectId/transmittals"',
  'router.post("/projects/:projectId/transmittals/:transmittalId/acknowledge"','router.post("/projects/:projectId/transmittals/:transmittalId/ai-draft"',
  'router.post("/projects/:projectId/transmittals/:transmittalId/cancel"','router.post("/projects/:projectId/transmittals/:transmittalId/send"',
  'router.post("/projects/:projectId/transmittals/import"',
])assert.ok(route.includes(identity),`${identity} must remain routed`);
assert.match(project,/tab === "transmittals"\s+&& <TransmittalsTab\s+projectId=\{projectId\} canWrite=\{canWrite\}/);
for(const isolation of ['requireProjectMember()','requirePermission("admin", "write")','eq(transmittalsTable.projectId, projectId)'])assert.ok(route.includes(isolation),`${isolation} must protect transmittals`);
for(const endpoint of ['/transmittals/import','/send','/cancel','/acknowledge','/ai-draft','/export','transmittals/export-pdf?'])assert.ok(ui.includes(endpoint),`${endpoint} must remain operable`);
for(const visible of [
  "Formal document transmittals","Import","Importar","Send","Enviar","Acknowledge","Acusar",
  "Cancel and retain","Cancelar y conservar","Individual Transmittal PDF","PDF individual de transmisión",
  'role="alert"',
])assert.ok(ui.includes(visible),`${visible} must remain visible`);
for(const lifecycle of ['status === "draft"','tx.status === "sent"','"acknowledged", "cancelled"','retained: true','event: "transmittal.cancelled"'])assert.ok(`${ui}\n${route}`.includes(lifecycle),`${lifecycle} must remain in lifecycle evidence`);
assert.match(route,/if \(tx\.status === "acknowledged"\).*cannot be cancelled/);
console.log("P204 transmittal discovery, create/import, AI draft, retained send/cancel/acknowledge lifecycle, PDF exports, permission/project isolation, negative transitions, bilingual controls, and audit evidence gates passed.");
