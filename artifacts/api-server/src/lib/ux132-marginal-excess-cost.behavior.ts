import assert from "node:assert/strict";
import { allocateFloorHourCosts } from "./floor-hour-cost-contract";

const result = allocateFloorHourCosts({
  estimateVersionId: "estimate-v1",
  approvedHours: "100",
  excessRate: "3.50",
  entries: [{ id: "time-1", workDate: "2026-09-30", createdAt: "2026-09-30T12:00:00Z", hours: "110", normalRate: "5.10", status: "approved" }],
});
assert.deepEqual(result.totals, { normalHours: "100", excessHours: "10", normalCost: "510", excessCost: "35", totalCost: "545" });
assert.equal(result.allocations[0].customerBillingRateChanged, false);
assert.equal(result.allocations[0].normalRate, "5.1");
assert.equal(result.allocations[0].excessRate, "3.5");
console.log("UX132 only marginal excess hours receive the approved excess rate: PASS");
