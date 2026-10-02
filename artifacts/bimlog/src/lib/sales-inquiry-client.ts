export const SALES_INQUIRY_STATUSES = ["new", "acknowledged", "qualified", "closed"] as const;
export type SalesInquiryStatus = (typeof SALES_INQUIRY_STATUSES)[number];
export const SALES_INQUIRY_NEXT_ACTION_TYPES=["call","demo","email","proposal"] as const;
export type SalesInquiryNextActionType=(typeof SALES_INQUIRY_NEXT_ACTION_TYPES)[number];
export type SalesInquiry = Readonly<{ id:number; fullName:string; email:string; companyName:string; country:string; interest:string; message:string; plan:string|null; billingCycle:string|null; useCase:string|null; status:SalesInquiryStatus; responseDueAt:string; assignedToUserId:number|null; assignedToName:string|null; assignedToCurrentUser:boolean; assignedAt:string|null; nextActionType:SalesInquiryNextActionType|null; nextActionDueAt:string|null; createdAt:string; updatedAt:string }>;
const text=(value:unknown,field:string,max=4000)=>{if(typeof value!=="string"||!value.trim()||value.length>max)throw new Error(`Invalid sales inquiry ${field}`);return value;};
const optional=(value:unknown,field:string)=>value==null?null:text(value,field,160);
export function parseSalesInquiry(value:unknown):SalesInquiry{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid sales inquiry");
  const row=value as Record<string,unknown>,id=Number(row.id);
  if(!Number.isSafeInteger(id)||id<1)throw new Error("Invalid sales inquiry id");
  if(!SALES_INQUIRY_STATUSES.includes(row.status as SalesInquiryStatus))throw new Error("Invalid sales inquiry status");
  const createdAt=text(row.createdAt,"createdAt",80),updatedAt=text(row.updatedAt,"updatedAt",80),responseDueAt=text(row.responseDueAt,"responseDueAt",80);
  const assignedToUserId=row.assignedToUserId===null?null:Number(row.assignedToUserId),assignedAt=row.assignedAt===null?null:text(row.assignedAt,"assignedAt",80),assignedToName=row.assignedToName===null?null:text(row.assignedToName,"assignedToName",160),assignedToCurrentUser=row.assignedToCurrentUser;
  const nextActionType=row.nextActionType===null?null:row.nextActionType,nextActionDueAt=row.nextActionDueAt===null?null:text(row.nextActionDueAt,"nextActionDueAt",80);
  if(typeof assignedToCurrentUser!=="boolean"||Number.isNaN(Date.parse(createdAt))||Number.isNaN(Date.parse(updatedAt))||Number.isNaN(Date.parse(responseDueAt))||(assignedAt!==null&&Number.isNaN(Date.parse(assignedAt)))||(assignedToUserId!==null&&(!Number.isSafeInteger(assignedToUserId)||assignedToUserId<1))||(assignedToUserId===null)!==(assignedAt===null)||(assignedToUserId===null)!==(assignedToName===null)||(assignedToCurrentUser&&assignedToUserId===null)||(nextActionType===null)!==(nextActionDueAt===null)||(nextActionType!==null&&!SALES_INQUIRY_NEXT_ACTION_TYPES.includes(nextActionType as SalesInquiryNextActionType))||(nextActionDueAt!==null&&Number.isNaN(Date.parse(nextActionDueAt))))throw new Error("Invalid sales inquiry accountability");
  return Object.freeze({id,fullName:text(row.fullName,"fullName",120),email:text(row.email,"email",254),companyName:text(row.companyName,"companyName",160),country:text(row.country,"country",100),interest:text(row.interest,"interest",160),message:text(row.message,"message"),plan:optional(row.plan,"plan"),billingCycle:optional(row.billingCycle,"billingCycle"),useCase:optional(row.useCase,"useCase"),status:row.status as SalesInquiryStatus,responseDueAt,assignedToUserId,assignedToName,assignedToCurrentUser,assignedAt,nextActionType:nextActionType as SalesInquiryNextActionType|null,nextActionDueAt,createdAt,updatedAt});
}
export type SalesInquiryPage=Readonly<{items:SalesInquiry[];limit:number;offset:number;total:number}>;
export function parseSalesInquiryList(value:unknown):SalesInquiryPage{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid sales inquiry response");
  const payload=value as Record<string,unknown>;if(!Array.isArray(payload.items))throw new Error("Invalid sales inquiry items");
  const limit=Number(payload.limit),offset=Number(payload.offset),total=Number(payload.total);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error("Invalid sales inquiry limit");
  if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new Error("Invalid sales inquiry offset");
  if(!Number.isSafeInteger(total)||total<0||total>10_000_000)throw new Error("Invalid sales inquiry total");
  const items=payload.items.map(parseSalesInquiry);if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error("Duplicate sales inquiry id");
  if(items.length>limit||offset+items.length>Math.max(total,offset))throw new Error("Contradictory sales inquiry page");
  return Object.freeze({items,limit,offset,total});
}

