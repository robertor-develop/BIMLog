import crypto from "node:crypto";

export const SALES_INQUIRY_PLANS=["free","professional","team","business","enterprise","founding"] as const;
export const SALES_INQUIRY_BILLING_CYCLES=["monthly","annual"] as const;
export type SalesInquiryPlan=typeof SALES_INQUIRY_PLANS[number];
export type SalesInquiryBillingCycle=typeof SALES_INQUIRY_BILLING_CYCLES[number];
export type SalesInquiryInput=Readonly<{fullName:string;email:string;companyName:string;country:string;interest:string;message:string;plan:SalesInquiryPlan|null;billingCycle:SalesInquiryBillingCycle|null;useCase:string|null;requestKey:string}>;

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const secretPattern=/(?:sk_(?:live|test)_|rk_(?:live|test)_|SG\.[A-Za-z0-9_-]{10,}\.|api[_ -]?key\s*[:=]|password\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,})/i;
const clean=(value:unknown,label:string,max:number)=>{
  if(typeof value!=="string")throw new Error(`${label} is required`);
  const normalized=value.trim().replace(/\s+/g," ");
  if(normalized.length<2||normalized.length>max)throw new Error(`${label} is invalid`);
  if(secretPattern.test(normalized))throw new Error("Credentials and secrets are not accepted");
  return normalized;
};
const optional=(value:unknown,label:string,max:number)=>value==null||value===""?null:clean(value,label,max);

export function parseSalesInquiryInput(value:unknown):SalesInquiryInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Sales inquiry payload is invalid");
  const raw=value as Record<string,unknown>;
  const email=clean(raw.email,"Email",254).toLowerCase();
  if(!emailPattern.test(email))throw new Error("Email is invalid");
  const plan=raw.plan==null||raw.plan===""?null:raw.plan;
  const billingCycle=raw.billingCycle==null||raw.billingCycle===""?null:raw.billingCycle;
  if(plan!==null&&!SALES_INQUIRY_PLANS.includes(plan as SalesInquiryPlan))throw new Error("Plan is invalid");
  if(billingCycle!==null&&!SALES_INQUIRY_BILLING_CYCLES.includes(billingCycle as SalesInquiryBillingCycle))throw new Error("Billing cycle is invalid");
  const requestKey=typeof raw.requestKey==="string"?raw.requestKey.trim():"";
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey))throw new Error("Request identity is invalid");
  return Object.freeze({
    fullName:clean(raw.fullName,"Full name",120),email,companyName:clean(raw.companyName,"Company name",160),
    country:clean(raw.country,"Country",100),interest:clean(raw.interest,"Interest",160),message:clean(raw.message,"Message",4000),
    plan:plan as SalesInquiryPlan|null,billingCycle:billingCycle as SalesInquiryBillingCycle|null,
    useCase:optional(raw.useCase,"Use case",120),requestKey,
  });
}

export function salesInquiryFingerprint(input:SalesInquiryInput):string{
  return crypto.createHash("sha256").update(JSON.stringify({email:input.email,companyName:input.companyName,plan:input.plan,billingCycle:input.billingCycle,useCase:input.useCase,message:input.message})).digest("hex");
}
