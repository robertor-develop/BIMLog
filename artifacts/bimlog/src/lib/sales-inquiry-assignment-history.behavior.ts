import assert from "node:assert/strict";
import {parseSalesInquiryAssignmentHistory} from "./sales-inquiry-client";
const event={id:1,action:"assigned",actorUserId:4,actorName:"Roberto",previousAssigneeUserId:null,previousAssigneeName:null,nextAssigneeUserId:4,nextAssigneeName:"Roberto",createdAt:"2026-10-02T12:00:00.000Z"};
assert.equal(parseSalesInquiryAssignmentHistory({items:[event],limit:25,offset:0,total:1}).items[0]?.actorName,"Roberto");
assert.throws(()=>parseSalesInquiryAssignmentHistory({items:[{...event,action:"released"}],limit:25,offset:0,total:1}),/Invalid assignment event/);
assert.throws(()=>parseSalesInquiryAssignmentHistory({items:[event,{...event}],limit:25,offset:0,total:2}),/Contradictory/);
console.log("B122 strict assignment history browser contract: PASS");
