export const BILLING_INVOICE_STATUSES=["draft","open","paid","void","uncollectible"] as const;
export type BillingInvoiceStatus=(typeof BILLING_INVOICE_STATUSES)[number];
export type BillingHistoryQuery=Readonly<{status:BillingInvoiceStatus|"all";page:number;pageSize:number;offset:number}>;

const scalar=(value:unknown)=>{if(Array.isArray(value))throw new Error("Duplicate billing query value");return value;};
const boundedInteger=(value:unknown,fallback:number,min:number,max:number,label:string)=>{
  const candidate=scalar(value);
  if(candidate===undefined||candidate===null||candidate==="")return fallback;
  if(typeof candidate!=="string"||!/^\d+$/.test(candidate))throw new Error(`${label} is invalid`);
  const parsed=Number(candidate);
  if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${label} is invalid`);
  return parsed;
};

export function parseBillingHistoryQuery(input:Readonly<Record<string,unknown>>):BillingHistoryQuery{
  const rawStatus=scalar(input.status);
  const status=rawStatus===undefined||rawStatus===""?"all":rawStatus;
  if(typeof status!=="string"||!(status==="all"||BILLING_INVOICE_STATUSES.includes(status as BillingInvoiceStatus)))throw new Error("Billing status is invalid");
  const page=boundedInteger(input.page,1,1,100000,"Billing page");
  const pageSize=boundedInteger(input.pageSize,10,5,50,"Billing page size");
  return Object.freeze({status:status as BillingHistoryQuery["status"],page,pageSize,offset:(page-1)*pageSize});
}
