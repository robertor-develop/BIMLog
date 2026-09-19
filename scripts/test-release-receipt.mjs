import assert from "node:assert/strict";
import { validateReleaseReceipt } from "./release-receipt.mjs";

const commit = "a".repeat(40), tree = "b".repeat(40), manifest = "c".repeat(64);
const valid = {
  schemaVersion: "bimlog-release-receipt-v1",
  release: "v1.05.N18-P33",
  source: { commit, tree },
  assets: { manifestSha256: manifest },
  database: { migrationLevel: "delivery-workflow-v1" },
  provider: { name: "replit", publicationReceiptId: "receipt-123", deploymentId: "deployment-456" },
  live: { release: "v1.05.N18-P33", sourceCommit: commit, assetManifestSha256: manifest, databaseMigrationLevel: "delivery-workflow-v1", packageId: "deployment-456" },
};
assert.equal(validateReleaseReceipt(valid).ok, true);
for (const [field, mutate] of [
  ["sourceCommit", (r) => r.live.sourceCommit = "d".repeat(40)],
  ["assetManifestSha256", (r) => r.live.assetManifestSha256 = "e".repeat(64)],
  ["databaseMigrationLevel", (r) => r.live.databaseMigrationLevel = "wrong"],
  ["packageId", (r) => r.live.packageId = "wrong"],
  ["release", (r) => r.live.release = "v1.05.N17-P32"],
]) {
  const candidate = structuredClone(valid); mutate(candidate);
  const result = validateReleaseReceipt(candidate);
  assert.equal(result.ok, false, `${field} mismatch must fail`);
  assert.ok(result.errors.some((error) => error.field === `live.${field}`));
}
console.log("RELEASE_RECEIPT_TESTS=PASS positive=1 mismatches=5");
