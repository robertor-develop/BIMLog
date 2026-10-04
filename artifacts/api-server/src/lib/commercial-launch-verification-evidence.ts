import crypto from "node:crypto";
import type {CommercialLiveCheck} from "./commercial-stripe-live-verification";

export const commercialVerificationValidityMs=15*60*1000;
const SHA40=/^[0-9a-f]{40}$/;

export type CommercialLaunchVerificationEvidence=Readonly<{
  schemaVersion:"bimlog-commercial-verification-v1";
  sourceCommit:string;
  status:"verified"|"failed"|"configuration_blocked";
  verified:boolean;
  checkedAt:string;
  validUntil:string;
  checkCount:number;
  failedCheckIds:readonly string[];
  evidenceSha256:string;
}>;

export function buildCommercialVerificationEvidence(input:{sourceCommit:string;status:"verified"|"failed"|"configuration_blocked";verified:boolean;checks:readonly CommercialLiveCheck[];checkedAt:string}):CommercialLaunchVerificationEvidence{
  const sourceCommit=input.sourceCommit.toLowerCase(),checkedMs=Date.parse(input.checkedAt);
  if(!SHA40.test(sourceCommit)||!Number.isFinite(checkedMs))throw new Error("COMMERCIAL_VERIFICATION_IDENTITY_INVALID");
  if(input.verified!==(input.status==="verified")||(input.status==="configuration_blocked"&&input.checks.length))throw new Error("COMMERCIAL_VERIFICATION_STATE_INVALID");
  const failedCheckIds=Object.freeze(input.checks.filter(item=>item.status!=="verified").map(item=>item.id).sort());
  const body={schemaVersion:"bimlog-commercial-verification-v1" as const,sourceCommit,status:input.status,verified:input.verified,checkedAt:new Date(checkedMs).toISOString(),validUntil:new Date(checkedMs+commercialVerificationValidityMs).toISOString(),checkCount:input.checks.length,failedCheckIds};
  return Object.freeze({...body,evidenceSha256:crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex")});
}

export function commercialVerificationEvidenceIsCurrent(evidence:CommercialLaunchVerificationEvidence,now=new Date()):boolean{
  return evidence.verified&&Date.parse(evidence.checkedAt)<=now.getTime()&&now.getTime()<=Date.parse(evidence.validUntil);
}
