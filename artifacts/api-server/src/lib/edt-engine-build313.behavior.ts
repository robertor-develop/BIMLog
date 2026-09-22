import assert from "node:assert/strict";
import {validateEdtPlanWorkItems,type EdtPlanNode,type EdtPlanWorkItem} from "./edt-engine-activation-service";

const nodes:EdtPlanNode[]=[{kind:"project",sourceIdentity:"p",code:"P",name:"Project",sequence:1,snapshot:{}}];
const item:EdtPlanWorkItem={id:"w1",edtNodeSourceIdentity:"p",locationIdentity:"L1",locationSnapshot:{},tradeIdentity:"HVAC",tradeSnapshot:{},deliverableTypeIdentity:"MODEL",deliverableTypeSnapshot:{},displayCode:"P-HVAC-L1"};
assert.doesNotThrow(()=>validateEdtPlanWorkItems(nodes,[item]));
for(const items of [[],[item,item],[item,{...item,id:"w2"}],[{...item,locationIdentity:""}],[{...item,edtNodeSourceIdentity:"missing"}]])
  assert.throws(()=>validateEdtPlanWorkItems(nodes,items),(error:unknown)=>error instanceof Error&&"code" in error&&error.code==="EDT_PLAN_INCOMPLETE");
console.log("EDT_ENGINE_BUILD313_RESULT=PASS duplicate and incomplete Work Items fail before mutation");
