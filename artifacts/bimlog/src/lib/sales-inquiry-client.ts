export const SALES_INQUIRY_STATUSES = ["new", "acknowledged", "qualified", "closed"] as const;
export type SalesInquiryStatus = (typeof SALES_INQUIRY_STATUSES)[number];
export type SalesInquiry = Readonly<{ id:number; fullName:string; email:string; companyName:string; country:string; interest:string; message:string; plan:string|null; billingCycle:string|null; useCase:string|null; status:SalesInquiryStatus; createdAt:string; updatedAt:string }>;
const text=(value:unknown,field:string,max=4000)=>{if(typeof value!=="string"||!value.trim()||value.length>max)throw new Error(`Invalid sales inquiry ${field}`);return value;};
const optional=(value:unknown,field:string)=>value==null?null:text(value,field,160);
export function parseSalesInquiry(value:unknown):SalesInquiry{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid sales inquiry");
  const row=value as Record<string,unknown>,id=Number(row.id);
  if(!Number.isSafeInteger(id)||id<1)throw new Error("Invalid sales inquiry id");
  if(!SALES_INQUIRY_STATUSES.includes(row.status as SalesInquiryStatus))throw new Error("Invalid sales inquiry status");
  const createdAt=text(row.createdAt,"createdAt",80),updatedAt=text(row.updatedAt,"updatedAt",80);
  if(Number.isNaN(Date.parse(createdAt))||Number.isNaN(Date.parse(updatedAt)))throw new Error("Invalid sales inquiry timestamp");
  return Object.freeze({id,fullName:text(row.fullName,"fullName",120),email:text(row.email,"email",254),companyName:text(row.companyName,"companyName",160),country:text(row.country,"country",100),interest:text(row.interest,"interest",160),message:text(row.message,"message"),plan:optional(row.plan,"plan"),billingCycle:optional(row.billingCycle,"billingCycle"),useCase:optional(row.useCase,"useCase"),status:row.status as SalesInquiryStatus,createdAt,updatedAt});
}
export function parseSalesInquiryList(value:unknown):{items:SalesInquiry[];limit:number}{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid sales inquiry response");
  const payload=value as Record<string,unknown>;if(!Array.isArray(payload.items))throw new Error("Invalid sales inquiry items");
  const limit=Number(payload.limit);if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error("Invalid sales inquiry limit");
  const items=payload.items.map(parseSalesInquiry);if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error("Duplicate sales inquiry id");return {items,limit};
}
