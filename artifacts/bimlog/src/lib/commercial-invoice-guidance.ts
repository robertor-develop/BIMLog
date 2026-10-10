import type{BillingInvoiceDto}from"./commercial-billing-history-client";
export type CommercialInvoiceGuidance=Readonly<{creditedCents:number;openDisputeCents:number;balanceCents:number;action:"await_invoice"|"pay_or_update"|"paid"|"dispute_response"|"closed"}>;
export function deriveCommercialInvoiceGuidance(invoice:BillingInvoiceDto):CommercialInvoiceGuidance{
  const creditedCents=invoice.credits.filter(value=>value.status==="issued").reduce((sum,value)=>sum+value.amountCents,0),openDisputeCents=invoice.disputes.filter(value=>value.status==="needs_response"||value.status==="under_review").reduce((sum,value)=>sum+value.amountCents,0);
  const balanceCents=invoice.status==="open"||invoice.status==="uncollectible"?Math.max(0,invoice.totalCents-creditedCents):0;
  const action=openDisputeCents>0?"dispute_response":invoice.status==="draft"?"await_invoice":invoice.status==="open"||invoice.status==="uncollectible"?"pay_or_update":invoice.status==="paid"?"paid":"closed";
  return Object.freeze({creditedCents,openDisputeCents,balanceCents,action});
}
