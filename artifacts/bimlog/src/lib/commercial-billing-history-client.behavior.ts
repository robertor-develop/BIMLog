import assert from "node:assert/strict";
import {parseCommercialBillingHistory} from "./commercial-billing-history-client";
const valid={companyId:7,subscription:{planCode:"professional",billingCycle:"monthly",status:"active"},invoices:[{id:"invoice-1",invoiceNumber:"INV-100",currency:"USD",subtotalCents:3000,taxCents:0,totalCents:3000,status:"paid",issuedAt:"2026-10-01T12:00:00Z",dueAt:null,paidAt:"2026-10-01T12:05:00Z",credits:[{id:"credit-1",creditNumber:"CR-1",amountCents:500,reason:"Adjustment",status:"issued",issuedAt:"2026-10-02T12:00:00Z"}],disputes:[{id:"dispute-1",amountCents:1000,reasonCode:"duplicate",status:"under_review",evidenceDueAt:"2026-10-10T12:00:00Z",closedAt:null}]}]};
assert.equal(parseCommercialBillingHistory(valid).invoices[0].totalCents,3000);
for(const bad of [{...valid,companyId:0},{...valid,invoices:[{...valid.invoices[0],totalCents:3001}]},{...valid,invoices:[{...valid.invoices[0],status:"secret"}]},{...valid,invoices:[{...valid.invoices[0],issuedAt:"not-a-date"}]}])assert.throws(()=>parseCommercialBillingHistory(bad));
assert.deepEqual(parseCommercialBillingHistory({companyId:8,subscription:null,invoices:[]}),{companyId:8,subscription:null,invoices:[]});
console.log("B243 strict customer billing history client: PASS");
