import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const scanRoots = ["artifacts/api-server/src", "artifacts/bimlog/src", "lib/db/src", "replit.md", "package.json"];

function walk(target) {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  const out = [];
  for (const entry of fs.readdirSync(absolute)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    out.push(...walk(path.join(target, entry)));
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function readLines(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/);
}

const files = scanRoots.flatMap(walk).filter(file => /\.(ts|tsx|js|json|md)$/.test(file));
const findings = [];

function add(severity, category, file, line, detail) {
  findings.push({ severity, category, file: rel(file), line, detail });
}

for (const file of files) {
  const fileRel = rel(file);
  const isApi = fileRel.startsWith("artifacts/api-server/src/");
  const isFrontend = fileRel.startsWith("artifacts/bimlog/src/");
  const isAiUsage = fileRel === "artifacts/api-server/src/lib/ai-usage.ts";
  const isSharedPdf = fileRel === "artifacts/api-server/src/lib/pdf-kit.ts";

  readLines(file).forEach((line, index) => {
    const lineNo = index + 1;
    if (line.includes("bim-log-ignite.replit.app")) {
      add("P0", "old-replit-url", file, lineNo, "Old Replit production URL is still referenced.");
    }
    if (isApi && !isAiUsage && /new\s+Anthropic\s*\(/.test(line)) {
      add("P0", "ai-billing-bypass", file, lineNo, "Direct Anthropic client bypasses getAnthropicClientForUser and AI usage tracking.");
    }
    if (isApi && /AI_INTEGRATIONS_ANTHROPIC_API_KEY\s*\|\|\s*["']dummy["']/.test(line)) {
      add("P0", "dummy-ai-key", file, lineNo, "Dummy AI key masks configuration failure instead of failing loudly.");
    }
    if ((isApi || isFrontend) && /catch\s*\{\s*\}|catch\s*\(_\)\s*\{\s*\}|\.catch\(\(\)\s*=>\s*\{\s*\}\)/.test(line)) {
      add("P1", "silent-catch", file, lineNo, "Silent catch can hide broken user workflows.");
    }
    if (isApi && !isSharedPdf && /new\s+PDFDocument\s*\(|from\s+["']pdfkit["']|require\(["']pdfkit["']\)/.test(line)) {
      add("P1", "bespoke-pdf", file, lineNo, "PDF code appears outside shared pdf-kit helpers.");
    }
    if (isFrontend && /XLSX\.writeFile|json_to_sheet|aoa_to_sheet/.test(line)) {
      add("P2", "client-excel-export", file, lineNo, "Excel export is built client-side; verify it matches platform export standards.");
    }
  });
}

const routeRegistrations = [];
for (const file of files.filter(f => rel(f).startsWith("artifacts/api-server/src/routes/"))) {
  readLines(file).forEach((line, index) => {
    const match = line.match(/router\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]/);
    if (match) routeRegistrations.push({ method: match[1].toUpperCase(), path: match[2], key: `${match[1].toUpperCase()} ${match[2]}`, file: rel(file), line: index + 1 });
  });
}

const routesByKey = new Map();
for (const route of routeRegistrations) {
  const list = routesByKey.get(route.key) ?? [];
  list.push({ file: route.file, line: route.line });
  routesByKey.set(route.key, list);
}
for (const [key, locations] of routesByKey) {
  if (locations.length > 1) {
    findings.push({
      severity: "P1",
      category: "duplicate-route",
      file: locations.map(l => `${l.file}:${l.line}`).join(", "),
      detail: `Duplicate route registration: ${key}`,
    });
  }
}

function routeCanShadow(earlierPath, laterPath) {
  const earlierSegments = earlierPath.split("/").filter(Boolean);
  const laterSegments = laterPath.split("/").filter(Boolean);
  if (earlierSegments.length !== laterSegments.length) return false;

  let shadowingParam = false;
  for (let i = 0; i < earlierSegments.length; i += 1) {
    const earlier = earlierSegments[i];
    const later = laterSegments[i];
    if (earlier === later) continue;
    if (earlier.startsWith(":")) {
      if (!later.startsWith(":")) shadowingParam = true;
      continue;
    }
    return false;
  }
  return shadowingParam;
}

for (let i = 0; i < routeRegistrations.length; i += 1) {
  const earlier = routeRegistrations[i];
  for (let j = i + 1; j < routeRegistrations.length; j += 1) {
    const later = routeRegistrations[j];
    if (earlier.file !== later.file || earlier.method !== later.method) continue;
    if (!routeCanShadow(earlier.path, later.path)) continue;

    const sourcePath = path.join(root, earlier.file);
    const sourceWindow = readLines(sourcePath).slice(earlier.line - 1, earlier.line + 12).join("\n");
    const hasPassThroughGuard = /next\s*\(/.test(sourceWindow) && /\\d/.test(sourceWindow);
    if (!hasPassThroughGuard) {
      findings.push({
        severity: "P1",
        category: "route-order",
        file: `${earlier.file}:${earlier.line}`,
        detail: `${earlier.method} ${earlier.path} can shadow later literal route ${later.path} at ${later.file}:${later.line}. Move the literal route earlier or add an explicit numeric pass-through guard.`,
      });
    }
  }
}

const authMiddlewarePath = path.join(root, "artifacts/api-server/src/middlewares/auth.ts");
if (fs.existsSync(authMiddlewarePath)) {
  const authSource = fs.readFileSync(authMiddlewarePath, "utf8");
  const requirePermissionStart = authSource.indexOf("export function requirePermission");
  const requirePermissionBlock = requirePermissionStart >= 0 ? authSource.slice(requirePermissionStart) : "";
  if (!/userCheck\?\.isSuperAdmin/.test(requirePermissionBlock)) {
    findings.push({
      severity: "P0",
      category: "super-admin-permission-bypass",
      file: rel(authMiddlewarePath),
      detail: "requirePermission must let data-driven super admins bypass project membership checks, matching requireProjectMember.",
    });
  }
}

const submittalFiles = files.map(rel).filter(file =>
  file.includes("Submittal") || file.includes("submittal") || file.endsWith("/submittals.ts"),
);
findings.push({
  severity: "INFO",
  category: "module-surface",
  file: "submittals",
  detail: `Submittal-related source files found: ${submittalFiles.length}. Key UX split risk: SubmittalsTab, SubmittalTrackerTab, submittals.ts, submittal_reports.ts.`,
});

const order = { P0: 0, P1: 1, P2: 2, INFO: 3 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category) || a.file.localeCompare(b.file));

const counts = findings.reduce((acc, finding) => {
  acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
  return acc;
}, {});

console.log("BIMLog Platform Audit");
console.log("=====================");
console.log(`Scanned files: ${files.length}`);
console.log(`Routes found: ${routeRegistrations.length}`);
console.log(`Findings: P0=${counts.P0 ?? 0} P1=${counts.P1 ?? 0} P2=${counts.P2 ?? 0} INFO=${counts.INFO ?? 0}`);
console.log("");

const maxPerCategory = 25;
const seenByCategory = new Map();
for (const finding of findings) {
  const seen = seenByCategory.get(finding.category) ?? 0;
  if (seen >= maxPerCategory) continue;
  seenByCategory.set(finding.category, seen + 1);
  const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  console.log(`[${finding.severity}] ${finding.category} ${loc}`);
  console.log(`  ${finding.detail}`);
}

console.log("");
console.log("Audit is intentionally non-blocking today. Use these findings to drive stabilization batches, then make selected categories fail CI once cleaned.");
