import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./projects.ts", import.meta.url), "utf8");
const postCall = "router." + "post(";
const route = `${postCall}"/projects/workspace-state/batch", authMiddleware`;
assert.match(source, /setProjectWorkspaceStateBatch/);
assert.ok(source.includes(route));
assert.ok(source.indexOf(route) < source.indexOf(`${postCall}"/projects/:projectId/workspace-state"`), "static batch route must be registered before the parameter route");
assert.match(source, /res\.status\(error\.status\)\.json\(\{ error: error\.message, code: error\.code \}\)/);
assert.doesNotMatch(source.slice(source.indexOf(route), source.indexOf(`${postCall}"/projects",`, source.indexOf(route))), /requireProjectMember/);

console.log("Project workspace batch route behavior: PASS");
