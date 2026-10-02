export const SALES_INQUIRY_NEXT_ACTION_TYPES=["call","demo","email","proposal"] as const;
export type SalesInquiryNextActionType=typeof SALES_INQUIRY_NEXT_ACTION_TYPES[number];
export type SalesInquiryNextActionInput=Readonly<{type:SalesInquiryNextActionType;dueAt:Date;expectedUpdatedAt:Date}>;

export function parseSalesInquiryNextAction(value:unknown,now=new Date()):SalesInquiryNextActionInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SALES_INQUIRY_NEXT_ACTION_INVALID");
  const row=value as Record<string,unknown>;
  if(typeof row.type!=="string"||typeof row.dueAt!=="string"||typeof row.expectedUpdatedAt!=="string")throw new Error("SALES_INQUIRY_NEXT_ACTION_INVALID");
  if(!SALES_INQUIRY_NEXT_ACTION_TYPES.includes(row.type as SalesInquiryNextActionType))throw new Error("SALES_INQUIRY_NEXT_ACTION_INVALID");
  const dueAt=new Date(row.dueAt),expectedUpdatedAt=new Date(row.expectedUpdatedAt);
  if(Number.isNaN(dueAt.getTime())||dueAt.toISOString()!==row.dueAt||Number.isNaN(expectedUpdatedAt.getTime())||expectedUpdatedAt.toISOString()!==row.expectedUpdatedAt)throw new Error("SALES_INQUIRY_NEXT_ACTION_INVALID");
  if(dueAt.getTime()<now.getTime()-60_000||dueAt.getTime()>now.getTime()+366*24*60*60*1000)throw new Error("SALES_INQUIRY_NEXT_ACTION_INVALID");
  return Object.freeze({type:row.type as SalesInquiryNextActionType,dueAt,expectedUpdatedAt});
}
