import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const relative = file => path.relative(root, file).replaceAll("\\", "/");

export function buildRouteInterconnectionGraph() {
  const app = read("artifacts/bimlog/src/App.tsx");
  const projectDetail = read("artifacts/bimlog/src/pages/ProjectDetail.tsx");
  const projectSidebar = read("artifacts/bimlog/src/components/layout/ProjectSidebar.tsx");
  const frontendFiles = walk(path.join(root, "artifacts/bimlog/src")).filter(file => /\.(?:ts|tsx)$/.test(file));
  const apiFiles = walk(path.join(root, "artifacts/api-server/src/routes")).filter(file => file.endsWith(".ts"));

  const frontendRoutes = [...app.matchAll(/<Route(?:\s+path="([^"]+)")?(?:\s+component=\{([^}]+)\})?/g)].map((match, index) => {
    const routePath = match[1] ?? "*";
    const tail = app.slice(match.index, match.index + 320);
    const guard = /<ProjectRoute\b/.test(tail) ? "project" : /<AccessRoute\b/.test(tail) ? "access" : /<ProtectedRoute\b/.test(tail) ? "authenticated" : "public";
    const target = match[2]?.trim() ?? tail.match(/component=\{([^}]+)\}/)?.[1]?.trim() ?? "inline";
    return { order: index + 1, path: routePath, guard, target };
  });

  const projectTabs = [...projectDetail.matchAll(/\{tab === "([^"]+)"\s*&&/g)]
    .map(match => {
      const component = projectDetail.slice(match.index, match.index + 360).match(/<([A-Z][A-Za-z0-9]+)/)?.[1] ?? "Unknown";
      return { tab: match[1], component, canonical: true };
    });
  const sidebarTabs = [...projectSidebar.matchAll(/\{ id: "([^"]+)", label: "project\.tabs\.[^"]+"/g)].map(match => match[1]);
  const sidebarLinks = [...projectSidebar.matchAll(/href:\s*`([^`]+)`/g)].map(match => match[1].replace("${projectId}", ":id"));

  const apiRoutes = [];
  for (const file of apiFiles) {
    const source = fs.readFileSync(file, "utf8");
    const tableImport = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']@workspace\/db\/schema["']/);
    const tables = tableImport ? tableImport[1].split(",").map(value => value.trim()).filter(value => /Table$/.test(value)) : [];
    const regex = /\brouter\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
    for (const match of source.matchAll(regex)) {
      apiRoutes.push({ method: match[1].toUpperCase(), path: match[2], owner: relative(file), tables });
    }
  }

  const apiReferences = [];
  for (const file of frontendFiles) {
    const source = fs.readFileSync(file, "utf8");
    const paths = new Set([...source.matchAll(/["'`]((?:\$\{[^}]+\})?\/api\/v1\/[^"'`\s?]*)/g)].map(match => match[1]));
    for (const apiPath of paths) apiReferences.push({ screen: relative(file), apiPath });
  }

  const routeKeys = new Map();
  for (const route of apiRoutes) {
    const key = `${route.method} ${route.path}`;
    routeKeys.set(key, [...(routeKeys.get(key) ?? []), route.owner]);
  }
  const duplicateApiRoutes = [...routeKeys].filter(([, owners]) => new Set(owners).size > 1).map(([key, owners]) => ({ key, owners }));
  const sidebarTabsWithoutScreen = sidebarTabs.filter(tab => !projectTabs.some(item => item.tab === tab));
  const screensWithoutSidebar = projectTabs.filter(item => item.canonical && !sidebarTabs.includes(item.tab)).map(item => item.tab);

  return {
    schemaVersion: 1,
    generatedFrom: "tracked source; deterministic",
    counts: {
      frontendRoutes: frontendRoutes.length,
      projectTabs: projectTabs.length,
      sidebarTabs: sidebarTabs.length,
      sidebarLinks: sidebarLinks.length,
      apiRoutes: apiRoutes.length,
      frontendApiReferences: apiReferences.length,
      routeOwnedTables: new Set(apiRoutes.flatMap(route => route.tables)).size,
    },
    compatibilityRedirects: [
      { from: "/setup-guide", to: "/help?topic=getting-started&view=manual" },
      { from: "/projects/:id/submittal-tracker", to: "/projects/:id/submittals?view=tracking" },
    ],
    frontendRoutes,
    projectTabs,
    sidebarTabs,
    sidebarLinks,
    apiRoutes,
    apiReferences,
    findings: { duplicateApiRoutes, sidebarTabsWithoutScreen, screensWithoutSidebar },
  };
}

const output = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : null;
if (output) {
  const graph = buildRouteInterconnectionGraph();
  const target = path.resolve(root, output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(graph, null, 2)}\n`);
  console.log(`ROUTE_INTERCONNECTION_GRAPH=WRITTEN path=${relative(target)} apiRoutes=${graph.counts.apiRoutes}`);
}
