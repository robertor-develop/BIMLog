import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const policy = JSON.parse(fs.readFileSync(path.join(scriptDir, "platform-audit-policy.json"), "utf8"));
const baselinePath = path.join(scriptDir, "platform-audit-baseline.json");
const scanRoots = [
  "artifacts/api-server/src",
  "artifacts/bimlog/src",
  "artifacts/sync-agent",
  "lib/api-client-react/src",
  "lib/db/src",
  "scripts/src",
  "replit.md",
  "package.json",
];

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
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function add(severity, category, file, line, detail) {
  findings.push({ severity, category, file: rel(file), line, detail });
}

for (const file of files) {
  const fileRel = rel(file);
  const isApi = fileRel.startsWith("artifacts/api-server/src/");
  const isFrontend = fileRel.startsWith("artifacts/bimlog/src/") || fileRel.startsWith("lib/api-client-react/src/");
  const isAiUsage = fileRel === "artifacts/api-server/src/lib/ai-usage.ts";
  const isSharedPdf = fileRel === "artifacts/api-server/src/lib/pdf-kit.ts";

  readLines(file).forEach((line, index) => {
    const lineNo = index + 1;
    if (line.includes("bim-log-ignite.replit.app")) {
      add("P0", "old-replit-url", file, lineNo, "Old Replit production URL is still referenced.");
    }
    if (emojiPattern.test(line)) {
      add("P1", "emoji-source", file, lineNo, "Owner rule violation: emoji found in source code or user-visible text.");
    }
    if (isApi && !isAiUsage && /new\s+Anthropic\s*\(/.test(line)) {
      add("P0", "ai-billing-bypass", file, lineNo, "Direct Anthropic client bypasses getAnthropicClientForUser and AI usage tracking.");
    }
    if (isApi && /AI_INTEGRATIONS_ANTHROPIC_API_KEY\s*\|\|\s*["']dummy["']/.test(line)) {
      add("P0", "dummy-ai-key", file, lineNo, "Dummy AI key masks configuration failure instead of failing loudly.");
    }
    if ((isApi || isFrontend) && /catch\s*(?:\([^)]*\)\s*)?\{\s*(?:return\s+(?:null|undefined);)?\s*\}|\.catch\(\(\)\s*=>\s*(?:\{\s*\}|(?:null|undefined))\)/.test(line)) {
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

const orphanSubmittalTrackerPath = path.join(root, "artifacts/bimlog/src/pages/project/SubmittalTrackerTab.tsx");
if (fs.existsSync(orphanSubmittalTrackerPath)) {
  findings.push({
    severity: "INFO",
    category: "module-surface",
    file: rel(orphanSubmittalTrackerPath),
    detail: "Legacy standalone submittal tracker component exists. Keep submittal list, register, and tracking views unified in SubmittalsTab.",
  });
}

const order = { P0: 0, P1: 1, P2: 2, INFO: 3 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category) || a.file.localeCompare(b.file));

const occurrenceBySeed = new Map();
for (const finding of findings) {
  const seed = [finding.severity, finding.category, finding.file, finding.detail].join("\n");
  const occurrence = (occurrenceBySeed.get(seed) ?? 0) + 1;
  occurrenceBySeed.set(seed, occurrence);
  finding.findingId = `AUD-${crypto.createHash("sha256").update(`${seed}\n${occurrence}`).digest("hex").slice(0, 12).toUpperCase()}`;
  finding.rootCauseKey = `${finding.category}:${finding.file.split(":")[0]}`;
  finding.sourceKind = /(?:\.behavior\.|\.test\.|\.spec\.)/.test(finding.file) ? "test" : "production";
  Object.assign(finding, policy.categories[finding.category] ?? {});
}

const rootCauseGroups = Object.values(findings.reduce((groups, finding) => {
  const group = groups[finding.rootCauseKey] ?? {
    rootCauseKey: finding.rootCauseKey,
    severity: finding.severity,
    category: finding.category,
    file: finding.file.split(":")[0],
    owner: finding.owner,
    targetBuild: finding.targetBuild,
    findingIds: [],
  };
  group.findingIds.push(finding.findingId);
  group.occurrences = group.findingIds.length;
  groups[finding.rootCauseKey] = group;
  return groups;
}, {})).sort((a, b) => a.rootCauseKey.localeCompare(b.rootCauseKey));

const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;
function reconcileP1Baseline(currentFindings, acceptedBaseline) {
  const baselineIds = new Set(acceptedBaseline?.findings?.map((finding) => finding.findingId) ?? []);
  const currentP1Ids = new Set(currentFindings.filter((finding) => finding.severity === "P1").map((finding) => finding.findingId));
  return {
    unexpected: currentFindings.filter((finding) => finding.severity === "P1" && acceptedBaseline && !baselineIds.has(finding.findingId)),
    resolved: acceptedBaseline?.findings?.filter((finding) => finding.severity === "P1" && !currentP1Ids.has(finding.findingId)) ?? [],
  };
}
const baselineReconciliation = reconcileP1Baseline(findings, baseline);
const unexpectedP1 = baselineReconciliation.unexpected;
const resolvedP1 = baselineReconciliation.resolved;

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
const categoryCounts = findings.reduce((acc, finding) => {
  acc[finding.category] = (acc[finding.category] ?? 0) + 1;
  return acc;
}, {});
const unowned = [...new Set(findings.map(finding => finding.category))].filter(category => !policy.categories[category]);
if (unowned.length) throw new Error(`Audit categories lack owners: ${unowned.join(", ")}`);
const receipt = {
  schemaVersion: 1,
  status: (counts.P0 ?? 0) === 0 && unexpectedP1.length === 0 ? "PASS" : "FAIL",
  scannedFiles: files.length,
  routesFound: routeRegistrations.length,
  counts: { P0: counts.P0 ?? 0, P1: counts.P1 ?? 0, P2: counts.P2 ?? 0, INFO: counts.INFO ?? 0 },
  categories: Object.fromEntries(Object.entries(categoryCounts).sort().map(([category, count]) => [category, { count, ...policy.categories[category] }])),
  baseline: {
    present: !!baseline,
    expectedP1: baseline?.findings?.filter((finding) => finding.severity === "P1").length ?? 0,
    unexpectedP1: unexpectedP1.map((finding) => finding.findingId),
    resolvedP1: resolvedP1.map((finding) => finding.findingId),
  },
  rootCauseGroups,
  findings,
};
if (process.argv.includes("--write-baseline")) {
  const baselineReceipt = {
    schemaVersion: 1,
    purpose: "Exact accepted P1 inventory. New P1 identities fail the blocking audit until explicitly classified.",
    counts: receipt.counts,
    rootCauseGroups,
    findings: findings.filter((finding) => finding.severity === "P1"),
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(baselineReceipt, null, 2)}\n`);
  console.log(`Audit baseline written: ${path.relative(root, baselinePath).replaceAll("\\", "/")}`);
}
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (!output) throw new Error("--output requires a path.");
  fs.writeFileSync(path.resolve(output), `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(`Root-cause groups: ${rootCauseGroups.length}; unexpected P1 identities: ${unexpectedP1.length}; resolved baseline identities: ${resolvedP1.length}.`);
console.log(`Blocking policy: P0=${receipt.counts.P0 === 0 ? "PASS" : "FAIL"}; P1_BASELINE=${unexpectedP1.length === 0 ? "PASS" : "FAIL"}.`);
if (process.argv.includes("--self-test")) {
  const sampleSeed = ["P1", "silent-catch", "sample.ts", "sample"].join("\n");
  const first = crypto.createHash("sha256").update(`${sampleSeed}\n1`).digest("hex");
  const again = crypto.createHash("sha256").update(`${sampleSeed}\n1`).digest("hex");
  const synthetic = reconcileP1Baseline(
    [{ severity: "P1", findingId: "kept" }, { severity: "P1", findingId: "new" }],
    { findings: [{ severity: "P1", findingId: "kept" }, { severity: "P1", findingId: "resolved" }] },
  );
  if (first !== again || !rootCauseGroups.every((group) => group.findingIds.length === group.occurrences)) throw new Error("Audit identity self-test failed");
  if (synthetic.unexpected.map((finding) => finding.findingId).join() !== "new") throw new Error("Unexpected-P1 self-test failed");
  if (synthetic.resolved.map((finding) => finding.findingId).join() !== "resolved") throw new Error("Resolved-P1 self-test failed");
  console.log("PLATFORM_AUDIT_IDENTITY_SELF_TEST=PASS");
}
if (process.argv.includes("--enforce") && (receipt.counts.P0 > 0 || unexpectedP1.length > 0)) process.exitCode = 1;
