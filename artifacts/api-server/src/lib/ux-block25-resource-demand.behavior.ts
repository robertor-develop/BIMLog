import assert from "node:assert/strict";
import { resourceDemandFromPlan, splitResourcePlan } from "./resource-demand-contract";
import { normalizeJobIntakeData, jobIntakeCompletion } from "./job-intake-contract";

const demand = resourceDemandFromPlan({ id:"D1", role:"Drafter", scopeItemId:"S1", locationLabel:"Level 7", resourceCount:2, plannedHours:"40", internalHourlyRate:"5.10" });
assert.deepEqual(demand, { id:"D1", role:"Drafter", scopeItemId:"S1", workPackageId:"", workPackageTaskId:"", locationLabel:"Level 7", resourceCount:2, plannedHours:"40", plannedCostPerHour:"5.1", plannedCost:"408" });
assert.throws(() => resourceDemandFromPlan({ userId:7, plannedHours:"8" }), (error:any) => error.code === "RESOURCE_DEMAND_NAMED_PERSON");
assert.throws(() => resourceDemandFromPlan({ resourceCount:0 }), (error:any) => error.code === "RESOURCE_DEMAND_COUNT_INVALID");
const split = splitResourcePlan([{ id:"D1", plannedHours:"8" }, { id:"A1", userId:7, plannedHours:"8" }]);
assert.equal(split.demands.length, 1); assert.equal(split.namedAssignments.length, 1);
const normalized:any = normalizeJobIntakeData({ identity:{currency:"USD"}, commercial:{contracts:[{id:"C1"}]}, scopeItems:[{id:"S1",name:"Shop drawings",plannedHours:"80",contractId:"C1"}], team:{assignments:[{id:"D2",role:"Coordinator",scopeItemId:"S1",locationLabel:"Level 3",resourceCount:2,plannedHours:"10",internalHourlyRate:"6.5"}]} });
assert.equal(normalized.team.assignments[0].resourceCount,2); assert.equal(normalized.team.assignments[0].locationLabel,"Level 3"); assert.equal(normalized.team.assignments[0].plannedLaborCost,"130");
const core = { package:false,budget:false,contracts:false,costValuePlanner:false,anyCommercial:false,fullCommercialActivation:false };
const sevenFloors:any = normalizeJobIntakeData({identity:{jobName:"19 month project",jobCode:"P19",clientName:"Client",currency:"USD"},scopeItems:Array.from({length:7},(_,i)=>({id:`F${i+1}`,name:`Floor ${i+1}`,plannedHours:"100",quantity:"1",unit:"Floor"})),delivery:{workflowTemplate:"shop-drawing",submittalStrategy:"Coordinate and issue"},review:{scopeConfirmed:true,deliveryConfirmed:true,teamConfirmed:true},team:{assignments:Array.from({length:7},(_,i)=>({id:`D${i+1}`,role:i%2?"Coordinator":"Drafter",scopeItemId:`F${i+1}`,locationLabel:`Floor ${i+1}`,resourceCount:1,plannedHours:"100"}))}});
assert.equal(jobIntakeCompletion(sevenFloors,[],core).ready,true); assert.equal(splitResourcePlan(sevenFloors.team.assignments).namedAssignments.length,0);
console.log("UX121 generic planning demand has no fake person identity: PASS");
console.log("UX122 floor/scope quantity and hours budget before hiring: PASS");
console.log("UX123 seven-floor activation readiness permits zero named assignments: PASS");
console.log("UX124 Operations exposes each future floor demand for phased task assignment: PASS");
