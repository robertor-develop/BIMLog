import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const publicRoot = path.join(root, "artifacts", "bimlog", "dist", "public");
const manifestPath = path.join(publicRoot, "vite-manifest.json");
const outputPath = path.join(root, "evidence", "stabilization-program-20260919", "BUILD_201_BROWSER_PERFORMANCE_BASELINE.json");

assert(fs.existsSync(manifestPath), "Vite manifest is missing; run the production build first.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function bytesFor(file) {
  const fullPath = path.join(publicRoot, file);
  return fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
}

function importedBytes(record, seen = new Set()) {
  let bytes = bytesFor(record.file);
  for (const key of record.imports ?? []) {
    if (seen.has(key)) continue;
    seen.add(key);
    const imported = manifest[key];
    if (imported) bytes += importedBytes(imported, seen);
  }
  return bytes;
}

const routeRecords = Object.entries(manifest)
  .filter(([key, record]) => record.isDynamicEntry && (/^src\/pages\//.test(key) || key === "src/features/lens-next/LensNextWorkspace.tsx"))
  .map(([source, record]) => ({ source, fileBytes: bytesFor(record.file), loadedBytes: importedBytes(record, new Set([source])) }))
  .sort((left, right) => right.loadedBytes - left.loadedBytes || left.source.localeCompare(right.source));
const entryPair = Object.entries(manifest).find(([, record]) => record.isEntry);
assert(entryPair, "Vite manifest contains no browser entry.");
const [entrySource, entryRecord] = entryPair;
const javascript = fs.readdirSync(path.join(publicRoot, "assets"))
  .filter(name => name.endsWith(".js"))
  .map(name => fs.statSync(path.join(publicRoot, "assets", name)).size);

const baseline = {
  schemaVersion: 1,
  build: 201,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  entry: { source: entrySource, fileBytes: bytesFor(entryRecord.file), loadedBytes: importedBytes(entryRecord, new Set([entrySource])) },
  javascript: { assetCount: javascript.length, totalBytes: javascript.reduce((sum, bytes) => sum + bytes, 0), largestBytes: Math.max(...javascript) },
  routes: routeRecords,
};

if (process.argv.includes("--write")) {
  fs.writeFileSync(outputPath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`BUILD_201_BASELINE=WRITTEN routes=${routeRecords.length} entryBytes=${baseline.entry.fileBytes}`);
} else {
  console.log(JSON.stringify(baseline));
}
