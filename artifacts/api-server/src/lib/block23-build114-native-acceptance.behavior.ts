import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const plugin = path.join(root, "plugins/BIMLogLensNext");
for (const year of [2021, 2025]) {
  const zip = path.join(plugin, `BIMLog-Lens-Next-Navisworks${year}-v1.05.N18-P36.zip`);
  const sidecar = `${zip}.sha256`;
  assert.ok(fs.existsSync(zip), `missing ${year} package`);
  assert.ok(/^[A-F0-9]{64}(?:\s|$)/i.test(fs.readFileSync(sidecar, "utf8").trim()), `invalid ${year} SHA-256 sidecar`);
}
const inventory = fs.readFileSync(path.join(root, "contracts/lens-product-reference-inventory.json"), "utf8");
assert.match(inventory, /migration/i);
assert.match(inventory, /Lens Next/);
console.log("block23 build114 dual-year package and sole-product contract: PASS");

