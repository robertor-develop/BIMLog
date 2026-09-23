import assert from "node:assert/strict";
import { projectActivatedEdtPlan } from "./edt-engine-plan-projection";
import type { ActivatedEdtSource } from "./edt-engine-source-service";

const source:ActivatedEdtSource={project:{id:11,code:"P11",name:"Project 11"},
  intake:{id:"intake-1",revision:4,data:{commercial:{contracts:[{id:"profile-1",contractNumber:"C1",title:"Contract 1"}]},
    scopeItems:[{id:"scope-1",contractId:"profile-1",deliverableType:"SLEEVE",workPackages:[{id:"wp-1",dimensionType:"floor",dimensionValue:"L2",classification:{disciplineId:"trade-uuid-1",disciplineCode:"HVAC",disciplineName:"Mechanical"}}]}]},
    activationSummary:{contracts:[{profileId:"profile-1",contractId:"contract-1",contractVersionId:"version-1"}]}},
  workItems:[{id:"wi-1",stableScopeItemId:"scope-1",contractId:"contract-1",contractVersionId:"version-1",status:"active"}]};
const plan=projectActivatedEdtPlan(source);
assert.deepEqual(plan.nodes.map(node=>node.kind),["project","contract","deliverable","location"]);
assert.equal(plan.workItems[0].contractSourceIdentity,"contract-1");
assert.equal(plan.workItems[0].tradeIdentity,"trade-uuid-1");
assert.match(plan.workItems[0].displayCode,/^WI-P11-C1-SLEEVE-L2-HVAC-[A-F0-9]{10}$/);
assert.equal(plan.sourceFingerprint,projectActivatedEdtPlan(source).sourceFingerprint);
const invalid={...source,workItems:[{...source.workItems[0],contractId:"other-contract"}]};
assert.throws(()=>projectActivatedEdtPlan(invalid),(error:unknown)=>error instanceof Error&&"code" in error&&error.code==="EDT_SOURCE_AMBIGUOUS");
console.log("EDT_ENGINE_BUILD323_RESULT=PASS canonical activated Intake projects a deterministic EDT hierarchy");
