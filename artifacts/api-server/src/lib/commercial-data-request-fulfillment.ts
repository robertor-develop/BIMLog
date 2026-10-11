import crypto from "node:crypto";
import {DATA_REQUEST_KINDS,type DataRequestKind} from "./commercial-support-case";

export const DATA_REQUEST_FULFILLMENT_STATES=["approved","partially_approved"] as const;
export type DataRequestFulfillmentState=typeof DATA_REQUEST_FULFILLMENT_STATES[number];
const forbidden=/(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]/i;
const reference=/^[A-Z0-9][A-Z0-9._\/-]{5,79}$/i;

export type DataRequestFulfillmentInput=Readonly<{kind:DataRequestKind;expectedState:DataRequestFulfillmentState;expectedUpdatedAt:Date;receiptReference:string;summary:string}>;
export function parseDataRequestFulfillment(value:unknown):DataRequestFulfillmentInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("DATA_REQUEST_FULFILLMENT_INVALID");
  const raw=value as Record<string,unknown>,kind=raw.kind,expectedState=raw.expectedState,expectedUpdatedAt=new Date(String(raw.expectedUpdatedAt??"")),receiptReference=String(raw.receiptReference??"").trim(),summary=String(raw.summary??"").trim().replace(/\r\n?/g,"\n");
  if(!DATA_REQUEST_KINDS.includes(kind as DataRequestKind)||!DATA_REQUEST_FULFILLMENT_STATES.includes(expectedState as DataRequestFulfillmentState)||!Number.isFinite(expectedUpdatedAt.getTime())||!reference.test(receiptReference)||summary.length<10||summary.length>2000||forbidden.test(summary))throw new Error("DATA_REQUEST_FULFILLMENT_INVALID");
  return Object.freeze({kind:kind as DataRequestKind,expectedState:expectedState as DataRequestFulfillmentState,expectedUpdatedAt,receiptReference,summary});
}
export const dataRequestFulfillmentFingerprint=(input:DataRequestFulfillmentInput)=>crypto.createHash("sha256").update(JSON.stringify({kind:input.kind,expectedState:input.expectedState,expectedUpdatedAt:input.expectedUpdatedAt.toISOString(),receiptReference:input.receiptReference,summary:input.summary})).digest("hex");
