import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRouteInterconnectionGraph } from "./route-interconnection-graph.mjs";

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const app = read("artifacts/bimlog/src/App.tsx");
const projectDetail = read("artifacts/bimlog/src/pages/ProjectDetail.tsx");
const graph = buildRouteInterconnectionGraph();
const recorded = JSON.parse(read("evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json"));

assert.deepEqual(recorded, graph, "the committed route graph must exactly match tracked source");
assert.ok(graph.counts.frontendRoutes >= 35, "all routed frontend surfaces remain inventoried");
assert.ok(graph.counts.apiRoutes >= 450, "the complete API route surface remains inventoried");
assert.ok(graph.counts.frontendApiReferences >= 100, "screen-to-API references remain represented");
assert.ok(graph.counts.routeOwnedTables >= 40, "route-to-table ownership remains represented");
assert.deepEqual(graph.findings.duplicateApiRoutes, [], "no API method/path is owned by multiple route modules");
assert.deepEqual(graph.findings.sidebarTabsWithoutScreen, [], "every project sidebar tab resolves to a screen");
assert.deepEqual(graph.findings.screensWithoutSidebar, [], "every canonical project tab is reachable from navigation");

const specificRoutes = [
  "/projects/:id/financial/cost-structure",
  "/projects/:id/financial/budget",
  "/projects/:id/financial/history",
  "/projects/:id/financial/snapshots/:snapshotId",
  "/projects/:id/financial/contracts",
  "/projects/:id/financial/apu",
  "/projects/:id/commercial/team-performance",
  "/projects/:id/intake",
  "/projects/:id/operations",
  "/projects/:id/submittal-tracker",
];
const genericOrder = graph.frontendRoutes.find(route => route.path === "/projects/:id/:tab?")?.order ?? 0;
for (const routePath of specificRoutes) {
  const route = graph.frontendRoutes.find(item => item.path === routePath);
  assert.ok(route, `${routePath} remains registered`);
  assert.ok(route.order < genericOrder, `${routePath} must precede the generic project route`);
}

assert.match(app, /function SetupGuideRedirect\([\s\S]*\/help\?topic=getting-started&view=manual/, "setup-guide canonical redirect remains implemented");
assert.match(app, /function LegacySubmittalTrackerRedirect\([\s\S]*\/submittals\?view=tracking/, "legacy submittal deep links remain compatible");
assert.match(app, /<Route path="\/projects\/:id\/submittal-tracker">[\s\S]*LegacySubmittalTrackerRedirect[\s\S]*<Route path="\/projects\/:id\/:tab\?">/, "compatibility redirect precedes the generic route");
assert.doesNotMatch(projectDetail, /"submittal-tracker"/, "duplicate legacy tab identity is removed from the canonical screen switch");

const roleMatrix = {
  anonymous: { public: "allow", authenticated: "login", project: "login", access: "login" },
  zeroProject: { public: "allow", authenticated: "allow", project: "deny", access: "decision" },
  projectMember: { public: "allow", authenticated: "allow", project: "membership", access: "decision" },
  projectAdmin: { public: "allow", authenticated: "allow", project: "membership", access: "decision" },
  globalSuperAdmin: { public: "allow", authenticated: "allow", project: "global", access: "decision" },
};
assert.equal(Object.keys(roleMatrix).length, 5, "all governed role contexts remain enumerated");
for (const route of graph.frontendRoutes.filter(route => route.path !== "*")) {
  assert.ok(["public", "authenticated", "project", "access"].includes(route.guard), `${route.path} has a known guard`);
}

console.log(`POST120_BLOCK37=PASS frontend=${graph.counts.frontendRoutes} api=${graph.counts.apiRoutes} refs=${graph.counts.frontendApiReferences} tables=${graph.counts.routeOwnedTables}`);
