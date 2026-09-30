import assert from "node:assert/strict";
import { governedDeliveryState } from "./shop-drawing-delivery";
const runtime={status:"active",phaseIndex:2,definition:{phases:[{id:"prepare",name:"Prepare"},{id:"review",name:"Published review",qcRequired:true}]},steps:[{phaseId:"review",status:"complete"}]};
assert.deepEqual(governedDeliveryState(runtime),{state:"active",phaseId:"review",phaseName:"Published review",completed:1,total:1,nextAction:"review"});
runtime.definition.phases[1]!.name="Company issue gate";
assert.equal(governedDeliveryState(runtime).phaseName,"Company issue gate");
console.log("UX143_RESULT=PASS delivery state and next action project the bound published workflow rather than a parallel status-code list");
