import assert from "node:assert/strict";
import fs from "node:fs";

const inventory = JSON.parse(fs.readFileSync(
  new URL("../evidence/stabilization-program-20260919/BLOCK_28_PDF_RENDERER_INVENTORY.json", import.meta.url),
  "utf8",
));

assert.equal(inventory.schemaVersion, 1);
assert.equal(inventory.build, 136);
assert.ok(inventory.counts.files >= 20, "expected complete production PDF source inventory");
assert.ok(inventory.counts.rendererSites >= 40, "expected every renderer site to be recorded");
assert.ok(inventory.counts.pdfResponseSites >= 50, "expected every PDF response/content contract to be recorded");
assert.equal(inventory.counts.directConstructorFiles, 1, "only the feedback package bypasses the shared document factory");
assert.ok(inventory.counts.bespokeDeliveryFiles >= 20, "migration scope must remain visible");

const paths = inventory.files.map((entry) => entry.path);
assert.equal(new Set(paths).size, paths.length, "inventory paths must be unique");
for (const required of [
  "artifacts/api-server/src/lib/feedback-package.ts",
  "artifacts/api-server/src/routes/reports.ts",
  "artifacts/api-server/src/routes/rfis.ts",
  "artifacts/api-server/src/routes/submittals.ts",
  "artifacts/api-server/src/routes/transmittals.ts",
]) assert.ok(paths.includes(required), `missing ${required}`);

console.log(`POST120_BUILD136=PASS files=${inventory.counts.files} rendererSites=${inventory.counts.rendererSites} pdfResponseSites=${inventory.counts.pdfResponseSites}`);
