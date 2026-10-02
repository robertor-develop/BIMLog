export type SupportPriority="normal"|"urgent";

export function supportResponseDueAt(openedAt:Date,priority:SupportPriority):Date{
  if(!(openedAt instanceof Date)||Number.isNaN(openedAt.getTime()))throw new Error("SUPPORT_CASE_OPENED_AT_INVALID");
  if(priority==="urgent")return new Date(openedAt.getTime()+4*60*60*1000);
  if(priority!=="normal")throw new Error("SUPPORT_CASE_PRIORITY_INVALID");
  const due=new Date(openedAt);
  do{due.setUTCDate(due.getUTCDate()+1);}while(due.getUTCDay()===0||due.getUTCDay()===6);
  return due;
}

export function supportResponseIsOverdue(input:{status:string;responseDueAt:Date|null;now?:Date}):boolean{
  if(input.status==="resolved"||input.status==="closed")return false;
  if(!input.responseDueAt||Number.isNaN(input.responseDueAt.getTime()))return false;
  return input.responseDueAt.getTime()<(input.now??new Date()).getTime();
}
