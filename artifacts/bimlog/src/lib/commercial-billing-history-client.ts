export type BillingCreditDto={id:string;creditNumber:string;amountCents:number;reason:string;status:"issued"|"void";issuedAt:string};
export type BillingDisputeDto={id:string;amountCents:number;reasonCode:string;status:"needs_response"|"under_review"|"won"|"lost"|"withdrawn";evidenceDueAt:string|null;closedAt:string|null};
export type BillingInvoiceDto={id:string;invoiceNumber:string;currency:string;subtotalCents:number;taxCents:number;totalCents:number;status:"draft"|"open"|"paid"|"void"|"uncollectible";issuedAt:string;dueAt:string|null;paidAt:string|null;credits:BillingCreditDto[];disputes:BillingDisputeDto[]};
export type CommercialBillingHistoryDto={companyId:number;subscription:{planCode:string;billingCycle:string;status:string}|null;invoices:BillingInvoiceDto[]};

const object=(value:unknown,label:string)=>{if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`Invalid ${label}`);return value as Record<string,unknown>;};
const string=(value:unknown,label:string)=>{if(typeof value!=="string"||!value.trim())throw new Error(`Invalid ${label}`);return value;};
const integer=(value:unknown,label:string)=>{if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(`Invalid ${label}`);return Number(value);};
const oneOf=<T extends string>(value:unknown,allowed:readonly T[],label:string)=>{const parsed=string(value,label) as T;if(!allowed.includes(parsed))throw new Error(`Invalid ${label}`);return parsed;};
const instant=(value:unknown,label:string)=>{if(value===null)return null;const parsed=string(value,label);if(!Number.isFinite(new Date(parsed).getTime()))throw new Error(`Invalid ${label}`);return parsed;};

export function parseCommercialBillingHistory(value:unknown):CommercialBillingHistoryDto{
  const row=object(value,"billing history response");
  if(!Number.isSafeInteger(row.companyId)||Number(row.companyId)<1||!Array.isArray(row.invoices))throw new Error("Invalid billing history identity");
  const subscription=row.subscription===null?null:(()=>{const item=object(row.subscription,"billing subscription");return {planCode:string(item.planCode,"subscription plan"),billingCycle:string(item.billingCycle,"billing cycle"),status:string(item.status,"subscription status")};})();
  const invoices=row.invoices.map((value,index)=>{const item=object(value,`invoice ${index}`);if(!Array.isArray(item.credits)||!Array.isArray(item.disputes))throw new Error("Invalid invoice adjustments");const subtotalCents=integer(item.subtotalCents,"invoice subtotal"),taxCents=integer(item.taxCents,"invoice tax"),totalCents=integer(item.totalCents,"invoice total");if(totalCents!==subtotalCents+taxCents)throw new Error("Invalid invoice total");return {id:string(item.id,"invoice identity"),invoiceNumber:string(item.invoiceNumber,"invoice number"),currency:oneOf(item.currency,["USD"] as const,"invoice currency"),subtotalCents,taxCents,totalCents,status:oneOf(item.status,["draft","open","paid","void","uncollectible"] as const,"invoice status"),issuedAt:instant(item.issuedAt,"invoice issue time")!,dueAt:instant(item.dueAt,"invoice due time"),paidAt:instant(item.paidAt,"invoice paid time"),credits:item.credits.map((value,creditIndex)=>{const credit=object(value,`credit ${creditIndex}`);return {id:string(credit.id,"credit identity"),creditNumber:string(credit.creditNumber,"credit number"),amountCents:integer(credit.amountCents,"credit amount"),reason:string(credit.reason,"credit reason"),status:oneOf(credit.status,["issued","void"] as const,"credit status"),issuedAt:instant(credit.issuedAt,"credit issue time")!};}),disputes:item.disputes.map((value,disputeIndex)=>{const dispute=object(value,`dispute ${disputeIndex}`);return {id:string(dispute.id,"dispute identity"),amountCents:integer(dispute.amountCents,"dispute amount"),reasonCode:string(dispute.reasonCode,"dispute reason"),status:oneOf(dispute.status,["needs_response","under_review","won","lost","withdrawn"] as const,"dispute status"),evidenceDueAt:instant(dispute.evidenceDueAt,"dispute evidence time"),closedAt:instant(dispute.closedAt,"dispute close time")};})};});
  return {companyId:Number(row.companyId),subscription,invoices};
}

export async function requestCommercialBillingHistory(input:{token:string;signal?:AbortSignal}):Promise<CommercialBillingHistoryDto>{
  const response=await fetch(`${import.meta.env.BASE_URL.replace(/\/$/,"")}/api/v1/commercial/billing-history`,{headers:{Authorization:`Bearer ${input.token}`},signal:input.signal});
  const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof body.error==="string"?body.error:"Billing history could not be loaded.");return parseCommercialBillingHistory(body);
}

