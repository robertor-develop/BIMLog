import crypto from "node:crypto";

export const CUSTOMER_CORRECTION_FIELDS=["fullName","jobTitle","phone"] as const;
export type CustomerCorrectionField=typeof CUSTOMER_CORRECTION_FIELDS[number];
const forbidden=/(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]/i;

export type CustomerDataCorrectionInput=Readonly<{expectedUpdatedAt:Date;field:CustomerCorrectionField;value:string;reason:string;receiptReference:string}>;
export function parseCustomerDataCorrection(value:unknown):CustomerDataCorrectionInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("DATA_CORRECTION_INVALID");
  const raw=value as Record<string,unknown>,field=raw.field,expectedUpdatedAt=new Date(String(raw.expectedUpdatedAt??"")),replacement=String(raw.value??"").trim(),reason=String(raw.reason??"").trim().replace(/\r\n?/g,"\n"),receiptReference=String(raw.receiptReference??"").trim();
  if(!CUSTOMER_CORRECTION_FIELDS.includes(field as CustomerCorrectionField)||!Number.isFinite(expectedUpdatedAt.getTime())||replacement.length<1||replacement.length>200||reason.length<10||reason.length>1000||forbidden.test(reason)||!/^[A-Z0-9][A-Z0-9._\/-]{5,79}$/i.test(receiptReference))throw new Error("DATA_CORRECTION_INVALID");
  return Object.freeze({expectedUpdatedAt,field:field as CustomerCorrectionField,value:replacement,reason,receiptReference});
}
export const customerDataCorrectionFingerprint=(input:CustomerDataCorrectionInput,before:string|null)=>crypto.createHash("sha256").update(JSON.stringify({expectedUpdatedAt:input.expectedUpdatedAt.toISOString(),field:input.field,before,after:input.value,reason:input.reason,receiptReference:input.receiptReference})).digest("hex");
