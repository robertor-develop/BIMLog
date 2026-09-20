import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const assetRoot = path.resolve("artifacts/bimlog/dist/public/assets");
assert(fs.existsSync(assetRoot), "Browser production assets are missing; run the production build first.");
const javascript = fs.readdirSync(assetRoot)
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, bytes: fs.statSync(path.join(assetRoot, name)).size }));
assert(javascript.length > 0, "Browser production build emitted no JavaScript assets.");
const largest = javascript.reduce((left, right) => left.bytes >= right.bytes ? left : right);
const totalBytes = javascript.reduce((sum, asset) => sum + asset.bytes, 0);
const largestBudgetBytes = 750 * 1024;
const totalBudgetBytes = 4 * 1024 * 1024;
assert(largest.bytes <= largestBudgetBytes, `Largest browser asset ${largest.name} is ${largest.bytes} bytes; budget is ${largestBudgetBytes}.`);
assert(totalBytes <= totalBudgetBytes, `Browser JavaScript total is ${totalBytes} bytes; budget is ${totalBudgetBytes}.`);
console.log(JSON.stringify({ status: "PASS", javascriptAssets: javascript.length, largest, totalBytes, largestBudgetBytes, totalBudgetBytes }));
