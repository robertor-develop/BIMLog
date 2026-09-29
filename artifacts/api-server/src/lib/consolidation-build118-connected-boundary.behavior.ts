import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "meeting-pack-preparation.behavior.ts",
  "drawing-correct-revision-journey.behavior.ts",
  "daily-field-record.behavior.ts",
  "field-reinspection.behavior.ts",
  "customer-review-request.behavior.ts",
  "sharepoint-publication-recovery.behavior.ts",
  "block23-build114-native-acceptance.behavior.ts",
];
for (const file of required) {
  assert.ok(fs.existsSync(path.join(root, "artifacts/api-server/src/lib", file)), `missing ${file}`);
}
const native = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/block23-build114-native-acceptance.behavior.ts"), "utf8");
assert.match(native, /2021/);
assert.match(native, /2025/);
const inventory = fs.readFileSync(path.join(root, "contracts/lens-product-reference-inventory.json"), "utf8");
assert.match(inventory, /Lens Next/);
const installer = fs.readFileSync(path.join(root, "plugins/BIMLogLensNext/Install-BIMLogLensNext.ps1"), "utf8");
assert.match(installer, /Pulse/);

console.log("consolidation C118 connected document/provider/Lens boundary: PASS");
