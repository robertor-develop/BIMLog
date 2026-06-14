import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repo root = artifacts/api-server/scripts → up three levels
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(path.relative(REPO_ROOT, full));
  }
  return out.sort();
}

function bullets(files: string[]): string {
  return files.length ? files.map((f) => `- ${f}`).join("\n") : "- (none found)";
}

// Read all router.use(...) mounts from the routes index to show the real mount order.
function routeMounts(): string {
  const indexPath = path.join(REPO_ROOT, "artifacts/api-server/src/routes/index.ts");
  if (!fs.existsSync(indexPath)) return "- (routes/index.ts not found)";
  const src = fs.readFileSync(indexPath, "utf-8");
  const mounts = [...src.matchAll(/router\.use\((\w+)\)/g)].map((m) => m[1]);
  return mounts.length ? mounts.map((m) => `- ${m}`).join("\n") : "- (no mounts found)";
}

// Pull the wouter <Route path="..."> entries from App.tsx.
function appRoutes(): string {
  const appPath = path.join(REPO_ROOT, "artifacts/bimlog/src/App.tsx");
  if (!fs.existsSync(appPath)) return "- (App.tsx not found)";
  const src = fs.readFileSync(appPath, "utf-8");
  const paths = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  return paths.length ? paths.map((p) => `- ${p}`).join("\n") : "- (no routes found)";
}

export function generatePlatformMd(): void {
  const routeFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/routes"), ".ts");
  const pageFiles = listFiles(path.join(REPO_ROOT, "artifacts/bimlog/src/pages"), ".tsx");
  const schemaFiles = listFiles(path.join(REPO_ROOT, "lib/db/src/schema"), ".ts");
  const agentFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/agents"), ".ts");
  const libFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/lib"), ".ts");
  const middlewareFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/middlewares"), ".ts");

  const generatedAt = new Date().toISOString();

  const content = `# PLATFORM.md

> AUTO-GENERATED at build time by artifacts/api-server/scripts/generate-platform-md.ts.
> Do not hand-edit — changes are overwritten on every api-server build. Edit the generator.
> Last generated: ${generatedAt}

This is the structural map of the BIMLog monorepo, generated from the actual codebase.

## Monorepo shape
- pnpm workspaces.
- artifacts/bimlog — React + Vite + wouter web app (the BIMLog UI).
- artifacts/api-server — Express API. Every route is mounted under the global prefix /api/v1.
- artifacts/mockup-sandbox — component preview server (design).
- lib/db — shared drizzle schema + pg pool.

## Backend route files (artifacts/api-server/src/routes)
${bullets(routeFiles)}

## Backend route mount order (routes/index.ts, under /api/v1)
${routeMounts()}

## Backend middlewares (artifacts/api-server/src/middlewares)
${bullets(middlewareFiles)}

## Backend libs (artifacts/api-server/src/lib)
${bullets(libFiles)}

## Agents (artifacts/api-server/src/agents)
${bullets(agentFiles)}

## Database schema files (lib/db/src/schema)
${bullets(schemaFiles)}

## Frontend pages (artifacts/bimlog/src/pages)
${bullets(pageFiles)}

## Frontend routes (artifacts/bimlog/src/App.tsx, wouter)
${appRoutes()}

## Curated interconnections and gotchas (maintained in the generator)
- All API routes are served under the /api/v1 prefix. res.redirect in route files MUST
  include /api/v1 or it 404s.
- Auth: JWT Bearer; payload carries isSuperAdmin. authMiddleware verifies; requireProjectMember
  / requirePermission gate project access (super admins bypass membership);
  isSuperAdminMiddleware re-checks users.is_super_admin.
- Schema changes go in BOTH the drizzle schema file AND the idempotent startup migration block
  in artifacts/api-server/src/app.ts (ALTER TABLE / CREATE TABLE ... IF NOT EXISTS).
- Route ordering: literal sub-paths (e.g. .../lens-pull, .../plugin-pull) must be registered
  before parameterized catch-alls like .../:reportId (no NaN guard).
- Soft-delete DELETE routes live inside their feature route files (see routes/index.ts comments).
- Clash reports support a Navisworks plugin sync round-trip (fingerprint dedup; pull uses
  updatedAt > lastPluginSyncAt). Lens viewpoints use a manual refresh banner (polling removed).
- Living Brief: four docs in /living-brief served via /api/v1/living-brief/*, gated by a hashed
  password (default BIMAI360) plus eligibility (users.is_super_admin OR users.can_access_living_brief).
  Only super admins change the password or grant access. This PLATFORM.md is regenerated on build.
- Build: bimlog needs PORT set (PORT=3000 pnpm build); api-server bundles to dist/index.cjs via
  esbuild and this generator runs as a pre-build step.
`;

  const outDir = path.join(REPO_ROOT, "living-brief");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "PLATFORM.md"), content, "utf-8");
  console.log(`[generate-platform-md] wrote living-brief/PLATFORM.md (${generatedAt})`);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedDirectly) generatePlatformMd();
