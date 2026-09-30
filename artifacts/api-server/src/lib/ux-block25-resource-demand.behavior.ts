import assert from "node:assert/strict";
import { resourceDemandFromPlan, splitResourcePlan } from "./resource-demand-contract";

const demand = resourceDemandFromPlan({ id:"D1", role:"Drafter", scopeItemId:"S1", locationLabel:"Level 7", resourceCount:2, plannedHours:"40", internalHourlyRate:"5.10" });
assert.deepEqual(demand, { id:"D1", role:"Drafter", scopeItemId:"S1", workPackageId:"", workPackageTaskId:"", locationLabel:"Level 7", resourceCount:2, plannedHours:"40", plannedCostPerHour:"5.1", plannedCost:"408" });
assert.throws(() => resourceDemandFromPlan({ userId:7, plannedHours:"8" }), (error:any) => error.code === "RESOURCE_DEMAND_NAMED_PERSON");
assert.throws(() => resourceDemandFromPlan({ resourceCount:0 }), (error:any) => error.code === "RESOURCE_DEMAND_COUNT_INVALID");
const split = splitResourcePlan([{ id:"D1", plannedHours:"8" }, { id:"A1", userId:7, plannedHours:"8" }]);
assert.equal(split.demands.length, 1); assert.equal(split.namedAssignments.length, 1);
console.log("UX121 generic planning demand has no fake person identity: PASS");
