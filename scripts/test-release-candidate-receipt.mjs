import assert from "node:assert/strict";
import { validateReleaseCandidateReceipt } from "./release-candidate-receipt.mjs";

const commit = "a".repeat(40), tree = "b".repeat(40), digest = "c".repeat(64);
const receipt = {
  schemaVersion: "bimlog-release-candidate-receipt-v1",
  state: "BUILD_VERIFIED",
  source: { commit, tree },
  package: { id: `bimlog-${commit.slice(0,16)}-${digest.slice(0,16)}` },
  assets: { manifestSha256: digest },
  database: { schemaVersion: "schema-31f53fbbf1004307dc5a4e0c" },
  deployment: { publicationReceiptId: null, liveVerified: false },
  acceptance: { independentAccepted: false, customerAccepted: false },
  timestamps: { builtAt: "2026-10-20T18:00:00.000Z" },
  journeys: {
    desktop: { status: "PASS", checks: ["dock-right", "dock-left", "resize", "close"] },
    tablet: { status: "PASS", checks: ["workspace-min-320", "reload-state"] },
    mobile: { status: "PASS", checks: ["fullscreen-at-760", "focus-return"] },
  },
};
assert.deepEqual(validateReleaseCandidateReceipt(receipt, commit), { ok: true, errors: [] });
for (const mutate of [
  value => { value.source.commit = "d".repeat(40); },
  value => { value.deployment.liveVerified = true; },
  value => { value.acceptance.independentAccepted = true; },
  value => { value.journeys.tablet.checks = []; },
]) {
  const invalid = structuredClone(receipt); mutate(invalid);
  assert.equal(validateReleaseCandidateReceipt(invalid, commit).ok, false);
}
console.log("RELEASE_CANDIDATE_RECEIPT_PASS exactIdentity=true viewports=3 state=BUILD_VERIFIED acceptanceSeparated=true");
