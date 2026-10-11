import crypto from "node:crypto";
import {DATA_REQUEST_KINDS,type DataRequestKind} from "./commercial-support-case";

export const DATA_REQUEST_REVIEW_STATES=["requested","under_review","approved","partially_approved","denied","fulfilled"] as const;
export type DataRequestReviewState=typeof DATA_REQUEST_REVIEW_STATES[number];
const transitions:Record<DataRequestReviewState,readonly DataRequestReviewState[]>={requested:["under_review"],under_review:["approved","partially_approved","denied"],approved:["fulfilled"],partially_approved:["fulfilled"],denied:[],fulfilled:[]};
const forbidden=/(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]/i;

export type DataRequestReviewInput=Readonly<{kind:DataRequestKind;expectedState:DataRequestReviewState;state:DataRequestReviewState;expectedUpdatedAt:Date;reason:string}>;
export function parseDataRequestReview(value:unknown):DataRequestReviewInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("DATA_REQUEST_REVIEW_INVALID");
  const raw=value as Record<string,unknown>,kind=raw.kind,expectedState=raw.expectedState,state=raw.state,expectedUpdatedAt=new Date(String(raw.expectedUpdatedAt??"")),reason=String(raw.reason??"").trim().replace(/\r\n?/g,"\n");
  if(!DATA_REQUEST_KINDS.includes(kind as DataRequestKind)||!DATA_REQUEST_REVIEW_STATES.includes(expectedState as DataRequestReviewState)||!DATA_REQUEST_REVIEW_STATES.includes(state as DataRequestReviewState)||!Number.isFinite(expectedUpdatedAt.getTime())||!transitions[expectedState as DataRequestReviewState].includes(state as DataRequestReviewState)||reason.length<10||reason.length>2000||forbidden.test(reason))throw new Error("DATA_REQUEST_REVIEW_INVALID");
  return Object.freeze({kind:kind as DataRequestKind,expectedState:expectedState as DataRequestReviewState,state:state as DataRequestReviewState,expectedUpdatedAt,reason});
}
export const dataRequestReviewFingerprint=(input:DataRequestReviewInput)=>crypto.createHash("sha256").update(JSON.stringify({kind:input.kind,expectedState:input.expectedState,state:input.state,expectedUpdatedAt:input.expectedUpdatedAt.toISOString(),reason:input.reason})).digest("hex");
