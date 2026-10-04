import assert from "node:assert/strict";
import {readCustomerBillingHistory} from "./commercial-billing-history";

const calls:{text:string;values?:readonly unknown[]}[]=[];
const client={async query(text:string,values?:readonly unknown[]){calls.push({text,values});if(text.includes("commercial_subscriptions"))return {rows:[{plan_code:"professional",billing_cycle:"monthly",status:"active"}],rowCount:1};if(text.includes("commercial_invoices"))return {rows:[{id:"invoice-1",invoice_number:"INV-100",currency:"USD",subtotal_cents:3000,tax_cents:0,total_cents:3000,status:"paid",issued_at:"2026-10-01T12:00:00Z",due_at:null,paid_at:"2026-10-01T12:05:00Z"}],rowCount:1};if(text.includes("commercial_credit_notes"))return {rows:[{id:"credit-1",invoice_id:"invoice-1",credit_number:"CR-1",amount_cents:500,reason:"Service adjustment",status:"issued",issued_at:"2026-10-02T12:00:00Z",provider_event_reference:"evt_secret"}],rowCount:1};if(text.includes("commercial_disputes"))return {rows:[{id:"dispute-1",invoice_id:"invoice-1",amount_cents:1000,reason_code:"duplicate",status:"under_review",evidence_due_at:"2026-10-10T12:00:00Z",closed_at:null,provider_dispute_reference:"dp_secret"}],rowCount:1};throw new Error("Unexpected query");}};
const history=await readCustomerBillingHistory(client,7);
assert.equal(history.companyId,7);assert.equal(history.subscription?.planCode,"professional");assert.equal(history.invoices[0].credits[0].amountCents,500);assert.equal(history.invoices[0].disputes[0].status,"under_review");
const serialized=JSON.stringify(history);assert.doesNotMatch(serialized,/evt_secret|dp_secret|provider|payload|digest|customerReference/i);
assert.match(calls[1].text,/WHERE company_id=\$1/);assert.deepEqual(calls[1].values,[7]);
const empty=await readCustomerBillingHistory({async query(){return {rows:[],rowCount:0};}},8);assert.deepEqual(empty,{companyId:8,subscription:null,invoices:[]});
console.log("B241 customer billing history projection: PASS");
