import assert from "node:assert/strict";
import {verifyCorrelatedAnswer} from "./lib/hosted-agent-live-acceptance.mjs";

const valid={requestId:"req-31",correlatedRequestId:"req-31",conversationId:"conv-9",correlatedConversationId:"conv-9",question:"What page am I viewing?",answer:"BIMLog Headquarters",status:"completed",persistedAfterReload:true,answerKind:"grounded"};
assert.deepEqual(verifyCorrelatedAnswer(valid),{pass:true,errors:[]});
for(const patch of [
  {correlatedRequestId:"req-other"},
  {correlatedConversationId:"conv-other"},
  {answer:""},
  {status:"queued"},
  {persistedAfterReload:false},
  {answerKind:"acknowledgement"},
]) assert.equal(verifyCorrelatedAnswer({...valid,...patch}).pass,false);
console.log("CORRECTIVE-B32 hosted Agent correlated answer: PASS");
