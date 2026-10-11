import crypto from "node:crypto";

export const CUSTOMER_RESTRICTION_SCOPES=["nonessential_profile_processing","product_analytics","ai_assistance_context"] as const;
export type CustomerRestrictionScope=typeof CUSTOMER_RESTRICTION_SCOPES[number];
const forbidden=/(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]/i;
export type CustomerDataRestrictionInput=Readonly<{expectedUpdatedAt:Date;scopes:readonly CustomerRestrictionScope[];reason:string;receiptReference:string}>;

export function parseCustomerDataRestriction(value:unknown):CustomerDataRestrictionInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("DATA_RESTRICTION_INVALID");
  const raw=value as Record<string,unknown>,expectedUpdatedAt=new Date(String(raw.expectedUpdatedAt??"")),reason=String(raw.reason??"").trim().replace(/\r\n?/g,"\n"),receiptReference=String(raw.receiptReference??"").trim(),scopes=Array.isArray(raw.scopes)?[...new Set(raw.scopes)]:[];
  if(!Number.isFinite(expectedUpdatedAt.getTime())||scopes.length<1||scopes.length>CUSTOMER_RESTRICTION_SCOPES.length||scopes.some(scope=>typeof scope!=="string"||!CUSTOMER_RESTRICTION_SCOPES.includes(scope as CustomerRestrictionScope))||reason.length<10||reason.length>1000||forbidden.test(reason)||!/^[A-Z0-9][A-Z0-9._\/-]{5,79}$/i.test(receiptReference))throw new Error("DATA_RESTRICTION_INVALID");
  return Object.freeze({expectedUpdatedAt,scopes:Object.freeze((scopes as CustomerRestrictionScope[]).sort()),reason,receiptReference});
}
export const customerDataRestrictionFingerprint=(input:CustomerDataRestrictionInput,requesterUserId:number)=>crypto.createHash("sha256").update(JSON.stringify({expectedUpdatedAt:input.expectedUpdatedAt.toISOString(),requesterUserId,scopes:input.scopes,reason:input.reason,receiptReference:input.receiptReference})).digest("hex");
export const customerProcessingRestricted=(activeScopes:readonly string[],scope:CustomerRestrictionScope)=>activeScopes.includes(scope);
