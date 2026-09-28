import crypto from "node:crypto";
export type CompanyReuseSource={sourceCompanyId:number;sourceProjectId:number;lessonId:string;lessonRevision:number;status:"approved"|"retired";shareScope:"company"|"project_only";title:string;guidance:string;confidentialProjectFields:Readonly<Record<string,unknown>>};
export function prepareCompanyKnowledgeReuse(input:{targetCompanyId:number;actorCompanyId:number;canApproveCompanyKnowledge:boolean;source:CompanyReuseSource;existingSourceRevisionKeys:readonly string[]}){
  if(input.actorCompanyId!==input.targetCompanyId||!input.canApproveCompanyKnowledge)throw new Error("Company knowledge reuse is not authorized.");
  if(input.source.sourceCompanyId!==input.targetCompanyId||input.source.shareScope!=="company"||input.source.status!=="approved")throw new Error("Lesson is not approved for company reuse.");
  const sourceRevisionKey=`${input.source.lessonId}:r${input.source.lessonRevision}`;const reusedId=crypto.createHash("sha256").update(`${input.targetCompanyId}:${sourceRevisionKey}`).digest("hex");
  return Object.freeze({reusedId,sourceRevisionKey,status:"draft" as const,approvalRequired:true,alreadyPrepared:input.existingSourceRevisionKeys.includes(sourceRevisionKey),content:Object.freeze({title:input.source.title,guidance:input.source.guidance}),copiedConfidentialFields:[] as string[]});
}
