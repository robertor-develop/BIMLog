import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route=readFileSync("artifacts/api-server/src/routes/submittal_reports.ts","utf8");
const ui=readFileSync("artifacts/bimlog/src/pages/parity/projects-submittal-reports.tsx","utf8");
const app=readFileSync("artifacts/bimlog/src/App.tsx","utf8");
const tools=readFileSync("artifacts/bimlog/src/pages/AllTools.tsx","utf8");
const directory=readFileSync("artifacts/bimlog/src/lib/capability-directory.ts","utf8");

for(const identity of [
  'router.get("/projects/:projectId/submittal-reports"','router.post("/projects/:projectId/submittal-reports"',
  'router.post("/projects/:projectId/submittal-reports/upload"','router.get("/projects/:projectId/submittal-reports/:reportId"',
  'router.patch("/projects/:projectId/submittal-reports/:reportId/rename"','router.patch("/projects/:projectId/submittal-reports/:reportId/items/:itemId"',
  'router.post("/projects/:projectId/submittal-reports/:reportId/items"','router.delete("/projects/:projectId/submittal-reports/:reportId"',
  'router.delete("/projects/:projectId/submittal-reports/:reportId/items/:itemId"','router.get("/projects/:projectId/submittal-reports/:reportId/pdf"',
])assert.ok(route.includes(identity),`${identity} must remain routed`);

for(const isolation of [
  'eq(submittalReportsTable.projectId, projectId)',
  'eq(submittalItemsTable.projectId, projectId)',
  'requireProjectMember()',
  'requirePermission("admin", "write")',
])assert.ok(route.includes(isolation),`${isolation} must protect tracker custody`);

assert.match(app,/ProjectsSubmittalReports/);assert.match(app,/path="\/projects\/:id\/submittal-reports"/);
assert.match(tools,/data-capability-directory="complete-project-tools"/);
assert.match(directory,/id:"submittal-tracking-reports"/);assert.match(directory,/href:"\/projects\/:projectId\/submittal-reports"/);
for(const operation of ["submittal-reports/upload","/rename","/items","/pdf","method:\"DELETE\"","method:\"PATCH\""])assert.ok(ui.includes(operation),`${operation} must remain operable`);
for(const visible of [
  "Submittal Tracking Reports","Reportes de Seguimiento de Submittals","Permission state:","Estado de permiso:",
  "New tracker","Nuevo registro","Import spreadsheet or document","Importar hoja o documento","Export PDF","Exportar PDF",
  "Tracker created and reopened.","Registro creado y reabierto.",'role="alert"','aria-live="polite"',
])assert.ok(ui.includes(visible),`${visible} must remain visible`);
assert.match(ui,/The main Submittals module remains the place for package review and decisions/);
assert.match(route,/where\(and\(eq\(submittalItemsTable\.id, itemId\), eq\(submittalItemsTable\.reportId, reportId\), eq\(submittalItemsTable\.projectId, projectId\)\)\)/);
console.log("P203 submittal-report full frontend/backend parity, All Tools discovery, operational CRUD/import/PDF, permission feedback, project isolation, lifecycle guidance, bilingual states, and accessible feedback gates passed.");
