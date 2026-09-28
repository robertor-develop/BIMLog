import crypto from "node:crypto";

export type ResolvedWorkflowReference={companyId:number;projectId:number;sourceType:"lens_issue"|"rfi"|"submittal"|"field_record";sourceId:string;sourceRevision:string;resolutionStatus:"resolved"|"verified";evidenceIds:readonly string[]};
export function linkResolvedWorkflowToLessonProposal(input:{companyId:number;projectId:number;proposalId:string;proposalStatus:"proposed"|"under_review";source:ResolvedWorkflowReference;existingSourceKeys:readonly string[]}){
  if(input.source.companyId!==input.companyId||input.source.projectId!==input.projectId)throw new Error("Lesson proposal source scope mismatch.");
  if(input.source.resolutionStatus!=="resolved"&&input.source.resolutionStatus!=="verified")throw new Error("Only resolved workflows can become lesson proposals.");
  if(!input.source.evidenceIds.length)throw new Error("Lesson proposal requires linked evidence.");
  const sourceKey=[input.source.sourceType,input.source.sourceId,input.source.sourceRevision].join(":");
  if(input.existingSourceKeys.includes(sourceKey))return Object.freeze({proposalId:input.proposalId,sourceKey,disposition:"already_linked" as const,published:false,sourceClosureChanged:false,evidenceIds:[...new Set(input.source.evidenceIds)].sort()});
  const linkId=crypto.createHash("sha256").update(`${input.companyId}:${input.projectId}:${input.proposalId}:${sourceKey}`).digest("hex");
  return Object.freeze({proposalId:input.proposalId,linkId,sourceKey,disposition:"linked" as const,published:false,sourceClosureChanged:false,evidenceIds:[...new Set(input.source.evidenceIds)].sort()});
}
