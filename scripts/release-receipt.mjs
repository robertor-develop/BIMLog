import { readReleaseIdentity } from "./release-identity.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,200}$/;

export function validateReleaseReceipt(receipt, identity = readReleaseIdentity()) {
  const errors = [];
  const require = (condition, field, message) => { if (!condition) errors.push({ field, message }); };
  require(receipt?.schemaVersion === "bimlog-release-receipt-v1", "schemaVersion", "unsupported schema");
  require(receipt?.release === identity.label, "release", `must equal ${identity.label}`);
  require(HEX40.test(receipt?.source?.commit ?? ""), "source.commit", "must be a lowercase full commit hash");
  require(HEX40.test(receipt?.source?.tree ?? ""), "source.tree", "must be a lowercase full tree hash");
  require(HEX64.test(receipt?.assets?.manifestSha256 ?? ""), "assets.manifestSha256", "must be SHA-256");
  require(TOKEN.test(receipt?.database?.migrationLevel ?? ""), "database.migrationLevel", "must be a bounded identifier");
  require(receipt?.provider?.name === "replit", "provider.name", "must be replit");
  require(TOKEN.test(receipt?.provider?.publicationReceiptId ?? ""), "provider.publicationReceiptId", "is required");
  require(TOKEN.test(receipt?.provider?.deploymentId ?? ""), "provider.deploymentId", "is required");
  require(receipt?.live?.release === receipt?.release, "live.release", "does not match release");
  require(receipt?.live?.sourceCommit === receipt?.source?.commit, "live.sourceCommit", "does not match source.commit");
  require(receipt?.live?.assetManifestSha256 === receipt?.assets?.manifestSha256, "live.assetManifestSha256", "does not match assets.manifestSha256");
  require(receipt?.live?.databaseMigrationLevel === receipt?.database?.migrationLevel, "live.databaseMigrationLevel", "does not match database.migrationLevel");
  require(receipt?.live?.packageId === receipt?.provider?.deploymentId, "live.packageId", "does not match provider.deploymentId");
  return { ok: errors.length === 0, errors };
}
