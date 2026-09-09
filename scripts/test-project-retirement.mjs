import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapProjectDependencies } from "./map-project-dependencies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const graph = mapProjectDependencies();
assert.equal(graph.schemaTableCount, 205);
assert.equal(graph.completeProjectDependentTableCount, 148);
const service = read("artifacts/api-server/src/lib/project-retirement.ts");
for (const proof of ["return db.transaction", "PROJECT_RETIREMENT_CONFIRMATION_MISMATCH", "PROJECT_RETIREMENT_PREVIEW_STALE", "PROJECT_RETIREMENT_CONCURRENT_CHANGE", "tx.insert(adminActionsLogTable)"]) assert.ok(service.includes(proof), proof);
assert.doesNotMatch(service, /\.delete\(/);
const routes = read("artifacts/api-server/src/routes/projects.ts");
assert.match(routes, /retirement-preview/); assert.match(routes, /PROJECT_HARD_DELETE_DISABLED/);
assert.doesNotMatch(routes, /db\.delete\((?:projectsTable|projectMembersTable|filesTable)/);
for (const page of ["Dashboard.tsx", "AdminPanel.tsx", "TotalControl.tsx"]) assert.doesNotMatch(read(`artifacts/bimlog/src/pages/${page}`), /Delete project/);
console.log(JSON.stringify({ status: "PASS", schemaTables: graph.schemaTableCount, dependentTables: graph.completeProjectDependentTableCount }));
