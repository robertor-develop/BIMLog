import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseSingularity } from "./release-singularity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const gate = readJson("contracts/block01-release-gate.json");
assert.equal(gate.schemaVersion, "bimlog-block01-release-gate-v1");
assert.deepEqual(gate.builds, [1, 2, 3, 4, 5]);
for (const relative of gate.requiredContracts) assert.ok(fs.existsSync(path.join(root, relative)), `missing ${relative}`);
for (const field of ["sourceCommit", "sourceTree", "packageId", "assetManifestSha256", "databaseMigrationLevel", "healthIdentity"]) assert.ok(gate.requiredIdentityFields.includes(field));
for (const negative of ["stale_source", "stale_package", "stale_schema", "unbound_runtime", "company38_name_merge", "duplicate_identity", "destructive_cleanup"]) assert.ok(gate.negativeGates.includes(negative));
assert.equal(gate.destructiveCleanupAllowed, false);
assert.equal(gate.publicationRequired, false);

const commit = "a".repeat(40), tree = "b".repeat(40), asset = "c".repeat(64);
const record = { schemaVersion: "bimlog-release-singularity-v1", source: { commit, tree }, artifact: { sourceCommit: commit, packageId: "block01-package", assetManifestSha256: asset }, database: { migrationLevel: "block01-schema" }, runtime: { sourceCommit: commit, packageId: "block01-package", assetManifestSha256: asset, databaseMigrationLevel: "block01-schema", identityBound: true } };
assert.equal(validateReleaseSingularity(record, { sourceCommit: commit, packageId: "block01-package", migrationLevel: "block01-schema" }).ok, true);
assert.ok(validateReleaseSingularity(record, { sourceCommit: "d".repeat(40) }).errors.includes("STALE_SOURCE_COMMIT"));
assert.ok(validateReleaseSingularity(record, { packageId: "stale-package" }).errors.includes("STALE_PACKAGE_ID"));
assert.ok(validateReleaseSingularity(record, { migrationLevel: "stale-schema" }).errors.includes("STALE_DATABASE_MIGRATION_LEVEL"));

const health = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/health.ts"), "utf8");
assert.match(health, /publicReleaseMetadata/);
assert.match(health, /release-diagnostics/);
assert.match(health, /isSuperAdminMiddleware/);
const ledger = readJson("contracts/requirement-evidence-ledger.json");
assert.equal(new Set(Object.values(ledger.layers).flat()).size, 130);
assert.deepEqual(readJson("contracts/company-35-binding-correction.json").excludedCompanyIds, [38]);
console.log("BLOCK01_BUILD005=PASS builds=5 identities=130 stale_gates=3 destructive_cleanup=false publication_required=false");
