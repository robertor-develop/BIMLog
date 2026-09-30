import assert from "node:assert/strict";
import { canonicalFloorHourEstimate, floorHourEstimateFingerprint } from "./floor-hour-cost-contract";

assert.equal(canonicalFloorHourEstimate("100.000000"), "100");
assert.throws(() => canonicalFloorHourEstimate("0"), /greater than zero/);
const fingerprint = floorHourEstimateFingerprint({ projectId: 59, workItemId: "scope-1", locationIdentity: "level-07", version: 2, approvedHours: "100", excessRate: "3.5", policyVersionId: "policy-v3" });
assert.match(fingerprint, /^[a-f0-9]{64}$/);
assert.notEqual(fingerprint, floorHourEstimateFingerprint({ projectId: 59, workItemId: "scope-1", locationIdentity: "level-08", version: 2, approvedHours: "100", excessRate: "3.5", policyVersionId: "policy-v3" }));
console.log("UX131 versioned floor-hour estimate identity: PASS");
