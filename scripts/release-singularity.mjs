const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,200}$/;

export function validateReleaseSingularity(record, expected = {}) {
  const errors = [];
  const require = (condition, code) => { if (!condition) errors.push(code); };
  require(record?.schemaVersion === "bimlog-release-singularity-v1", "SCHEMA_VERSION_INVALID");
  require(COMMIT.test(record?.source?.commit ?? ""), "SOURCE_COMMIT_INVALID");
  require(COMMIT.test(record?.source?.tree ?? ""), "SOURCE_TREE_INVALID");
  require(COMMIT.test(record?.artifact?.sourceCommit ?? ""), "ARTIFACT_SOURCE_INVALID");
  require(TOKEN.test(record?.artifact?.packageId ?? ""), "PACKAGE_ID_INVALID");
  require(SHA256.test(record?.artifact?.assetManifestSha256 ?? ""), "ASSET_MANIFEST_INVALID");
  require(TOKEN.test(record?.database?.migrationLevel ?? ""), "DATABASE_MIGRATION_LEVEL_INVALID");
  require(record?.runtime?.identityBound === true, "RUNTIME_IDENTITY_UNBOUND");
  require(record?.source?.commit === record?.artifact?.sourceCommit, "SOURCE_ARTIFACT_MISMATCH");
  require(record?.source?.commit === record?.runtime?.sourceCommit, "SOURCE_RUNTIME_MISMATCH");
  require(record?.artifact?.packageId === record?.runtime?.packageId, "PACKAGE_RUNTIME_MISMATCH");
  require(record?.artifact?.assetManifestSha256 === record?.runtime?.assetManifestSha256, "ASSET_RUNTIME_MISMATCH");
  require(record?.database?.migrationLevel === record?.runtime?.databaseMigrationLevel, "SCHEMA_RUNTIME_MISMATCH");
  if (expected.sourceCommit) require(record?.source?.commit === expected.sourceCommit, "STALE_SOURCE_COMMIT");
  if (expected.packageId) require(record?.artifact?.packageId === expected.packageId, "STALE_PACKAGE_ID");
  if (expected.migrationLevel) require(record?.database?.migrationLevel === expected.migrationLevel, "STALE_DATABASE_MIGRATION_LEVEL");
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function requireReleaseSingularity(record, expected) {
  const result = validateReleaseSingularity(record, expected);
  if (!result.ok) throw new Error(`BIMLOG_RELEASE_SINGULARITY_DENIED:${result.errors.join(",")}`);
  return Object.freeze(record);
}
