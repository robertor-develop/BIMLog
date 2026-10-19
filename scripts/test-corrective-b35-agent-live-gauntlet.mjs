import assert from "node:assert/strict";
import {verifyHostedAgentAcceptance} from "./lib/hosted-agent-live-acceptance.mjs";

const source="7".repeat(40),digest="c".repeat(64);
const receipt={
  release:{status:"ok",sourceCommit:source,assetManifestSha256:digest,packageId:`bimlog-${source.slice(0,16)}-${digest.slice(0,16)}`,identityBound:true},
  answer:{requestId:"req-31",correlatedRequestId:"req-31",conversationId:"conv-9",correlatedConversationId:"conv-9",question:"What page am I viewing?",answer:"BIMLog Headquarters",status:"completed",persistedAfterReload:true,answerKind:"grounded"},
  scope:{authenticated:true,userId:17,tenantId:4,requestedTenantId:4,answeredTenantId:4,projectId:null,requestedProjectId:null,answeredProjectId:null,membershipAuthorized:true,crossTenantAccessDenied:true},
  workspace:{dock:"right",widthBefore:443,widthAfter:503,mainWorkspaceWidth:812,contentClipped:false,feedbackEnabled:false,fixEnabled:false,feedbackHint:"Coming soon",fixHint:"Coming soon",focusRestored:true},
};
assert.equal(verifyHostedAgentAcceptance(receipt).pass,true);
for(const [gate,patch] of [
  ["release",{identityBound:false}],
  ["answer",{correlatedRequestId:"wrong"}],
  ["scope",{answeredTenantId:99}],
  ["workspace",{contentClipped:true}],
]){
  const result=verifyHostedAgentAcceptance({...receipt,[gate]:{...receipt[gate],...patch}});
  assert.equal(result.pass,false);
  assert.deepEqual(result.failed,[gate]);
}
console.log("CORRECTIVE-B35 hosted Agent live gauntlet: PASS");
