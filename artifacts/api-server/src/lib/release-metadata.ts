import { createHash } from "node:crypto";
import { BIMLOG_RELEASE_IDENTITY } from "@workspace/api-zod";

const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,160}$/;

function bounded(value: string | undefined, pattern: RegExp, fallback: string) {
  const normalized = value?.trim() ?? "";
  return pattern.test(normalized) ? normalized : fallback;
}

type BuildIdentity = {
  sourceCommit?: string;
  assetManifestSha256?: string;
  packageId?: string;
  databaseMigrationLevel?: string;
};

const embeddedBuildIdentity: BuildIdentity = {
  sourceCommit: process.env.BIMLOG_BUILD_SOURCE_COMMIT,
  assetManifestSha256: process.env.BIMLOG_BUILD_ASSET_MANIFEST_SHA256,
  packageId: process.env.BIMLOG_BUILD_PACKAGE_ID,
  databaseMigrationLevel: process.env.BIMLOG_BUILD_DATABASE_MIGRATION_LEVEL,
};

export function resolveReleaseMetadata(environment: NodeJS.ProcessEnv = process.env, buildIdentity: BuildIdentity = embeddedBuildIdentity) {
  const sourceCommit = bounded(buildIdentity.sourceCommit ?? environment.BIMLOG_SOURCE_COMMIT ?? environment.REPLIT_GIT_COMMIT_SHA, COMMIT, "unbound");
  const assetManifestSha256 = bounded(buildIdentity.assetManifestSha256 ?? environment.BIMLOG_ASSET_MANIFEST_SHA256, SHA256, "unbound");
  const packageId = bounded(buildIdentity.packageId ?? environment.BIMLOG_PACKAGE_ID, TOKEN, "unbound");
  const databaseMigrationLevel = bounded(buildIdentity.databaseMigrationLevel ?? environment.BIMLOG_DATABASE_MIGRATION_LEVEL, TOKEN, "unbound");
  const identityFingerprint = createHash("sha256")
    .update([BIMLOG_RELEASE_IDENTITY.label, sourceCommit, assetManifestSha256, packageId, databaseMigrationLevel].join("\n"))
    .digest("hex");
  return Object.freeze({
    release: BIMLOG_RELEASE_IDENTITY.label,
    binaryVersion: BIMLOG_RELEASE_IDENTITY.binaryVersion,
    sourceCommit,
    assetManifestSha256,
    packageId,
    databaseMigrationLevel,
    identityFingerprint,
    bound: sourceCommit !== "unbound" && assetManifestSha256 !== "unbound" && packageId !== "unbound" && databaseMigrationLevel !== "unbound",
  });
}

export function publicReleaseMetadata(environment: NodeJS.ProcessEnv = process.env) {
  const metadata = resolveReleaseMetadata(environment);
  return {
    release: metadata.release,
    sourceCommit: metadata.sourceCommit,
    assetManifestSha256: metadata.assetManifestSha256,
    packageId: metadata.packageId,
    databaseMigrationLevel: metadata.databaseMigrationLevel,
    identityFingerprint: metadata.identityFingerprint,
    identityBound: metadata.bound,
  };
}
