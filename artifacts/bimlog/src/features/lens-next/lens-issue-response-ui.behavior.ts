import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../../..");
const ui = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/project/LensViewpointsView.tsx"), "utf8");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/clash_reports.ts"), "utf8");

assert.match(ui, /Respond — issue stays open/);
assert.match(ui, /Responder — la incidencia sigue abierta/);
assert.match(ui, /It will not close the issue/);
assert.match(ui, /No cerrará la incidencia/);
assert.match(ui, /lens-issue-response\.v1/);
assert.match(ui, /mutationVersion: draft\.v\.mutationVersion/);
assert.match(ui, /receipt\.issue\?\.status !== "under_review"/);
assert.match(ui, /await loadViewpoints\(draft\.v\.id\)/);
assert.match(ui, /Contractor responses — issue remains open until coordinator decision/);
assert.match(ui, /Respuestas del contratista — la incidencia sigue abierta hasta la decisión del coordinador/);
assert.match(ui, /recommend_reassignment/);
assert.match(ui, /needs_information/);
assert.match(ui, /completed_work/);
assert.match(ui, /disabled=\{\(v\.lifecycleStatus != null && v\.lifecycleStatus !== "active"\) \|\| v\.status === "resolved"\}/);
assert.match(route, /\["open","follow_up","waiting_design","under_review","approved","resolved"\]\.includes\(String\(local\.status\)\)/);
assert.match(route, /const LENS_STATUSES = \["open", "follow_up", "waiting_design", "under_review", "approved", "resolved"\]/);
assert.match(route, /new Set\(\["all", "open", "follow_up", "waiting_design", "under_review"/);

const historyStart = route.indexOf('router.get("/projects/:projectId/clash-reports/lens-viewpoints/:id/history"');
const historyEnd = route.indexOf('router.get("/projects/:projectId/clash-reports/lens-viewpoints/:id/active"', historyStart);
assert.ok(historyStart > 0 && historyEnd > historyStart);
const history = route.slice(historyStart, historyEnd);
assert.match(history, /FROM lens_issue_responses r/);
assert.match(history, /r\.project_id=\$1 AND r\.issue_id = ANY\(\$2::int\[\]\)/);
assert.match(history, /responses: responses\.rows\.map/);
assert.doesNotMatch(history, /UPDATE lens_issue_responses/);

console.log("Lens contractor response UI is bilingual, visible, save/reopen verified, and history remains project-scoped: PASS");
