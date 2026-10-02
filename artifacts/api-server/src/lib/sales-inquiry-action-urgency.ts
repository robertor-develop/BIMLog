export const SALES_INQUIRY_ACTION_SCOPES=["overdue","today","upcoming","unscheduled"] as const;
export type SalesInquiryActionScope=typeof SALES_INQUIRY_ACTION_SCOPES[number];
export type SalesInquiryActionUrgency="overdue"|"today"|"upcoming"|"unscheduled"|"closed";

export function salesInquiryActionUrgency(status:string,dueAt:Date|null,now=new Date()):SalesInquiryActionUrgency{
  if(status==="closed")return "closed";
  if(!dueAt)return "unscheduled";
  if(Number.isNaN(dueAt.getTime()))throw new Error("SALES_INQUIRY_ACTION_DUE_INVALID");
  if(dueAt.getTime()<now.getTime())return "overdue";
  const endOfToday=new Date(now);endOfToday.setHours(23,59,59,999);
  return dueAt.getTime()<=endOfToday.getTime()?"today":"upcoming";
}
