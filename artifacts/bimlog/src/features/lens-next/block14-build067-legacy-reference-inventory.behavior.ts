import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../..", import.meta.url));
const inventory = JSON.parse(readFileSync(`${root}/contracts/lens-product-reference-inventory.json`, "utf8"));
assert.equal(inventory.supportedRuntimeProduct, "Lens Next");
assert.equal(inventory.legacyRuntimePolicy, "migration-only");
assert.equal(inventory.customerSurfacePolicy.legacyNavigationAllowed, false);
assert.equal(inventory.customerSurfacePolicy.legacyBrandingAllowed, false);
assert.equal(inventory.customerSurfacePolicy.parallelProductAllowed, false);

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const productionRoots = ["artifacts/api-server/src/", "artifacts/bimlog/src/", "lib/db/src/", "plugins/", "contracts/", "scripts/"];
const legacyPattern = /original lens|legacy lens|bimlog\.bundle|lens-sync/i;
const references = tracked.filter((path) => productionRoots.some((prefix) => path.startsWith(prefix)))
  .filter((path) => !path.includes(".behavior.") && legacyPattern.test(readFileSync(`${root}/${path}`, "utf8")));
const classified = new Set([
  ...inventory.productionReferences.migrationCompatibility,
  ...inventory.productionReferences.governanceOnly,
]);
assert.deepEqual(references.filter((path) => !classified.has(path)), []);
assert.ok(references.includes("artifacts/api-server/src/routes/clash_reports.ts"));
assert.ok(references.includes("plugins/BIMLogLensNext/native/AutodeskReadOnlyAdapter.cs"));

const status = JSON.parse(readFileSync(`${root}/contracts/lens-product-status.json`, "utf8"));
assert.equal(status.supportedProduct, "Lens Next");
assert.equal(status.supportedProductCount, 1);
assert.equal(status.customerFacingLegacyProduct, false);
assert.equal(status.parallelInstallationSupported, false);
assert.equal(status.legacyLoaderAllowedInAcceptedSetup, false);

console.log(`block 14 build 067 legacy reference inventory: PASS references=${references.length}`);
