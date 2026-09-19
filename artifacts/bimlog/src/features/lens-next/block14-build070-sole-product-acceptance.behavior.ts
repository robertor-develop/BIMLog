import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../..", import.meta.url));
const webRoot = `${root}/artifacts/bimlog/src`;
const sourceFiles: string[] = [];
function walk(directory: string) {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".behavior.")) sourceFiles.push(path);
  }
}
walk(webRoot);
const legacyCustomerReferences = sourceFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return /original lens|legacy lens/i.test(source) ? [path.slice(root.length + 1).replaceAll("\\", "/")] : [];
});
assert.deepEqual(legacyCustomerReferences, []);

const app = readFileSync(`${webRoot}/App.tsx`, "utf8");
const routeAccessibility = readFileSync(`${webRoot}/components/layout/RouteAccessibility.tsx`, "utf8");
const panel = readFileSync(`${webRoot}/features/lens-next/LensNextPanel.tsx`, "utf8");
const product = JSON.parse(readFileSync(`${root}/contracts/lens-product-status.json`, "utf8"));
assert.match(app, /path="\/lens-next"/);
assert.doesNotMatch(app, /path="\/(?:original-)?lens"/i);
assert.match(routeAccessibility, /"\/lens-next": "Lens Next"/);
assert.doesNotMatch(panel, /Original Lens|Legacy Lens/i);
assert.equal(product.supportedProduct, "Lens Next");
assert.equal(product.supportedProductCount, 1);
assert.equal(product.customerFacingLegacyProduct, false);

console.log(`block 14 build 070 Lens Next sole-product acceptance: PASS customerSources=${sourceFiles.length}`);
