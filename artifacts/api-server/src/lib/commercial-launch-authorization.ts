import type {StoredCommercialVerification} from "./commercial-launch-verification-store";

export type CommercialLaunchAuthorizationStatus="current"|"missing"|"source_mismatch"|"expired"|"not_verified";
export type CommercialLaunchAuthorization=Readonly<{status:CommercialLaunchAuthorizationStatus;ready:boolean;sourceCommit:string;receipt:StoredCommercialVerification|null;evaluatedAt:string}>;

const SHA40=/^[0-9a-f]{40}$/;

export function deriveCommercialLaunchAuthorization(input:{sourceCommit:string;receipt:StoredCommercialVerification|null;now?:Date}):CommercialLaunchAuthorization{
  const sourceCommit=input.sourceCommit.toLowerCase(),now=input.now??new Date(),at=now.getTime();
  if(!SHA40.test(sourceCommit)||!Number.isFinite(at))throw new Error("COMMERCIAL_LAUNCH_AUTHORIZATION_IDENTITY_INVALID");
  const base={sourceCommit,receipt:input.receipt,evaluatedAt:now.toISOString()};
  if(!input.receipt)return Object.freeze({...base,status:"missing" as const,ready:false});
  if(input.receipt.sourceCommit!==sourceCommit)return Object.freeze({...base,status:"source_mismatch" as const,ready:false});
  if(!input.receipt.verified||input.receipt.status!=="verified")return Object.freeze({...base,status:"not_verified" as const,ready:false});
  const checkedAt=Date.parse(input.receipt.checkedAt),validUntil=Date.parse(input.receipt.validUntil);
  if(!Number.isFinite(checkedAt)||!Number.isFinite(validUntil)||checkedAt>at||validUntil<=at||validUntil<=checkedAt)return Object.freeze({...base,status:"expired" as const,ready:false});
  return Object.freeze({...base,status:"current" as const,ready:true});
}
