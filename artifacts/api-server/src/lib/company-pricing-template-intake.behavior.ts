import assert from "node:assert/strict";
import { jobIntakeCompletion, normalizeJobIntakeData } from "./job-intake-contract";
import { buildActivatedCommercialBaseline } from "./job-activation-commercial-baseline";

const versionId = "7a0b7ad5-576d-4cea-890d-ff385ea283b3";
const secondVersionId = "a87cc132-b3e4-4b38-8b15-7c85106cbf03";
const data = normalizeJobIntakeData({
  identity: { jobName:"Pricing reference proof",jobCode:"REF-1",currency:"USD" },
  commercial: { contracts:[
    { id:"BASE",title:"Base",contractNumber:"BASE-001",pricingTemplateVersionId:versionId },
    { id:"ADDITIONAL",title:"Additional",contractNumber:"ADD-001",pricingTemplateVersionId:secondVersionId },
  ] },
  scopeItems:[
    { id:"CI-1",name:"Drawing",contractId:"BASE",plannedHours:"10",billingHourlyRate:"25",apuPlanVersion:3,projectCostNodeId:"PCN-1",budgetSnapshotLineId:"BL-1" },
    { id:"CI-2",name:"Review",contractId:"ADDITIONAL",plannedHours:"4",billingHourlyRate:"42.50",apuPlanVersion:9,projectCostNodeId:"PCN-2",budgetSnapshotLineId:"BL-2" },
  ],
});
assert.equal(data.commercial.contracts[0].pricingTemplateVersionId,versionId);
assert.equal(data.commercial.contracts[1].pricingTemplateVersionId,secondVersionId);
assert.deepEqual(data.scopeItems.map(item => item.contractId),["BASE","ADDITIONAL"]);
assert.deepEqual(data.scopeItems.map(item => item.billingHourlyRate),["25","42.5"]);
assert.deepEqual(data.scopeItems.map(item => item.apuPlanVersion),[3,9]);
assert.deepEqual(data.scopeItems.map(item => item.contractValue),["250","170"]);
const baseline = buildActivatedCommercialBaseline({ intakeId:"INTAKE-1",projectId:1,currency:"USD",
  contracts:data.commercial.contracts.map((contract: any) => ({
    profileId:contract.id,contractId:`CON-${contract.id}`,contractVersionId:`VER-${contract.id}`,
    contractNumber:contract.contractNumber,currency:"USD",
    items:data.scopeItems.filter(item => item.contractId === contract.id).map(item => ({
      stableLineId:item.id,displayName:item.name,projectCostNodeId:item.projectCostNodeId,
      budgetSnapshotLineId:item.budgetSnapshotLineId,quantity:item.plannedHours,unit:item.unit,
      unitRate:item.billingHourlyRate,contractValue:item.contractValue,apuPlanVersion:item.apuPlanVersion,
      workflowTemplate:"generic",
    })),
  })),workflowInstances:2,workItems:2,tasks:2,resourceAssignments:0 });
assert.equal(baseline.projectBudget.total,"420");
assert.equal(baseline.projectBudget.contractCount,2);
assert.deepEqual(baseline.contractItems.map(item => item.pricingSnapshot.apuPlanVersion),[3,9]);
assert.equal(baseline.contractItems.some(item => "pricingTemplateBinding" in item.pricingSnapshot),false);
assert.equal(jobIntakeCompletion(data,[]).totals.contractValue,"420");
console.log("company pricing-template Intake: two independent references preserve contract allocation and canonical APU rates/baseline PASS");
