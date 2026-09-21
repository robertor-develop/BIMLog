import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRouteInterconnectionGraph } from "./route-interconnection-graph.mjs";
import { buildAccessibilityResponsiveMatrix, governedViewports } from "./accessibility-responsive-matrix.mjs";

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const recorded = JSON.parse(read("evidence/stabilization-program-20260919/ACCESSIBILITY_RESPONSIVE_MATRIX.json"));
const matrix = buildAccessibilityResponsiveMatrix();
const graph = buildRouteInterconnectionGraph();
const routeAccessibility = read("artifacts/bimlog/src/components/layout/RouteAccessibility.tsx");
const globalCss = read("artifacts/bimlog/src/index.css");
const coordinatorCommandCenter = read("artifacts/bimlog/src/pages/project/CoordinatorCommandCenter.tsx");

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

assert.match(routeAccessibility, /MutationObserver\(refreshDialog\)/, "modal additions are observed");
assert.match(routeAccessibility, /event\.key !== "Tab"/, "modal keyboard focus is contained");
assert.match(routeAccessibility, /target\?\.isConnected/, "focus is restored after a modal closes");
assert.match(routeAccessibility, /focusableElements\(activeDialog\)/, "dialogs receive deterministic initial focus");
assert.match(globalCss, /:root\s*\{[\s\S]*color-scheme: light;/, "light controls use the light system palette");
assert.match(globalCss, /\.dark\s*\{[\s\S]*color-scheme: dark;/, "dark controls use the dark system palette");
assert.match(globalCss, /@media \(forced-colors: active\)[\s\S]*outline: 3px solid Highlight;/, "forced colors preserve visible focus");
assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)/, "reduced motion remains governed");
assert.match(globalCss, /--accent: 24 95% 40%;/, "accent foreground contrast is at least 4.5:1");
assert.match(globalCss, /--destructive: 0 72% 45%;/, "destructive foreground contrast exceeds 4.5:1");
assert.doesNotMatch(coordinatorCommandCenter, /★/, "saved-view meaning is not conveyed by a symbol alone");
assert.match(coordinatorCommandCenter, /tr\("Default", "Predeterminada"\)/, "default saved views have localized text");
assert.match(globalCss, /body, #root \{ width: 100%; max-width: 100%; min-width: 0; \}/, "document containers cannot force page overflow");
assert.match(globalCss, /overflow-x: hidden;/, "page-level horizontal overflow is contained");
assert.match(globalCss, /:where\(img, video\) \{ max-width: 100%; height: auto; \}/, "media remains inside its content width");
assert.match(globalCss, /@media \(pointer: coarse\)[\s\S]*min-height: 44px;/, "coarse-pointer controls meet the touch-height contract");
assert.match(globalCss, /touch-action: manipulation;/, "coarse-pointer buttons use stable touch behavior");

console.log(`POST120_BLOCK40=PASS surfaces=${matrix.counts.customerSurfaces} viewportCases=${matrix.counts.viewportCases} dialogFocus=PASS contrastThemeMotion=PASS responsiveTouch=PASS`);
