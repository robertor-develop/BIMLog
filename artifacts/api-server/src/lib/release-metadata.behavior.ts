import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicReleaseMetadata, resolveReleaseMetadata } from "./release-metadata";

const commit = "a".repeat(40);
const asset = "b".repeat(64);
const environment = {
  BIMLOG_SOURCE_COMMIT: commit,
  BIMLOG_ASSET_MANIFEST_SHA256: asset,
  BIMLOG_PACKAGE_ID: "replit-deployment-123",
  BIMLOG_DATABASE_MIGRATION_LEVEL: "delivery-workflow-v1",
};
const metadata = resolveReleaseMetadata(environment);
assert.equal(metadata.release, "v1.05.N18-P34");
assert.equal(metadata.sourceCommit, commit);
assert.equal(metadata.assetManifestSha256, asset);
assert.equal(metadata.bound, true);
assert.match(metadata.identityFingerprint, /^[0-9a-f]{64}$/);
assert.equal(resolveReleaseMetadata({ BIMLOG_SOURCE_COMMIT: "stale" }).bound, false);
const embedded = resolveReleaseMetadata(
  { BIMLOG_SOURCE_COMMIT: "c".repeat(40), BIMLOG_PACKAGE_ID: "stale-runtime-package" },
  { sourceCommit: commit, assetManifestSha256: asset, packageId: "immutable-package", databaseMigrationLevel: "schema-contract" },
);
assert.equal(embedded.sourceCommit, commit);
assert.equal(embedded.packageId, "immutable-package");
assert.equal(embedded.bound, true);
assert.deepEqual(Object.keys(publicReleaseMetadata(environment)).sort(), ["assetManifestSha256", "databaseMigrationLevel", "identityBound", "identityFingerprint", "packageId", "release", "sourceCommit"]);

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.resolve(here, "../routes/health.ts"), "utf8");
assert.match(route, /release-diagnostics", authMiddleware, isSuperAdminMiddleware/);
assert.doesNotMatch(route, /JWT_SECRET|DATABASE_URL|password|credential/i);
console.log("RELEASE_METADATA=PASS public=safe diagnostics=super-admin identity=bound");
