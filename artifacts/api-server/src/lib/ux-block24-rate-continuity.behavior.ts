import assert from "node:assert/strict";
import { normalizeJobIntakeData } from "./job-intake-contract";
import { buildActivatedCommercialBaseline } from "./job-activation-commercial-baseline";

const source = { kind: "saved_apu_rate", sourceId: "apu-plan-v7", sourceLabel: "BIM coordination $30", unitRate: "30.00", unit: "Hours", currency: "USD", apuPlanVersion: 7, apuFingerprint: "f7" };
const raw: any = { identity:{projectName:"Rate continuity",currency:"USD"}, classification:{}, scopeStructure:{}, commercial:{contracts:[{id:"C1",title:"Base",contractNumber:"001"}]}, scopeItems:[{id:"CI-1",name:"Shop drawings",plannedHours:"10",quantity:"10",billingHourlyRate:"30.00",unit:"Hours",apuPlanVersion:7,rateSource:source,contractId:"C1",projectCostNodeId:"PCN-1",budgetSnapshotLineId:"BSL-1",workflowTemplate:"bim-submittal"}], delivery:{}, team:{assignments:[]}, governance:{}, review:{} };
const normalized = normalizeJobIntakeData(raw);
assert.equal(normalized.scopeItems[0].billingHourlyRate, "30");
assert.equal(normalized.scopeItems[0].rateSource?.sourceId, "apu-plan-v7");
const baseline = buildActivatedCommercialBaseline({ intakeId:"I1", projectId:1, currency:"USD", contracts:[{profileId:"C1",contractId:"FC1",contractVersionId:"FV1",contractNumber:"001",currency:"USD",items:[{stableLineId:"CI-1",displayName:"Shop drawings",projectCostNodeId:"PCN-1",budgetSnapshotLineId:"BSL-1",quantity:"10",unit:"Hours",unitRate:"30",contractValue:"300",apuPlanVersion:7,rateSource:normalized.scopeItems[0].rateSource,workflowTemplate:"bim-submittal"}]}], workflowInstances:1,workItems:1,tasks:1,resourceAssignments:0 });
assert.equal(baseline.contractItems[0].pricingSnapshot.unitRate, "30");
assert.equal(baseline.contractItems[0].pricingSnapshot.apuPlanVersion, 7);
assert.equal((baseline.contractItems[0].pricingSnapshot.rateSource as any).sourceId, "apu-plan-v7");
assert.notEqual((baseline.contractItems[0].pricingSnapshot.rateSource as any).sourceId, "apu-plan-v3");
console.log("ux-block24-rate-continuity.behavior: PASS");
