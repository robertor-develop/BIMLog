const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;

export function verifyReleaseIdentity(receipt){
  const errors=[];
  if(receipt?.status!=="ok")errors.push("health-status");
  if(!SHA.test(receipt?.sourceCommit||""))errors.push("source-commit");
  if(!DIGEST.test(receipt?.assetManifestSha256||""))errors.push("asset-manifest");
  if(typeof receipt?.packageId!=="string"||!receipt.packageId.includes((receipt.sourceCommit||"").slice(0,16)))errors.push("package-source");
  if(receipt?.identityBound!==true)errors.push("identity-bound");
  return Object.freeze({pass:errors.length===0,errors:Object.freeze(errors)});
}

export function verifyCorrelatedAnswer(receipt){
  const errors=[];
  for(const field of ["requestId","conversationId","question","answer"]){
    if(typeof receipt?.[field]!=="string"||receipt[field].trim()==="")errors.push(field);
  }
  if(receipt?.status!=="completed")errors.push("answer-status");
  if(receipt?.requestId!==receipt?.correlatedRequestId)errors.push("request-correlation");
  if(receipt?.conversationId!==receipt?.correlatedConversationId)errors.push("conversation-correlation");
  if(receipt?.persistedAfterReload!==true)errors.push("answer-persistence");
  if(receipt?.answerKind!=="grounded")errors.push("answer-kind");
  return Object.freeze({pass:errors.length===0,errors:Object.freeze(errors)});
}

export function verifyAuthenticatedScope(receipt){
  const errors=[];
  if(receipt?.authenticated!==true)errors.push("authentication");
  for(const field of ["userId","tenantId"]){
    if(!Number.isInteger(receipt?.[field])||receipt[field]<=0)errors.push(field);
  }
  if(receipt?.membershipAuthorized!==true)errors.push("membership");
  if(receipt?.requestedTenantId!==receipt?.tenantId||receipt?.answeredTenantId!==receipt?.tenantId)errors.push("tenant-scope");
  if(receipt?.projectId!=null){
    if(!Number.isInteger(receipt.projectId)||receipt.projectId<=0)errors.push("projectId");
    if(receipt?.requestedProjectId!==receipt?.projectId||receipt?.answeredProjectId!==receipt?.projectId)errors.push("project-scope");
  }
  if(receipt?.crossTenantAccessDenied!==true)errors.push("cross-tenant-denial");
  return Object.freeze({pass:errors.length===0,errors:Object.freeze(errors)});
}

export function verifyAgentWorkspace(receipt){
  const errors=[];
  if(!["left","right"].includes(receipt?.dock))errors.push("dock");
  if(!Number.isFinite(receipt?.widthBefore)||!Number.isFinite(receipt?.widthAfter)||receipt.widthBefore===receipt.widthAfter)errors.push("resize");
  if(receipt?.widthAfter<360||receipt?.widthAfter>760)errors.push("resize-range");
  if(!Number.isFinite(receipt?.mainWorkspaceWidth)||receipt.mainWorkspaceWidth<320)errors.push("workspace-width");
  if(receipt?.contentClipped===true)errors.push("content-clipping");
  if(receipt?.feedbackEnabled!==false||receipt?.fixEnabled!==false)errors.push("coming-soon-actions");
  if(receipt?.feedbackHint!=="Coming soon"||receipt?.fixHint!=="Coming soon")errors.push("coming-soon-hint");
  if(receipt?.focusRestored!==true)errors.push("focus-restoration");
  return Object.freeze({pass:errors.length===0,errors:Object.freeze(errors)});
}
