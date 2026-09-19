import assert from "node:assert/strict";
import { validateAuthenticatedReleaseAcceptance } from "./authenticated-release-acceptance.mjs";

const sha = "a".repeat(64), commit = "b".repeat(40), tree = "c".repeat(40);
const valid = {
  schemaVersion: "bimlog-authenticated-release-acceptance-v1",
  status: "PASS",
  release: "v1.05.N18-P34",
  source: { commit, tree },
  provider: { sourceTree: tree, publicationReceiptId: "provider-receipt" },
  live: { healthStatus: 200, release: "v1.05.N18-P34", sourceCommit: commit, assetManifestSha256: sha, packageId: "bimlog-package", databaseMigrationLevel: "schema-contract", identityBound: true },
  assets: { manifestSha256: sha, sessionCoordinatorAssets: [{ path: "/assets/index.js", packageSha256: sha, servedSha256: sha }] },
  actors: {
    superAdmin: { authenticated: true, totalControl: true, livingBrief: true },
    scopedUser: { authenticated: true, projectWorkspace: true, totalControlDenied: true },
  },
  session: { reloadRestored: true, twoTabsContinuous: true, staleResponseRejected: true },
  browser: { visibleChrome: true, consoleErrors: 0, pageErrors: 0 },
};
assert.equal(validateAuthenticatedReleaseAcceptance(valid).ok, true);
for (const mutate of [
  (v) => { v.live.release = "v1.05.N18-P33"; },
  (v) => { v.live.identityBound = false; },
  (v) => { v.live.sourceCommit = "d".repeat(40); },
  (v) => { v.live.assetManifestSha256 = "d".repeat(64); },
  (v) => { v.assets.sessionCoordinatorAssets[0].servedSha256 = "d".repeat(64); },
  (v) => { v.actors.scopedUser.totalControlDenied = false; },
  (v) => { v.session.twoTabsContinuous = false; },
  (v) => { v.browser.consoleErrors = 1; },
]) {
  const candidate = structuredClone(valid); mutate(candidate);
  assert.equal(validateAuthenticatedReleaseAcceptance(candidate).ok, false);
}
console.log("authenticated release acceptance contract: 9/9 passed");
