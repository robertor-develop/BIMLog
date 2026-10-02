export const SALES_INQUIRY_STATUSES=["new","acknowledged","qualified","closed"] as const;
export type SalesInquiryStatus=typeof SALES_INQUIRY_STATUSES[number];
const transitions:Readonly<Record<SalesInquiryStatus,readonly SalesInquiryStatus[]>>={new:["acknowledged","qualified","closed"],acknowledged:["qualified","closed"],qualified:["closed"],closed:[]};
export function assertSalesInquiryTransition(from:unknown,to:unknown):asserts to is SalesInquiryStatus{
  if(!SALES_INQUIRY_STATUSES.includes(from as SalesInquiryStatus)||!SALES_INQUIRY_STATUSES.includes(to as SalesInquiryStatus))throw new Error("Sales inquiry status is invalid");
  if(!transitions[from as SalesInquiryStatus].includes(to as SalesInquiryStatus))throw new Error(`Sales inquiry transition ${from} -> ${to} is not allowed`);
}
