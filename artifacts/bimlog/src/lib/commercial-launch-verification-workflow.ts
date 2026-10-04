import {evaluateCommercialVerificationEvidence,parseCommercialHealthIdentity,parseCommercialLiveVerification,type CommercialEvidenceDecision,type CommercialHealthIdentityDto,type CommercialLiveVerificationDto} from "./commercial-launch-client";

export type CommercialVerificationWorkflowResult={identity:CommercialHealthIdentityDto;live:CommercialLiveVerificationDto;decision:CommercialEvidenceDecision};
type FetchLike=(input:string,init?:RequestInit)=>Promise<Response>;

async function json(response:Response,label:string){const body=await response.json().catch(()=>({}));if(!response.ok){const message=body&&typeof body==="object"&&"error" in body&&typeof body.error==="string"?body.error:`${label} unavailable`;throw new Error(message);}return body;}

export async function verifyCommercialLaunchForLiveSource({apiBase="",token,fetchImpl=fetch,now=new Date()}:{apiBase?:string;token:string;fetchImpl?:FetchLike;now?:Date}):Promise<CommercialVerificationWorkflowResult>{
  const before=parseCommercialHealthIdentity(await json(await fetchImpl(`${apiBase}/api/v1/healthz`,{cache:"no-store"}),"Live release identity"));
  const live=parseCommercialLiveVerification(await json(await fetchImpl(`${apiBase}/api/v1/admin/commercial-launch/verify`,{method:"POST",headers:{Authorization:`Bearer ${token}`}}),"Live verification"));
  const after=parseCommercialHealthIdentity(await json(await fetchImpl(`${apiBase}/api/v1/healthz`,{cache:"no-store"}),"Live release identity"));
  if(before.sourceCommit!==after.sourceCommit||before.identityFingerprint!==after.identityFingerprint)throw new Error("The live release changed during verification. Run verification again.");
  return {identity:after,live,decision:evaluateCommercialVerificationEvidence(live,after.sourceCommit,now)};
}
