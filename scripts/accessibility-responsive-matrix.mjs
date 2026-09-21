import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildRouteInterconnectionGraph } from "./route-interconnection-graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const governedViewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "tablet", width: 820, height: 1180 },
  { id: "exact-390", width: 390, height: 844 },
];

const samplePath = routePath => routePath
  .replace(":snapshotId", "1")
  .replace(":id", "1")
  .replace(":tab?", "command-center");

export function buildAccessibilityResponsiveMatrix() {
  const graph = buildRouteInterconnectionGraph();
  const redirects = new Set(graph.compatibilityRedirects.map(item => item.from));
  const uniqueRoutes = [...new Map(graph.frontendRoutes
    .filter(route => route.path !== "*")
    .map(route => [route.path, route])).values()];
  const directRoutes = uniqueRoutes.filter(route => route.path !== "/projects/:id/:tab?");
  const projectRoutes = [
    { path: "/projects/:id", guard: "project", target: "ProjectDetail", projectTab: "overview" },
    ...graph.projectTabs.map(tab => ({
      path: `/projects/:id/${tab.tab}`,
      guard: "project",
      target: tab.component,
      projectTab: tab.tab,
    })),
  ];
  const surfaces = [...directRoutes, ...projectRoutes].map(route => ({
    ...route,
    samplePath: samplePath(route.path),
    routeKind: redirects.has(route.path) ? "compatibility-redirect" : "customer-surface",
    themes: ["light", "dark"],
    reducedMotion: true,
    checks: [
      "route-resolves-without-console-error",
      "document-title-and-main-focus",
      "keyboard-visible-focus",
      "dialog-focus-containment-and-restoration",
      "text-and-control-contrast",
      "no-horizontal-page-overflow",
      "touch-target-minimum",
      "layout-stability",
    ],
  }));
  return {
    schemaVersion: 1,
    generatedFrom: "tracked route graph; deterministic",
    counts: {
      routeTemplates: directRoutes.length,
      projectSurfaces: projectRoutes.length,
      customerSurfaces: surfaces.length,
      viewportCases: surfaces.length * governedViewports.length,
    },
    viewports: governedViewports,
    surfaces,
  };
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
const outputIndex = isDirectExecution ? process.argv.indexOf("--output") : -1;
if (outputIndex !== -1) {
  const target = path.resolve(root, process.argv[outputIndex + 1]);
  const matrix = buildAccessibilityResponsiveMatrix();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
  console.log(`ACCESSIBILITY_RESPONSIVE_MATRIX=WRITTEN surfaces=${matrix.counts.customerSurfaces} viewportCases=${matrix.counts.viewportCases}`);
}
