import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./ProjectCleanupDialog.tsx", import.meta.url), "utf8");
for (const text of ["Clean up project workspaces", "Organizar espacios de proyectos", "Move to Testing", "Keep active", "Review retirement", "/projects/workspace-state/batch", "aria-live", 'role="alert"', 'aria-modal="true"']) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(source, /toWorkspaceStateBatchItems\(rows, selected\)/);
assert.match(source, /disabled=\{saving \|\| selected\.size === 0\}/);

console.log("Project cleanup dialog behavior: PASS");
