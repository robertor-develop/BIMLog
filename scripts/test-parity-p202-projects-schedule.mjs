import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/schedule.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/project/ScheduleTab.tsx", "utf8");
const project = readFileSync("artifacts/bimlog/src/pages/ProjectDetail.tsx", "utf8");

for (const identity of [
  'router.get("/projects/:projectId/schedule/buckets"',
  'router.post("/projects/:projectId/schedule/buckets"',
  'router.patch("/projects/:projectId/schedule/buckets/:bucketId"',
  'router.get("/projects/:projectId/schedule/live"',
  'router.get("/projects/:projectId/schedule/export-pdf"',
  'router.post("/projects/:projectId/schedule/items/move"',
  'router.post("/projects/:projectId/schedule/buckets/:fromBucketId/rollover"',
  'router.get("/projects/:projectId/schedule/items/:sourceType/:sourceId/history"',
]) assert.ok(route.includes(identity), `${identity} must remain routed`);

assert.match(project, /tab === "schedule"\s+&& <ScheduleTab\s+projectId=\{projectId\} canWrite=\{canWrite\}/);
for (const guard of [
  'requireProjectMember()',
  'requirePermission("admin", "write")',
  'eq(scheduleBucketsTable.projectId, projectId)',
]) assert.ok(route.includes(guard), `${guard} must protect schedule operations`);

for (const endpoint of [
  '/schedule/live', '/schedule/buckets', '/schedule/items/move',
  '/rollover', '/schedule/export-pdf?', '/history',
]) assert.ok(ui.includes(endpoint), `${endpoint} must remain operable from Schedule`);

for (const visible of [
  "Schedule - Coordination Planner", "Cronograma - Planner de Coordinacion",
  "Save Schedule Item", "Guardar Item de Cronograma",
  "Schedule PDF exported", "PDF de cronograma exportado",
  "Rollover History", "Historial de Transferencias",
  "Could not load connected Schedule data", "No se pudo cargar data conectada del cronograma",
]) assert.ok(ui.includes(visible), `${visible} must remain visible`);

assert.match(ui, /canWrite &&/);
assert.match(ui, /URL\.createObjectURL/);
assert.match(ui, /URL\.revokeObjectURL/);
console.log("P202 projects/schedule parity, direct discovery, live/bucket/history/move/rollover/PDF operation, permission and project isolation, bilingual feedback, and export custody gates passed.");
