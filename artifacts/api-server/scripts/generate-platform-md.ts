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
    else if (entry.name.endsWith(ext)) out.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
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

  const catalog = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "living-brief/catalog.json"), "utf8")) as {
    documents: Array<{ file: string }>;
  };

  const content = `# PLATFORM.md

> AUTO-GENERATED at build time by artifacts/api-server/scripts/generate-platform-md.ts.
> Do not hand-edit — changes are overwritten on every api-server build. Edit the generator.

This is the structural map of the BIMLog monorepo, generated from the actual codebase.
It changes only when the code structure or curated architectural facts change.

## Living Brief authoritative catalog
${bullets(catalog.documents.map((document) => `living-brief/${document.file}`))}
- Document and catalog SHA-256 values use canonical UTF-8 text with LF line endings so Windows and Linux checkouts verify identically.

## Critical Database Facts — Read Before Every Session
- PROD_DATABASE_URL = Neon production database. This is what the running app uses for ALL reads and writes at runtime. This is the only real database.
- DATABASE_URL = Replit Helium development database. It is used ONLY by guarded drizzle-kit development-schema synchronization and never at runtime. Its structural state can influence Replit's generated production migration at Publish.
- The ENV startup banner historically showed DB_HOST: helium and DB_NAME: heliumdb — this was MISLEADING. It was reading PGHOST and PGDATABASE which point to heliumdb not the actual runtime connection. This has now been fixed.
- NEVER diagnose data loss by querying heliumdb. Always query Neon via PROD_DATABASE_URL.
- NEVER trust PGHOST or PGDATABASE for runtime database diagnostics.
- lens_viewpoints data that appeared to disappear on rebuild was never on Neon — it was on heliumdb which resets. All writes now go to Neon and survive all rebuilds.
- Any future database diagnostics must confirm PROD_DATABASE_URL is the connection target before drawing any conclusions.
- Replit currently documents that development structural changes may be applied to production at Publish. No supported repository configuration is proven to disable that managed migration authority. Every Publish remains human-gated; a root build cannot stop a migration Replit may apply before the build.
- Authoritative source is the explicitly fetched remote master ref, not the older remote default main. Before Helium sync or Publish, the clean Replit workspace, local master, origin/master, and freshly read remote master must match exactly and pass the commit-bound publication-source attestation.

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
- Direct schema force-push is disabled. The guarded development sync requires exact authoritative
  master attestation, a Replit Helium target distinct from the runtime production identity, and
  read-only table/index parity. Publish additionally requires the complete generated SQL, a
  hash-bound additive inventory, a verified restore point, and affected-table count manifests.
- Route ordering: literal sub-paths (e.g. .../lens-pull, .../plugin-pull) must be registered
  before parameterized catch-alls like .../:reportId (no NaN guard).
- Soft-delete DELETE routes live inside their feature route files (see routes/index.ts comments).
- Clash reports support a Navisworks plugin sync round-trip (fingerprint dedup; pull uses
  updatedAt > lastPluginSyncAt). Lens viewpoints use a manual refresh banner (polling removed).
- Living Brief: all documents in living-brief/catalog.json are served in authority order through
  /api/v1/living-brief/* from the verified deployed source bundle. living_brief_documents is an
  exact, metadata-bearing database mirror; it never overrides source doctrine. Controlled admin
  reconciliation requires observed mirror hashes. Only super admins change the password, grant
  access, or reconcile a mismatched mirror.
- Build: bimlog needs PORT set (PORT=3000 pnpm build); api-server bundles to dist/index.cjs via
  esbuild and this generator runs as a pre-build step.
`;

  const outDir = path.join(REPO_ROOT, "living-brief");
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, "PLATFORM.md");
  const prior = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null;
  if (prior === content) {
    console.log("[generate-platform-md] living-brief/PLATFORM.md unchanged");
    return;
  }
  fs.writeFileSync(outputPath, content, "utf-8");
  console.log("[generate-platform-md] wrote living-brief/PLATFORM.md (structural change)");
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedDirectly) generatePlatformMd();
