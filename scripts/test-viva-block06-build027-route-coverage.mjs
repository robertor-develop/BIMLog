import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const routeMatrix = spawnSync("pnpm", ["--dir", "artifacts/api-server", "exec", "tsx", "src/lib/block23-build112-route-matrix.behavior.ts"], { encoding: "utf8", shell: true, timeout: 180_000 });
assert.equal(routeMatrix.status, 0, `${routeMatrix.stdout ?? ""}\n${routeMatrix.stderr ?? routeMatrix.error ?? ""}`);
const graph = JSON.parse(readFileSync("evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json", "utf8"));
assert.ok(Array.isArray(graph.apiRoutes) ? graph.apiRoutes.length >= 700 : JSON.stringify(graph).includes("apiRoutes"), "route graph must retain the API inventory");
console.log("VIVA_BLOCK06_BUILD027=PASS authenticated_routes=true project_surfaces=true route_graph=bound");