export type SalesInquiryAssignmentEvent=Readonly<{id:number;action:"assigned"|"released";actorUserId:number;actorName:string;previousAssigneeUserId:number|null;previousAssigneeName:string|null;nextAssigneeUserId:number|null;nextAssigneeName:string|null;createdAt:string}>;
export type SalesInquiryAssignmentHistoryPage=Readonly<{items:SalesInquiryAssignmentEvent[];limit:number;offset:number;total:number}>;
export function parseSalesInquiryAssignmentHistory(value:unknown):SalesInquiryAssignmentHistoryPage{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid assignment history response");
  const payload=value as Record<string,unknown>;if(!Array.isArray(payload.items))throw new Error("Invalid assignment history items");
  const limit=Number(payload.limit),offset=Number(payload.offset),total=Number(payload.total);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>1_000_000||!Number.isSafeInteger(total)||total<0)throw new Error("Invalid assignment history page");
  const items=payload.items.map(raw=>{if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Invalid assignment event");const row=raw as Record<string,unknown>,id=Number(row.id),actorUserId=Number(row.actorUserId),action=row.action,createdAt=text(row.createdAt,"createdAt",80),actorName=text(row.actorName,"actorName",160);const optionalId=(v:unknown)=>v===null?null:Number(v),optionalName=(v:unknown)=>v===null?null:text(v,"ownerName",160),previousAssigneeUserId=optionalId(row.previousAssigneeUserId),nextAssigneeUserId=optionalId(row.nextAssigneeUserId),previousAssigneeName=optionalName(row.previousAssigneeName),nextAssigneeName=optionalName(row.nextAssigneeName);if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(actorUserId)||actorUserId<1||(action!=="assigned"&&action!=="released")||Number.isNaN(Date.parse(createdAt))||(previousAssigneeUserId===null)!==(previousAssigneeName===null)||(nextAssigneeUserId===null)!==(nextAssigneeName===null)||(action==="assigned"&&nextAssigneeUserId===null)||(action==="released"&&nextAssigneeUserId!==null))throw new Error("Invalid assignment event");return Object.freeze({id,action,actorUserId,actorName,previousAssigneeUserId,previousAssigneeName,nextAssigneeUserId,nextAssigneeName,createdAt})});
  if(items.length>limit||offset+items.length>Math.max(total,offset)||new Set(items.map(item=>item.id)).size!==items.length)throw new Error("Contradictory assignment history page");
  return Object.freeze({items,limit,offset,total});
}
export type SalesInquiryFollowUp=Readonly<{id:number;actorUserId:number;actorName:string;note:string;createdAt:string}>;
export function parseSalesInquiryFollowUps(value:unknown):Readonly<{items:SalesInquiryFollowUp[];limit:number;offset:number;total:number}>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid follow-up response");const payload=value as Record<string,unknown>;if(!Array.isArray(payload.items))throw new Error("Invalid follow-up items");const limit=Number(payload.limit),offset=Number(payload.offset),total=Number(payload.total);if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(total)||total<0)throw new Error("Invalid follow-up page");const items=payload.items.map(raw=>{if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Invalid follow-up");const row=raw as Record<string,unknown>,id=Number(row.id),actorUserId=Number(row.actorUserId),createdAt=text(row.createdAt,"createdAt",80);if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(actorUserId)||actorUserId<1||Number.isNaN(Date.parse(createdAt)))throw new Error("Invalid follow-up");return Object.freeze({id,actorUserId,actorName:text(row.actorName,"actorName",160),note:text(row.note,"note",4000),createdAt});});if(items.length>limit||offset+items.length>Math.max(total,offset)||new Set(items.map(item=>item.id)).size!==items.length)throw new Error("Contradictory follow-up page");return Object.freeze({items,limit,offset,total});
}
