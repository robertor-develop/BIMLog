import assert from "node:assert/strict";
import { requireReleaseSingularity, validateReleaseSingularity } from "./release-singularity.mjs";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const asset = "c".repeat(64);
const record = {
  schemaVersion: "bimlog-release-singularity-v1",
  source: { commit, tree },
  artifact: { sourceCommit: commit, packageId: "bimlog-package-001", assetManifestSha256: asset },
  database: { migrationLevel: "schema-001" },
  runtime: { sourceCommit: commit, packageId: "bimlog-package-001", assetManifestSha256: asset, databaseMigrationLevel: "schema-001", identityBound: true },
};

assert.equal(validateReleaseSingularity(record, { sourceCommit: commit }).ok, true);
assert.equal(requireReleaseSingularity(record, { packageId: "bimlog-package-001" }), record);
for (const [mutation, code] of [
  [{ source: { ...record.source, commit: "d".repeat(40) } }, "SOURCE_ARTIFACT_MISMATCH"],
  [{ runtime: { ...record.runtime, packageId: "stale-package" } }, "PACKAGE_RUNTIME_MISMATCH"],
  [{ runtime: { ...record.runtime, databaseMigrationLevel: "stale-schema" } }, "SCHEMA_RUNTIME_MISMATCH"],
  [{ runtime: { ...record.runtime, identityBound: false } }, "RUNTIME_IDENTITY_UNBOUND"],
]) {
  const result = validateReleaseSingularity({ ...record, ...mutation }, { sourceCommit: commit });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes(code));
}
assert.ok(validateReleaseSingularity(record, { sourceCommit: "e".repeat(40) }).errors.includes("STALE_SOURCE_COMMIT"));
console.log("RELEASE_SINGULARITY_BUILD_001=PASS positive=1 negative=5");
