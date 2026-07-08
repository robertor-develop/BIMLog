import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const roots = [
  "artifacts",
  "lib",
  "scripts",
  "living-brief",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
].map((entry) => path.join(repoRoot, entry));

const ignoredDirs = new Set([
  ".git",
  ".cache",
  ".turbo",
  "attached_assets",
  "coverage",
  "dist",
  "node_modules",
  "uploads",
]);

const ignoredExts = new Set([
  ".7z",
  ".bin",
  ".bmp",
  ".dll",
  ".doc",
  ".docx",
  ".exe",
  ".gif",
  ".ico",
  ".icns",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".lock",
  ".pdf",
  ".pdb",
  ".png",
  ".rar",
  ".tar",
  ".tgz",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip",
]);

const suspicious = [
  { label: "U+00C3 mojibake marker", pattern: /\u00c3/g },
  { label: "U+00C2 mojibake marker", pattern: /\u00c2/g },
  { label: "U+FFFD replacement character", pattern: /\ufffd/g },
  { label: "UTF-8 mojibake prefix U+00E2", pattern: /\u00e2/g },
  { label: "common emoji mojibake prefix", pattern: /\u00f0\u0178/g },
];

const hits = [];

function shouldSkip(filePath) {
  const parts = filePath.split(path.sep);
  if (parts.some((part) => ignoredDirs.has(part))) return true;

  const ext = path.extname(filePath).toLowerCase();
  if (ignoredExts.has(ext)) return true;
  if (filePath.endsWith(".tar.gz")) return true;

  return false;
}

function walk(entry) {
  if (!fs.existsSync(entry) || shouldSkip(entry)) return;

  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entry)) {
      walk(path.join(entry, child));
    }
    return;
  }

  const buffer = fs.readFileSync(entry);
  if (buffer.includes(0)) return;

  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const { label, pattern } of suspicious) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        hits.push({
          file: path.relative(repoRoot, entry),
          line: lineIndex + 1,
          column: match.index + 1,
          label,
          text: line.trim(),
        });
      }
    }
  }
}

for (const root of roots) {
  walk(root);
}

if (hits.length > 0) {
  console.error("Mojibake scan failed. Fix these before publishing:");
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.line}:${hit.column} ${hit.label}`);
    console.error(`  ${hit.text}`);
  }
  process.exit(1);
}

console.log("Mojibake scan passed.");
