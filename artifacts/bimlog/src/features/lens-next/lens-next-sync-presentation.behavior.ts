import assert from "node:assert/strict";
import { LENS_NEXT_SYNC_LABELS, lensNextSyncLabel, lensNextSyncPlanSummary, lensNextSyncRecoveryGuidance, lensNextSyncReviewCount, lensNextSyncReviewItems } from "./lens-next-sync-presentation";
import type { LensNextSyncPlan } from "./lens-next-types";

const plan = (values: Partial<LensNextSyncPlan>): LensNextSyncPlan => ({
  items: [], inSync: 0, confirmLocalIdentity: 0, pullFromBimlog: 0, uploadToBimlog: 0,
  manualConflict: 0, blocked: 0, executable: false, ...values,
});

assert.equal(LENS_NEXT_SYNC_LABELS.manual_conflict, "Manual conflict");
assert.equal(lensNextSyncPlanSummary(plan({ manualConflict: 1 })), "1 record needs attention before synchronization");
assert.equal(lensNextSyncPlanSummary(plan({ pullFromBimlog: 2, executable: true })), "2 verified changes are ready for review");
assert.equal(lensNextSyncPlanSummary(plan({ inSync: 4 })), "No synchronization changes are pending");
assert.equal(lensNextSyncLabel("blocked", "es"), "Bloqueado");
assert.equal(lensNextSyncPlanSummary(plan({ manualConflict: 2 }), "es"), "2 registros requieren atención antes de sincronizar");
assert.match(lensNextSyncRecoveryGuidance("manual_conflict", true, "es") ?? "", /reemplazo automático está prohibido/);
assert.match(lensNextSyncRecoveryGuidance("manual_conflict", true) ?? "", /Automatic replacement is prohibited/);
assert.match(lensNextSyncRecoveryGuidance("blocked", false) ?? "", /not eligible for automatic synchronization/);
assert.equal(lensNextSyncRecoveryGuidance("in_sync", true), null);
const mixed = plan({
  items: [
    { disposition: "in_sync", platformServerId: 1, localNavisworksGuid: "a", displayId: "A", reason: "paired" },
    { disposition: "blocked", platformServerId: 2, localNavisworksGuid: null, displayId: "B", reason: "missing package" },
    { disposition: "upload_to_bimlog", platformServerId: null, localNavisworksGuid: "c", displayId: "C", reason: "local only" },
  ],
  inSync: 1, blocked: 1, uploadToBimlog: 1,
});
assert.equal(lensNextSyncReviewCount(mixed, "all"), 3);
assert.equal(lensNextSyncReviewCount(mixed, "attention"), 1);
assert.equal(lensNextSyncReviewCount(mixed, "changes"), 1);
assert.equal(lensNextSyncReviewCount(mixed, "in_sync"), 1);
assert.deepEqual(lensNextSyncReviewItems(mixed, "attention").map(item => item.displayId), ["B"]);
assert.deepEqual(lensNextSyncReviewItems(mixed, "changes").map(item => item.displayId), ["C"]);
assert.equal(lensNextSyncReviewItems(plan({}), "attention").length, 0);
console.log("Lens Next synchronization presentation: PASS");
