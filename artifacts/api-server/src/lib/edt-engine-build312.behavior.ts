import assert from "node:assert/strict";
import {validateEdtPlanNodes,type EdtPlanNode} from "./edt-engine-activation-service";

const root:EdtPlanNode={kind:"project",sourceIdentity:"p",code:"P",name:"Project",sequence:1,snapshot:{}};
const contract:EdtPlanNode={kind:"contract",sourceIdentity:"c",parentSourceIdentity:"p",code:"C",name:"Contract",sequence:1,snapshot:{}};
const deliverable:EdtPlanNode={kind:"deliverable",sourceIdentity:"d",parentSourceIdentity:"c",code:"D",name:"Deliverable",sequence:1,snapshot:{}};
const location:EdtPlanNode={kind:"location",sourceIdentity:"l",parentSourceIdentity:"d",code:"L",name:"Location",sequence:1,snapshot:{}};
assert.doesNotThrow(()=>validateEdtPlanNodes([root,contract,deliverable,location]));
for(const nodes of [[contract,root],[{...root,parentSourceIdentity:"c"},contract],[root,{...contract,parentSourceIdentity:"c"}],[root,{...deliverable,parentSourceIdentity:"p"}],[root,contract,{...contract,sourceIdentity:"c2"}],[root,contract,location,deliverable]]){
  assert.throws(()=>validateEdtPlanNodes(nodes as EdtPlanNode[]),(error:unknown)=>error instanceof Error&&"code" in error&&error.code==="EDT_PLAN_INCOMPLETE");
}
console.log("EDT_ENGINE_BUILD312_RESULT=PASS ordered acyclic EDT tree and sibling sequence validation");
