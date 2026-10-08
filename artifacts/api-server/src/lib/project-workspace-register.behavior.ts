import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../routes/projects.ts", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../../../bimlog/src/pages/Dashboard.tsx", import.meta.url), "utf8");
const restore = await readFile(new URL("../../../bimlog/src/components/ProjectRestoreDialog.tsx", import.meta.url), "utf8");

assert.ok(routes.indexOf('router.get("/projects/workspace-register"') < routes.indexOf('router.get("/projects/:projectId"'), "literal workspace register must precede project parameter route");
assert.match(routes, /project\.status === "archived" \? "retired"/);
assert.match(routes, /project\.status === "testing" \? "testing" : "active"/);
assert.match(routes, /router\.post\("\/projects\/:projectId\/workspace-state"/);
assert.doesNotMatch(routes, /syntheticEvidence/);
assert.match(routes, /canManageLifecycle: Boolean\(freshActor\?\.isSuperAdmin \|\| project\.createdById === userId \|\| adminRoles\.includes/);
assert.match(dashboard, /const isAdmin = project\.canManageLifecycle === true/);
for (const group of ["Active projects", "Testing projects", "Retired projects", "All projects"]) assert.match(dashboard, new RegExp(group));
for (const action of ["Mark testing", "Make active", "PREFERRED TEST", "Reuse one test workspace"]) assert.match(dashboard, new RegExp(action));
assert.match(dashboard, /ProjectRestoreDialog/);
assert.match(restore, /Every preserved record remains attached/);
console.log("PASS project workspace register and restoration UI");
