import assert from "node:assert/strict";
import {validateEdtPlanWorkItems,type EdtPlanNode,type EdtPlanWorkItem} from "./edt-engine-activation-service";

const nodes:EdtPlanNode[]=[{kind:"project",sourceIdentity:"p",code:"P",name:"Project",sequence:1,snapshot:{}},{kind:"contract",sourceIdentity:"c",parentSourceIdentity:"p",code:"C",name:"Contract",sequence:1,snapshot:{}},{kind:"deliverable",sourceIdentity:"d",parentSourceIdentity:"c",code:"D",name:"Deliverable",sequence:1,snapshot:{}},{kind:"location",sourceIdentity:"L1",parentSourceIdentity:"d",code:"L1",name:"Level 1",sequence:1,snapshot:{}}];
const item:EdtPlanWorkItem={id:"w1",edtNodeSourceIdentity:"L1",contractSourceIdentity:"c",locationIdentity:"L1",locationSnapshot:{},tradeIdentity:"HVAC",tradeSnapshot:{},deliverableTypeIdentity:"d",deliverableTypeSnapshot:{},displayCode:"P-HVAC-L1"};
assert.doesNotThrow(()=>validateEdtPlanWorkItems(nodes,[item]));
for(const items of [[],[item,item],[item,{...item,id:"w2"}],[{...item,locationIdentity:""}],[{...item,edtNodeSourceIdentity:"missing"}],[{...item,edtNodeSourceIdentity:"p"}]])
  assert.throws(()=>validateEdtPlanWorkItems(nodes,items),(error:unknown)=>error instanceof Error&&"code" in error&&error.code==="EDT_PLAN_INCOMPLETE");
console.log("EDT_ENGINE_BUILD313_RESULT=PASS duplicate and incomplete Work Items fail before mutation");
