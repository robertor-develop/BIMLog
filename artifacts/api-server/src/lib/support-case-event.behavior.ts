import assert from "node:assert/strict";import {supportCaseEvent} from "./support-case-event";
assert.deepEqual(supportCaseEvent({type:"opened",actorUserId:7,toValue:"open"}),{eventType:"opened",actorUserId:7,fromValue:null,toValue:"open"});
assert.deepEqual(supportCaseEvent({type:"assigned",actorUserId:8,toValue:"8"}).toValue,"8");
assert.throws(()=>supportCaseEvent({type:"status_changed",actorUserId:8,fromValue:"open",toValue:"open"}));
console.log("B181 governed support event contracts: PASS");
