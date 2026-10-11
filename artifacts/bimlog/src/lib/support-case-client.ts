export type DataRequestKind="export"|"correction"|"deletion"|"restriction";
export type DataRequestState="requested"|"under_review"|"approved"|"partially_approved"|"denied"|"fulfilled";
export type SupportCaseDto={
  id:number;category:"billing"|"account"|"technical"|"data"|"other";dataRequestKind:DataRequestKind|null;
  dataRequestState:DataRequestState|null;dataRequestReason:string|null;dataRequestReviewedAt:string|null;dataRequestFulfilledAt:string|null;
  priority:"normal"|"urgent";subject:string;status:"open"|"in_progress"|"resolved"|"closed";resolutionSummary:string|null;
  resolvedAt:string|null;unreadCount:number;latestMessageAt:string|null;createdAt:string;updatedAt:string;
};
const oneOf=<T extends string>(value:unknown,allowed:readonly T[]):T=>{if(typeof value!=="string"||!allowed.includes(value as T))throw new Error("Invalid support case response");return value as T;};
const optionalDate=(value:unknown)=>value===null?null:typeof value==="string"&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined;
export function parseSupportCases(value:unknown):SupportCaseDto[]{
  if(!value||typeof value!=="object"||Array.isArray(value)||!Array.isArray((value as Record<string,unknown>).items))throw new Error("Invalid support case response");
  const ids=new Set<number>();
  return ((value as Record<string,unknown>).items as unknown[]).map(raw=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Invalid support case response");
    const row=raw as Record<string,unknown>,id=Number(row.id),unreadCount=Number(row.unreadCount),latestMessageAt=optionalDate(row.latestMessageAt),resolutionSummary=row.resolutionSummary===null?null:typeof row.resolutionSummary==="string"&&row.resolutionSummary.trim().length>=10?row.resolutionSummary.trim():undefined,resolvedAt=optionalDate(row.resolvedAt),category=oneOf(row.category,["billing","account","technical","data","other"]),dataRequestKind=row.dataRequestKind==null?null:oneOf(row.dataRequestKind,["export","correction","deletion","restriction"]),dataRequestState=row.dataRequestState==null?null:oneOf(row.dataRequestState,["requested","under_review","approved","partially_approved","denied","fulfilled"]),dataRequestReason=row.dataRequestReason===null||row.dataRequestReason===undefined?null:typeof row.dataRequestReason==="string"&&row.dataRequestReason.trim().length>=10&&row.dataRequestReason.length<=2000?row.dataRequestReason.trim():undefined,dataRequestReviewedAt=optionalDate(row.dataRequestReviewedAt??null),dataRequestFulfilledAt=optionalDate(row.dataRequestFulfilledAt??null);
    const dataShapeValid=category==="data"?dataRequestKind!==null&&dataRequestState!==null:dataRequestKind===null&&dataRequestState===null&&dataRequestReason===null&&dataRequestReviewedAt===null&&dataRequestFulfilledAt===null;
    if(!Number.isSafeInteger(id)||id<1||ids.has(id)||typeof row.subject!=="string"||!row.subject.trim()||row.subject.length>160||!Number.isSafeInteger(unreadCount)||unreadCount<0||latestMessageAt===undefined||unreadCount>0&&latestMessageAt===null||resolutionSummary===undefined||resolvedAt===undefined||(resolutionSummary===null)!==(resolvedAt===null)||!dataShapeValid||dataRequestReason===undefined||dataRequestReviewedAt===undefined||dataRequestFulfilledAt===undefined||dataRequestState==="requested"&&(dataRequestReason!==null||dataRequestReviewedAt!==null||dataRequestFulfilledAt!==null)||dataRequestState==="fulfilled"&&dataRequestFulfilledAt===null||dataRequestState!=="fulfilled"&&dataRequestFulfilledAt!==null)throw new Error("Invalid support case response");
    ids.add(id);for(const field of ["createdAt","updatedAt"]){if(typeof row[field]!=="string"||!Number.isFinite(Date.parse(row[field] as string)))throw new Error("Invalid support case response");}
    return {id,category,dataRequestKind,dataRequestState,dataRequestReason,dataRequestReviewedAt,dataRequestFulfilledAt,priority:oneOf(row.priority,["normal","urgent"]),subject:row.subject.trim(),status:oneOf(row.status,["open","in_progress","resolved","closed"]),resolutionSummary,resolvedAt,unreadCount,latestMessageAt,createdAt:row.createdAt as string,updatedAt:row.updatedAt as string};
  });
}
export const newSupportRequestKey=()=>`support_${crypto.randomUUID().replace(/-/g,"")}`;
