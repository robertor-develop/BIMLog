import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const routesRoot = path.join(root, "artifacts/api-server/src/routes");
const output = path.join(root, "evidence/stabilization-program-20260919/ENDPOINT_AUTHORITY_MATRIX.json");
const write = process.argv.includes("--write");

const publicRules = [
  /^health\.ts\|GET\|\/(health|ready|version)$/,
  /^health\.ts\|GET\|\/healthz$/,
  /^auth\.ts\|(POST|GET)\|\/(auth\/login|auth\/register|auth\/forgot-password|auth\/reset-password|auth\/verify-reset-token)$/,
  /^contact\.ts\|POST\|\/contact$/,
  /^downloads\.ts\|GET\|\/downloads\//,
  /^autodesk\.ts\|GET\|\/autodesk\/(token|login|callback)$/,
  /^connections\.ts\|GET\|\/connections\/:provider\/callback$/,
  /^telegram-product\.ts\|POST\|\/webhooks\/telegram\/:adapterId$/,
];

const serviceScopedFiles = new Set([
  "ai-control-plane.ts",
  "contract-item-workflows.ts",
  "financial-apu.ts",
  "financial-budgets.ts",
  "financial-contracts.ts",
  "financial-controls.ts",
  "generic-apu-budget-controls.ts",
  "job-intake.ts",
  "job-operations.ts",
  "team-performance.ts",
  "feature-policies.ts",
]);

function routeCalls(sourceFile) {
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(sourceFile);
      const method = node.expression.name.text.toUpperCase();
      if (receiver === "router" && ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) calls.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return calls;
}

function pathText(node, sourceFile) {
  const first = node.arguments[0];
  if (!first) return "<missing>";
  if (ts.isStringLiteralLike(first) || ts.isNoSubstitutionTemplateLiteral(first)) return first.text;
  return `<dynamic:${first.getText(sourceFile)}>`;
}

const endpoints = [];
for (const file of fs.readdirSync(routesRoot).filter((name) => name.endsWith(".ts")).sort()) {
  const absolute = path.join(routesRoot, file);
  const source = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fileAuth = /router\.use\([\s\S]{0,240}authMiddleware/.test(source);
  const fileProjectGuard = /router\.use\(\s*["'`]\/projects\/:projectId[\s\S]{0,240}requireProjectMember\s*\(/.test(source);
  for (const call of routeCalls(sourceFile)) {
    const method = call.expression.name.text.toUpperCase();
    const routePath = pathText(call, sourceFile);
    const text = call.getText(sourceFile);
    const key = `${file}|${method}|${routePath}`;
    const isPublic = publicRules.some((rule) => rule.test(key));
    const directAuth = /\bauthMiddleware\b/.test(text);
    const authenticated = isPublic ? false : directAuth || fileAuth || serviceScopedFiles.has(file);
    const projectScoped = routePath.includes(":projectId");
    const directProjectGuard = /\brequire(ProjectMember|Permission)\s*\(/.test(text);
    const mountedProjectGuard = fileProjectGuard;
    const serviceScope = serviceScopedFiles.has(file) && projectScoped;
    const role = /isSuperAdminMiddleware|requireSuper\(/.test(text) ? "super_admin"
      : /require(ProjectMember|Permission)\([^)]*(project_admin|admin)/.test(text) ? "project_admin_or_super_admin"
      : authenticated ? "authenticated_user" : "public";
    const objectParams = [...routePath.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]).filter((name) => name !== "projectId");
    const projectAuthority = !projectScoped ? "not_applicable"
      : directProjectGuard ? "middleware"
      : mountedProjectGuard ? "mounted_middleware_and_service"
      : serviceScope ? "authenticated_service_boundary"
      : "missing";
    endpoints.push({ file, method, path: routePath, public: isPublic, authenticated, role, projectScoped, projectAuthority, objectParams, line: sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile)).line + 1 });
  }
}

const missingAuthentication = endpoints.filter((entry) => !entry.public && !entry.authenticated);
const missingProjectAuthority = endpoints.filter((entry) => entry.projectAuthority === "missing");
const dynamic = endpoints.filter((entry) => entry.path.startsWith("<dynamic:"));
const result = {
  schemaVersion: 1,
  generatedFrom: "artifacts/api-server/src/routes",
  endpointCount: endpoints.length,
  counts: {
    public: endpoints.filter((entry) => entry.public).length,
    authenticated: endpoints.filter((entry) => entry.authenticated).length,
    projectScoped: endpoints.filter((entry) => entry.projectScoped).length,
    objectScoped: endpoints.filter((entry) => entry.objectParams.length > 0).length,
    dynamic: dynamic.length,
  },
  missingAuthentication,
  missingProjectAuthority,
  endpoints,
};

if (write) fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
if (missingAuthentication.length || missingProjectAuthority.length) {
  console.error(JSON.stringify({ status: "FAIL", missingAuthentication, missingProjectAuthority }, null, 2));
  process.exit(1);
}
console.log(`POST120_BUILD206=PASS endpoints=${endpoints.length} public=${result.counts.public} authenticated=${result.counts.authenticated} project=${result.counts.projectScoped} object=${result.counts.objectScoped} dynamic=${result.counts.dynamic}`);
