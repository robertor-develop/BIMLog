export type BillingHistoryQueryResult = Readonly<{rows:Record<string,unknown>[];rowCount:number|null}>;
export type BillingHistoryQueryClient = Readonly<{query(text:string,values?:readonly unknown[]):Promise<BillingHistoryQueryResult>}>;
import type {BillingHistoryQuery} from "./commercial-billing-history-query";

export type CustomerBillingInvoice = Readonly<{
  id:string;invoiceNumber:string;currency:string;subtotalCents:number;taxCents:number;totalCents:number;
  status:"draft"|"open"|"paid"|"void"|"uncollectible";issuedAt:string;dueAt:string|null;paidAt:string|null;
  credits:readonly Readonly<{id:string;creditNumber:string;amountCents:number;reason:string;status:"issued"|"void";issuedAt:string}>[];
  disputes:readonly Readonly<{id:string;amountCents:number;reasonCode:string;status:"needs_response"|"under_review"|"won"|"lost"|"withdrawn";evidenceDueAt:string|null;closedAt:string|null}>[];
}>;
export type CustomerBillingHistory = Readonly<{companyId:number;subscription:Readonly<{planCode:string;billingCycle:string;status:string}>|null;invoices:readonly CustomerBillingInvoice[];page:number;pageSize:number;totalInvoices:number;totalPages:number}>;

const integer=(value:unknown,label:string)=>{const parsed=typeof value==="number"?value:Number(value);if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error(`${label} is invalid`);return parsed;};
const positiveInteger=(value:unknown,label:string)=>{const parsed=integer(value,label);if(parsed<1)throw new Error(`${label} is invalid`);return parsed;};
const text=(value:unknown,label:string)=>{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is invalid`);return value;};
const instant=(value:unknown,label:string)=>{if(value===null||value===undefined)return null;const parsed=value instanceof Date?value:new Date(String(value));if(!Number.isFinite(parsed.getTime()))throw new Error(`${label} is invalid`);return parsed.toISOString();};

export async function readCustomerBillingHistory(client:BillingHistoryQueryClient,companyId:number,query:BillingHistoryQuery={status:"all",page:1,pageSize:10,offset:0}):Promise<CustomerBillingHistory>{
  positiveInteger(companyId,"Company identity");
  const subscriptionResult=await client.query(`SELECT plan_code,billing_cycle,status FROM commercial_subscriptions WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1`,[companyId]);
  const invoiceWhere=query.status==="all"?"company_id=$1":"company_id=$1 AND status=$2";
  const filterValues:readonly unknown[]=query.status==="all"?[companyId]:[companyId,query.status];
  const countResult=await client.query(`SELECT count(*)::int AS total FROM commercial_invoices WHERE ${invoiceWhere}`,filterValues);
  const totalInvoices=integer(countResult.rows[0]?.total??0,"Invoice total count");
  const invoiceResult=await client.query(`SELECT id,invoice_number,currency,subtotal_cents,tax_cents,total_cents,status,issued_at,due_at,paid_at FROM commercial_invoices WHERE ${invoiceWhere} ORDER BY issued_at DESC,id DESC LIMIT $${filterValues.length+1} OFFSET $${filterValues.length+2}`,[...filterValues,query.pageSize,query.offset]);
  const invoiceIds=invoiceResult.rows.map(row=>text(row.id,"Invoice identity"));
  const [creditResult,disputeResult]=invoiceIds.length?await Promise.all([
    client.query(`SELECT id,invoice_id,credit_number,amount_cents,reason,status,issued_at FROM commercial_credit_notes WHERE company_id=$1 AND invoice_id=ANY($2::text[]) ORDER BY issued_at DESC,id DESC`,[companyId,invoiceIds]),
    client.query(`SELECT id,invoice_id,amount_cents,reason_code,status,evidence_due_at,closed_at FROM commercial_disputes WHERE company_id=$1 AND invoice_id=ANY($2::text[]) ORDER BY updated_at DESC,id DESC`,[companyId,invoiceIds]),
  ]):[{rows:[],rowCount:0},{rows:[],rowCount:0}];
  const creditsByInvoice=new Map<string,CustomerBillingInvoice["credits"] extends readonly (infer T)[]?T[]:never>();
  for(const row of creditResult.rows){const invoiceId=text(row.invoice_id,"Credit invoice identity"),items=creditsByInvoice.get(invoiceId)??[];items.push(Object.freeze({id:text(row.id,"Credit identity"),creditNumber:text(row.credit_number,"Credit number"),amountCents:integer(row.amount_cents,"Credit amount"),reason:text(row.reason,"Credit reason"),status:text(row.status,"Credit status") as "issued"|"void",issuedAt:instant(row.issued_at,"Credit issue time")!}));creditsByInvoice.set(invoiceId,items);}
  const disputesByInvoice=new Map<string,CustomerBillingInvoice["disputes"] extends readonly (infer T)[]?T[]:never>();
  for(const row of disputeResult.rows){const invoiceId=text(row.invoice_id,"Dispute invoice identity"),items=disputesByInvoice.get(invoiceId)??[];items.push(Object.freeze({id:text(row.id,"Dispute identity"),amountCents:integer(row.amount_cents,"Dispute amount"),reasonCode:text(row.reason_code,"Dispute reason"),status:text(row.status,"Dispute status") as "needs_response"|"under_review"|"won"|"lost"|"withdrawn",evidenceDueAt:instant(row.evidence_due_at,"Dispute evidence time"),closedAt:instant(row.closed_at,"Dispute close time")}));disputesByInvoice.set(invoiceId,items);}
  const invoices=invoiceResult.rows.map(row=>{const id=text(row.id,"Invoice identity");return Object.freeze({id,invoiceNumber:text(row.invoice_number,"Invoice number"),currency:text(row.currency,"Invoice currency"),subtotalCents:integer(row.subtotal_cents,"Invoice subtotal"),taxCents:integer(row.tax_cents,"Invoice tax"),totalCents:integer(row.total_cents,"Invoice total"),status:text(row.status,"Invoice status") as CustomerBillingInvoice["status"],issuedAt:instant(row.issued_at,"Invoice issue time")!,dueAt:instant(row.due_at,"Invoice due time"),paidAt:instant(row.paid_at,"Invoice paid time"),credits:Object.freeze(creditsByInvoice.get(id)??[]),disputes:Object.freeze(disputesByInvoice.get(id)??[])})});
  const subscriptionRow=subscriptionResult.rows[0];
  return Object.freeze({companyId,subscription:subscriptionRow?Object.freeze({planCode:text(subscriptionRow.plan_code,"Subscription plan"),billingCycle:text(subscriptionRow.billing_cycle,"Billing cycle"),status:text(subscriptionRow.status,"Subscription status")}):null,invoices:Object.freeze(invoices),page:query.page,pageSize:query.pageSize,totalInvoices,totalPages:Math.ceil(totalInvoices/query.pageSize)});
}
