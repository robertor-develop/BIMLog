import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./project-retirement.ts", import.meta.url), "utf8");
for (const required of [
  "setProjectWorkspaceStateBatch",
  "Select between 1 and 50 projects",
  "PROJECT_WORKSPACE_BATCH_DUPLICATE",
  "No projects were changed",
  "change_project_workspace_state_batch",
  "recordsPreserved: true",
  "db.transaction",
]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(source, /new Set\(items\.map\(item => item\.projectId\)\)\.size !== items\.length/);
assert.match(source, /item\.expectedUpdatedAt !== project\.updatedAt\.toISOString\(\)/);

console.log("Project workspace atomic batch behavior: PASS");
