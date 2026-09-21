import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicRoot = path.join(root, "artifacts", "bimlog", "dist", "public");
const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, "vite-manifest.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(path.join(root, "evidence", "stabilization-program-20260919", "BUILD_201_BROWSER_PERFORMANCE_BASELINE.json"), "utf8"));
const bytesFor = file => fs.statSync(path.join(publicRoot, file)).size;
const entry = Object.values(manifest).find(record => record.isEntry);
assert(entry, "browser entry is absent from the Vite manifest");

const assets = fs.readdirSync(path.join(publicRoot, "assets"))
  .filter(name => name.endsWith(".js"))
  .map(name => ({ name, bytes: fs.statSync(path.join(publicRoot, "assets", name)).size }));
const boundedLazyAssets = assets.filter(asset => asset.name !== path.basename(entry.file) && !asset.name.startsWith("xlsx-"));
const routeChunks = Object.entries(manifest)
  .filter(([key, record]) => record.isDynamicEntry && (/^src\/pages\//.test(key) || key === "src/features/lens-next/LensNextWorkspace.tsx"))
  .map(([source, record]) => ({ source, bytes: bytesFor(record.file) }));
const feedbackPair = Object.entries(manifest).find(([key, record]) => key.startsWith("_FeedbackWidget-") && record.isDynamicEntry);
const editor = manifest["src/components/FeedbackMarkupEditor.tsx"];

const entryBytes = bytesFor(entry.file);
const maxEntryBytes = Math.floor(baseline.entry.fileBytes * 0.95);
assert(entryBytes <= maxEntryBytes, `initial entry is ${entryBytes} bytes; required <= ${maxEntryBytes} (5% below Build 201 baseline)`);
assert(Math.max(...boundedLazyAssets.map(asset => asset.bytes)) <= 250 * 1024, "a non-entry, non-spreadsheet browser chunk exceeds 250 KiB");
assert(assets.reduce((sum, asset) => sum + asset.bytes, 0) <= 4 * 1024 * 1024, "browser JavaScript total exceeds 4 MiB");
assert(Math.max(...routeChunks.map(route => route.bytes)) <= 225 * 1024, "a route-owned chunk exceeds 225 KiB");
assert(feedbackPair, "feedback workspace is not a dynamic chunk");
assert(bytesFor(feedbackPair[1].file) <= 50 * 1024, "feedback workspace chunk exceeds 50 KiB");
assert(editor?.isDynamicEntry, "feedback markup editor is not a dynamic entry");
assert(bytesFor(editor.file) <= 20 * 1024, "feedback markup editor chunk exceeds 20 KiB");
assert(entry.dynamicImports?.includes(feedbackPair[0]), "browser entry does not own the deferred feedback import");
assert(feedbackPair[1].dynamicImports?.includes("src/components/FeedbackMarkupEditor.tsx"), "feedback chunk does not own the deferred editor import");

console.log(JSON.stringify({
  status: "PASS",
  entryBytes,
  baselineEntryBytes: baseline.entry.fileBytes,
  reductionPercent: Number(((1 - entryBytes / baseline.entry.fileBytes) * 100).toFixed(2)),
  routeChunks: routeChunks.length,
  largestRouteBytes: Math.max(...routeChunks.map(route => route.bytes)),
  javascriptAssets: assets.length,
  totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  feedbackBytes: bytesFor(feedbackPair[1].file),
  editorBytes: bytesFor(editor.file),
}));
