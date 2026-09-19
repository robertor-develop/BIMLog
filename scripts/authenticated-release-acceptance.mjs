const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;

export function validateAuthenticatedReleaseAcceptance(receipt) {
  const errors = [];
  const require = (condition, field, message) => { if (!condition) errors.push({ field, message }); };
  require(receipt?.schemaVersion === "bimlog-authenticated-release-acceptance-v1", "schemaVersion", "unsupported receipt schema");
  require(receipt?.status === "PASS", "status", "acceptance is not PASS");
  require(typeof receipt?.release === "string" && receipt.release.length > 0, "release", "release identity is missing");
  require(COMMIT.test(receipt?.source?.commit ?? ""), "source.commit", "exact source commit is missing");
  require(COMMIT.test(receipt?.source?.tree ?? ""), "source.tree", "exact source tree is missing");
  require(receipt?.provider?.sourceTree === receipt?.source?.tree, "provider.sourceTree", "provider tree differs from source tree");
  require(typeof receipt?.provider?.publicationReceiptId === "string" && receipt.provider.publicationReceiptId.length > 0, "provider.publicationReceiptId", "publication receipt is missing");
  require(receipt?.live?.healthStatus === 200, "live.healthStatus", "live health did not return 200");
  require(receipt?.live?.release === receipt?.release, "live.release", "live release is stale or mismatched");
  require(receipt?.live?.identityBound === true, "live.identityBound", "live package identity is unbound");
  require(SHA256.test(receipt?.assets?.manifestSha256 ?? ""), "assets.manifestSha256", "asset manifest digest is missing");
  require(receipt?.live?.sourceCommit === receipt?.source?.commit, "live.sourceCommit", "live source differs from the published commit");
  require(receipt?.live?.assetManifestSha256 === receipt?.assets?.manifestSha256, "live.assetManifestSha256", "live asset manifest differs from the published package");
  require(typeof receipt?.live?.packageId === "string" && receipt.live.packageId.length > 0 && receipt.live.packageId !== "unbound", "live.packageId", "live package identity is missing");
  require(typeof receipt?.live?.databaseMigrationLevel === "string" && receipt.live.databaseMigrationLevel.length > 0 && receipt.live.databaseMigrationLevel !== "unbound", "live.databaseMigrationLevel", "live database contract is missing");
  const assets = receipt?.assets?.sessionCoordinatorAssets;
  require(Array.isArray(assets) && assets.length > 0, "assets.sessionCoordinatorAssets", "session coordinator assets are absent");
  for (const [index, asset] of (Array.isArray(assets) ? assets : []).entries()) {
    require(typeof asset.path === "string" && asset.path.length > 0, `assets.sessionCoordinatorAssets.${index}.path`, "asset path is missing");
    require(SHA256.test(asset.packageSha256 ?? ""), `assets.sessionCoordinatorAssets.${index}.packageSha256`, "package asset digest is invalid");
    require(asset.servedSha256 === asset.packageSha256, `assets.sessionCoordinatorAssets.${index}.servedSha256`, "served asset differs from package");
  }
  require(receipt?.actors?.superAdmin?.authenticated === true, "actors.superAdmin.authenticated", "Super Administrator login failed");
  require(receipt?.actors?.superAdmin?.totalControl === true, "actors.superAdmin.totalControl", "Super Administrator Total Control failed");
  require(receipt?.actors?.superAdmin?.livingBrief === true, "actors.superAdmin.livingBrief", "Super Administrator Living Brief failed");
  require(receipt?.actors?.scopedUser?.authenticated === true, "actors.scopedUser.authenticated", "scoped-user login failed");
  require(receipt?.actors?.scopedUser?.projectWorkspace === true, "actors.scopedUser.projectWorkspace", "scoped project workspace failed");
  require(receipt?.actors?.scopedUser?.totalControlDenied === true, "actors.scopedUser.totalControlDenied", "scoped user received excessive authority");
  require(receipt?.session?.reloadRestored === true, "session.reloadRestored", "reload restoration failed");
  require(receipt?.session?.twoTabsContinuous === true, "session.twoTabsContinuous", "two-tab continuity failed");
  require(receipt?.session?.staleResponseRejected === true, "session.staleResponseRejected", "stale response protection failed");
  require(receipt?.browser?.visibleChrome === true, "browser.visibleChrome", "acceptance was not run in visible Chrome");
  require(receipt?.browser?.consoleErrors === 0, "browser.consoleErrors", "browser console errors occurred");
  require(receipt?.browser?.pageErrors === 0, "browser.pageErrors", "browser page errors occurred");
  return { ok: errors.length === 0, errors };
}
