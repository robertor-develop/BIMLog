import assert from "node:assert/strict";
import { LENS_NEXT_SYNC_LABELS, lensNextSyncPlanSummary, lensNextSyncRecoveryGuidance } from "./lens-next-sync-presentation";
import type { LensNextSyncPlan } from "./lens-next-types";

const plan = (values: Partial<LensNextSyncPlan>): LensNextSyncPlan => ({
  items: [], inSync: 0, confirmLocalIdentity: 0, pullFromBimlog: 0, uploadToBimlog: 0,
  manualConflict: 0, blocked: 0, executable: false, ...values,
});

assert.equal(LENS_NEXT_SYNC_LABELS.manual_conflict, "Manual conflict");
assert.equal(lensNextSyncPlanSummary(plan({ manualConflict: 1 })), "1 record needs attention before synchronization");
assert.equal(lensNextSyncPlanSummary(plan({ pullFromBimlog: 2, executable: true })), "2 verified changes are ready for review");
assert.equal(lensNextSyncPlanSummary(plan({ inSync: 4 })), "No synchronization changes are pending");
assert.match(lensNextSyncRecoveryGuidance("manual_conflict", true) ?? "", /Automatic replacement is prohibited/);
assert.match(lensNextSyncRecoveryGuidance("blocked", false) ?? "", /not eligible for automatic synchronization/);
assert.equal(lensNextSyncRecoveryGuidance("in_sync", true), null);
console.log("Lens Next synchronization presentation: PASS");
