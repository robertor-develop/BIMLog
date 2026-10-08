import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const dialog = await readFile(new URL("../components/ProjectCleanupDialog.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../../../api-server/src/lib/project-retirement.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../../../api-server/src/routes/projects.ts", import.meta.url), "utf8");

for (const value of ["Clean up projects", "Organizar proyectos", "ProjectCleanupDialog", "canManageLifecycle", "projectRows"]) assert.match(dashboard, new RegExp(value));
for (const value of ["Select visible", "Move to Testing", "Keep active", "Review retirement", "records", "libraries"]) assert.match(dialog, new RegExp(value));
for (const value of ["setProjectWorkspaceStateBatch", "db.transaction", "PROJECT_WORKSPACE_BATCH_STALE", "recordsPreserved: true"]) assert.match(service, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(route, /router\.post\("\/projects\/workspace-state\/batch", authMiddleware/);
assert.doesNotMatch(dialog, /delete|hard delete/i);

console.log("Headquarters lifecycle Block 4 acceptance: PASS");
