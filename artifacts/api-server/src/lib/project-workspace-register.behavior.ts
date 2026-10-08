import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../routes/projects.ts", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../../../bimlog/src/pages/Dashboard.tsx", import.meta.url), "utf8");
const restore = await readFile(new URL("../../../bimlog/src/components/ProjectRestoreDialog.tsx", import.meta.url), "utf8");

assert.ok(routes.indexOf('router.get("/projects/workspace-register"') < routes.indexOf('router.get("/projects/:projectId"'), "literal workspace register must precede project parameter route");
assert.match(routes, /project\.status === "archived" \? "retired"/);
assert.match(routes, /controlled \(\?:live \)\?\(\?:qa\|test\|production sample\)/i);
for (const group of ["Active projects", "Testing projects", "Retired projects", "All projects"]) assert.match(dashboard, new RegExp(group));
assert.match(dashboard, /ProjectRestoreDialog/);
assert.match(restore, /Every preserved record remains attached/);
console.log("PASS project workspace register and restoration UI");
