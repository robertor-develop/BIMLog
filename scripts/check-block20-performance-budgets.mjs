import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const assetRoot = path.resolve("artifacts/bimlog/dist/public/assets");
const manifestPath = path.resolve("artifacts/bimlog/dist/public/vite-manifest.json");
assert(fs.existsSync(assetRoot), "Browser production assets are missing; run the production build first.");
assert(fs.existsSync(manifestPath), "Browser production manifest is missing; run the production build first.");
const javascript = fs.readdirSync(assetRoot)
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, bytes: fs.statSync(path.join(assetRoot, name)).size }));
assert(javascript.length > 0, "Browser production build emitted no JavaScript assets.");
const largest = javascript.reduce((left, right) => left.bytes >= right.bytes ? left : right);
const totalBytes = javascript.reduce((sum, asset) => sum + asset.bytes, 0);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
assert(entryKey, "Browser production manifest has no entry point.");
const initialKeys = new Set();
const visitInitial = (key) => {
  if (initialKeys.has(key)) return;
  const chunk = manifest[key];
  assert(chunk, `Browser production manifest references missing chunk ${key}.`);
  initialKeys.add(key);
  for (const importedKey of chunk.imports ?? []) visitInitial(importedKey);
};
visitInitial(entryKey);
const initialJavascript = [...initialKeys]
  .map((key) => manifest[key].file)
  .filter((file) => file.endsWith(".js"))
  .map((file) => ({ file, bytes: fs.statSync(path.resolve("artifacts/bimlog/dist/public", file)).size }));
const initialBytes = initialJavascript.reduce((sum, asset) => sum + asset.bytes, 0);
const largestBudgetBytes = 750 * 1024;
const totalBudgetBytes = 4 * 1024 * 1024;
assert(largest.bytes <= largestBudgetBytes, `Largest browser asset ${largest.name} is ${largest.bytes} bytes; budget is ${largestBudgetBytes}.`);
assert(initialBytes <= totalBudgetBytes, `Initial browser JavaScript is ${initialBytes} bytes; budget is ${totalBudgetBytes}.`);
console.log(JSON.stringify({ status: "PASS", javascriptAssets: javascript.length, largest, initialAssets: initialJavascript.length, initialBytes, allLazyAndInitialBytes: totalBytes, largestBudgetBytes, totalBudgetBytes }));
