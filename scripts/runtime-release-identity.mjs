import crypto from "node:crypto";

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,200}$/;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function createRuntimeReleaseIdentity({ release, commit, tree, manifestSha256, migrationLevel }) {
  if (!TOKEN.test(release ?? "")) throw new Error("invalid release label");
  if (!HEX40.test(commit ?? "") || !HEX40.test(tree ?? "")) throw new Error("invalid source identity");
  if (!HEX64.test(manifestSha256 ?? "")) throw new Error("invalid package manifest");
  if (!TOKEN.test(migrationLevel ?? "")) throw new Error("invalid migration level");
  const identityFingerprint = sha256(JSON.stringify({ release, commit, tree, manifestSha256, migrationLevel }));
  return {
    schemaVersion: "bimlog-runtime-release-identity-v1",
    release,
    sourceCommit: commit,
    sourceTree: tree,
    assetManifestSha256: manifestSha256,
    databaseMigrationLevel: migrationLevel,
    packageId: `bimlog-${commit.slice(0, 16)}-${manifestSha256.slice(0, 16)}`,
    identityFingerprint,
    identityBound: true,
  };
}
