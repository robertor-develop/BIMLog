import assert from "node:assert/strict";
import { makeEdtWorkItemCode, validateEdtPlanWorkItems, type EdtPlanNode, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const nodes: EdtPlanNode[] = [
  {kind:"project",sourceIdentity:"project-1",code:"P1",name:"Project",sequence:1,snapshot:{}},
  {kind:"contract",sourceIdentity:"contract-1",parentSourceIdentity:"project-1",code:"C1",name:"Contract",sequence:1,snapshot:{}},
  {kind:"deliverable",sourceIdentity:"sleeve",parentSourceIdentity:"contract-1",code:"SLV",name:"Sleeve",sequence:1,snapshot:{}},
  {kind:"location",sourceIdentity:"floor-1",parentSourceIdentity:"sleeve",code:"L1",name:"Floor 1",sequence:1,snapshot:{}},
];
const tradeIdentity="9f6f386e-6cb8-4ca3-91f6-623269941399";
const displayCode=makeEdtWorkItemCode({project:nodes[0],contract:nodes[1],deliverable:nodes[2],location:nodes[3],tradeIdentity,tradeCode:"HVAC"});
assert.match(displayCode,/^WI-P1-C1-SLV-L1-HVAC-[A-F0-9]{10}$/);
assert.notEqual(displayCode,makeEdtWorkItemCode({project:nodes[0],contract:nodes[1],deliverable:nodes[2],location:nodes[3],tradeIdentity:"different-permanent-id",tradeCode:"HVAC"}));
const item:EdtPlanWorkItem={id:"work-item-1",edtNodeSourceIdentity:"floor-1",contractSourceIdentity:"contract-1",locationIdentity:"floor-1",locationSnapshot:{},tradeIdentity,tradeSnapshot:{code:"HVAC"},deliverableTypeIdentity:"sleeve",deliverableTypeSnapshot:{},displayCode};
assert.doesNotThrow(()=>validateEdtPlanWorkItems(nodes,[item]));
assert.throws(()=>validateEdtPlanWorkItems(nodes,[{...item,tradeSnapshot:{code:"ELEC"}}]),(error:unknown)=>error instanceof Error&&"code" in error&&error.code==="EDT_CODE_INVALID");
console.log("EDT_ENGINE_BUILD322_RESULT=PASS permanent trade IDs and readable codes remain distinct");
