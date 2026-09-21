import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRouteInterconnectionGraph } from "./route-interconnection-graph.mjs";
import { buildAccessibilityResponsiveMatrix, governedViewports } from "./accessibility-responsive-matrix.mjs";

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const recorded = JSON.parse(read("evidence/stabilization-program-20260919/ACCESSIBILITY_RESPONSIVE_MATRIX.json"));
const matrix = buildAccessibilityResponsiveMatrix();
const graph = buildRouteInterconnectionGraph();

assert.deepEqual(recorded, matrix, "the committed accessibility matrix must match tracked routes");
assert.deepEqual(governedViewports.map(item => `${item.width}x${item.height}`), ["1440x900", "820x1180", "390x844"]);
assert.equal(matrix.counts.viewportCases, matrix.counts.customerSurfaces * 3);
for (const route of graph.frontendRoutes.filter(route => route.path !== "*" && route.path !== "/projects/:id/:tab?")) {
  assert.ok(matrix.surfaces.some(surface => surface.path === route.path), `${route.path} is inventoried`);
}
for (const tab of graph.projectTabs) {
  assert.ok(matrix.surfaces.some(surface => surface.path === `/projects/:id/${tab.tab}`), `${tab.tab} project workspace is inventoried`);
}
for (const surface of matrix.surfaces) {
  assert.equal(surface.themes.length, 2, `${surface.path} has light/dark coverage`);
  assert.equal(surface.reducedMotion, true, `${surface.path} has reduced-motion coverage`);
  assert.equal(surface.checks.length, 8, `${surface.path} has the complete acceptance contract`);
}

console.log(`POST120_BUILD196=PASS surfaces=${matrix.counts.customerSurfaces} viewportCases=${matrix.counts.viewportCases}`);
