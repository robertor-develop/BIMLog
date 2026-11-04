import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";

const route=readFileSync("artifacts/api-server/src/routes/projects.ts","utf8");
const service=readFileSync("artifacts/api-server/src/lib/project-retirement.ts","utf8");
const ui=readFileSync("artifacts/bimlog/src/components/ProjectCleanupDialog.tsx","utf8");
const dashboard=readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx","utf8");
const identity='router.post("/projects/workspace-state/batch", authMiddleware';
assert.ok(route.includes(identity),"static workspace batch route must remain routed");
assert.ok(route.indexOf(identity)<route.indexOf('router.post("/projects/:projectId/workspace-state"'),"static route must precede parameter route");
for(const contract of [
  "setProjectWorkspaceStateBatch","Select between 1 and 50 projects","PROJECT_WORKSPACE_BATCH_DUPLICATE","No projects were changed",
  "change_project_workspace_state_batch","recordsPreserved: true","db.transaction","expectedUpdatedAt","adminRoles",
])assert.ok(`${route}\n${service}`.includes(contract),`${contract} must remain in batch authority`);
for(const visible of [
  "Clean up project workspaces","Organizar espacios de proyectos","Move to Testing","Keep active","Review retirement",
  "Protected working project","Preferred reusable QA workspace","Select testing candidates","/projects/workspace-state/batch",
  'aria-live="polite"','role="alert"','aria-modal="true"',
])assert.ok(ui.includes(visible),`${visible} must remain visible`);
assert.match(dashboard,/ProjectCleanupDialog/);assert.match(dashboard,/canManageLifecycle/);assert.match(dashboard,/Every project record was preserved/);
assert.match(ui,/toWorkspaceStateBatchItems\(rows, selected\)/);assert.match(ui,/disabled=\{saving \|\| selected\.size === 0\}/);

const tsx=path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for(const fixture of [
  "artifacts/api-server/src/routes/project-workspace-batch-route.behavior.ts",
  "artifacts/api-server/src/lib/project-workspace-batch.behavior.ts",
  "artifacts/bimlog/src/components/ProjectCleanupDialog.behavior.tsx",
])execFileSync(process.execPath,[tsx,path.resolve(fixture)],{stdio:"inherit",windowsHide:true});
console.log("P205 workspace-state batch discovery, permission boundary, atomicity, stale-write and duplicate rejection, preservation, lifecycle guidance, bilingual accessible dialog, and connected behavior gates passed.");
