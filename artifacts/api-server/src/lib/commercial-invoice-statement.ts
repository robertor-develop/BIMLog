import type {BillingHistoryQueryClient,CustomerBillingInvoice} from "./commercial-billing-history";

export type CustomerInvoiceStatement=Readonly<{companyId:number;customer:Readonly<{legalName:string;address:string|null;phone:string|null}>;invoice:CustomerBillingInvoice;creditedCents:number;balanceCents:number;generatedAt:string}>;
const required=(value:unknown,label:string)=>{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is invalid`);return value.trim();};
const optional=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():null;
const integer=(value:unknown,label:string)=>{const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error(`${label} is invalid`);return parsed;};
const instant=(value:unknown,label:string)=>{if(value===null||value===undefined)return null;const date=value instanceof Date?value:new Date(String(value));if(!Number.isFinite(date.getTime()))throw new Error(`${label} is invalid`);return date.toISOString();};
const oneOf=<T extends string>(value:unknown,allowed:readonly T[],label:string)=>{const parsed=required(value,label) as T;if(!allowed.includes(parsed))throw new Error(`${label} is invalid`);return parsed;};

export function parseCommercialInvoiceId(value:unknown){const id=typeof value==="string"?value.trim():"";if(!/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(id))throw new Error("Invoice identity is invalid");return id;}

export async function readCustomerInvoiceStatement(client:BillingHistoryQueryClient,companyId:number,invoiceId:string,now:Date=new Date()):Promise<CustomerInvoiceStatement>{
  if(!Number.isSafeInteger(companyId)||companyId<1)throw new Error("Company identity is invalid");const id=parseCommercialInvoiceId(invoiceId);
  const invoiceResult=await client.query(`SELECT i.id,i.invoice_number,i.currency,i.subtotal_cents,i.tax_cents,i.total_cents,i.status,i.issued_at,i.due_at,i.paid_at,c.name AS customer_name,c.address AS customer_address,c.phone AS customer_phone FROM commercial_invoices i JOIN companies c ON c.id=i.company_id WHERE i.company_id=$1 AND i.id=$2 LIMIT 1`,[companyId,id]);
  const row=invoiceResult.rows[0];if(!row)throw new Error("Invoice was not found");
  const [creditResult,disputeResult]=await Promise.all([
    client.query(`SELECT id,credit_number,amount_cents,reason,status,issued_at FROM commercial_credit_notes WHERE company_id=$1 AND invoice_id=$2 ORDER BY issued_at DESC,id DESC`,[companyId,id]),
    client.query(`SELECT id,amount_cents,reason_code,status,evidence_due_at,closed_at FROM commercial_disputes WHERE company_id=$1 AND invoice_id=$2 ORDER BY updated_at DESC,id DESC`,[companyId,id]),
  ]);
  const subtotalCents=integer(row.subtotal_cents,"Invoice subtotal"),taxCents=integer(row.tax_cents,"Invoice tax"),totalCents=integer(row.total_cents,"Invoice total"),status=oneOf(row.status,["draft","open","paid","void","uncollectible"] as const,"Invoice status"),paidAt=instant(row.paid_at,"Invoice paid time");
  if(totalCents!==subtotalCents+taxCents||(status==="paid")!==(paidAt!==null))throw new Error("Invoice state is invalid");
  const credits=creditResult.rows.map(item=>Object.freeze({id:required(item.id,"Credit identity"),creditNumber:required(item.credit_number,"Credit number"),amountCents:integer(item.amount_cents,"Credit amount"),reason:required(item.reason,"Credit reason"),status:oneOf(item.status,["issued","void"] as const,"Credit status"),issuedAt:instant(item.issued_at,"Credit issue time")!}));
  const disputes=disputeResult.rows.map(item=>{const disputeStatus=oneOf(item.status,["needs_response","under_review","won","lost","withdrawn"] as const,"Dispute status"),closedAt=instant(item.closed_at,"Dispute close time"),amountCents=integer(item.amount_cents,"Dispute amount");if(amountCents<1||amountCents>totalCents||((disputeStatus==="needs_response"||disputeStatus==="under_review")!==(closedAt===null)))throw new Error("Dispute state is invalid");return Object.freeze({id:required(item.id,"Dispute identity"),amountCents,reasonCode:required(item.reason_code,"Dispute reason"),status:disputeStatus,evidenceDueAt:instant(item.evidence_due_at,"Dispute evidence time"),closedAt});});
  const creditedCents=credits.filter(item=>item.status==="issued").reduce((sum,item)=>sum+item.amountCents,0);if(creditedCents>totalCents)throw new Error("Invoice credited total is invalid");
  const invoice=Object.freeze({id:required(row.id,"Invoice identity"),invoiceNumber:required(row.invoice_number,"Invoice number"),currency:oneOf(row.currency,["USD"] as const,"Invoice currency"),subtotalCents,taxCents,totalCents,status,issuedAt:instant(row.issued_at,"Invoice issue time")!,dueAt:instant(row.due_at,"Invoice due time"),paidAt,credits:Object.freeze(credits),disputes:Object.freeze(disputes)});
  return Object.freeze({companyId,customer:Object.freeze({legalName:required(row.customer_name,"Customer name"),address:optional(row.customer_address),phone:optional(row.customer_phone)}),invoice,creditedCents,balanceCents:status==="open"||status==="uncollectible"?totalCents-creditedCents:0,generatedAt:now.toISOString()});
}
