import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createPersistentOrderCheckout, persistVerifiedProviderReceipt, readPersistentCommercialAuthority, type CommercialQueryClient } from "./commercial-persistence";

const calls: { text: string; values?: readonly unknown[] }[] = [];
const client: CommercialQueryClient = { async query(text, values) {
  calls.push({ text, values });
  if (text.includes("FROM commercial_subscriptions")) return { rows: [{ id: "sub-company-7", company_id: 7, status: "active" }], rowCount: 1 };
  if (text.includes("commercial_subscription_terms")) return { rows: [{ id: "term-1", sequence: 1 }], rowCount: 1 };
  if (text.includes("commercial_subscription_seats")) return { rows: [{ id: "seat-1", seat_number: 1 }], rowCount: 1 };
  if (text.includes("commercial_provider_bindings")) return { rows: [{ id: "binding-1", provider: "stripe" }], rowCount: 1 };
  throw new Error(`Unexpected query: ${text}`);
} };

const authority = await readPersistentCommercialAuthority(client, 7);
assert.equal(authority?.subscription.id, "sub-company-7");
assert.equal(authority?.terms.length, 1);
assert.equal(authority?.seats.length, 1);
assert.equal(authority?.providerBindings.length, 1);
assert.match(calls[0].text, /company_id=\$1/);
assert.deepEqual(calls[2].values, ["sub-company-7", 7]);
assert.rejects(() => readPersistentCommercialAuthority(client, 0), /Company identity/);

console.log("COMMERCIAL_PERSISTENCE_B221=PASS");

const writes: string[]=[];
const writeClient:CommercialQueryClient={async query(text){writes.push(text);
  if(text.startsWith("SELECT s.id"))return {rows:[{id:"sub-company-7"}],rowCount:1};
  if(text.startsWith("SELECT id,fingerprint"))return {rows:[],rowCount:0};
  if(text.includes("RETURNING id"))return {rows:[{id:"checkout-company-7"}],rowCount:1};
  return {rows:[],rowCount:null};
}};
const checkout=await createPersistentOrderCheckout(writeClient,{companyId:7,userId:42,subscriptionId:"sub-company-7",providerBindingId:"binding-company-7",orderId:"order-company-7",checkoutId:"checkout-company-7",requestKey:"request-company-7",idempotencyKey:"checkout-key-company-7",fingerprint:"a".repeat(64),currency:"USD",subtotalCents:10000,taxCents:700,expiresAt:"2026-10-04T12:00:00Z"});
assert.deepEqual(checkout,{orderId:"order-company-7",checkoutId:"checkout-company-7",replayed:false});
assert.equal(writes[0],"BEGIN");assert.equal(writes.at(-1),"COMMIT");
assert.ok(writes.some(query=>query.includes("INSERT INTO commercial_orders")));
assert.ok(writes.some(query=>query.includes("ON CONFLICT(company_id,idempotency_key)")));

console.log("COMMERCIAL_PERSISTENCE_B222=PASS");

const raw=JSON.stringify({id:"evt_company_7",type:"checkout.session.completed"}),digest=crypto.createHash("sha256").update(raw).digest("hex");
const receiptClient:CommercialQueryClient={async query(text){
  if(text.includes("FROM commercial_provider_bindings"))return {rows:[{id:"binding-company-7"}],rowCount:1};
  if(text.includes("FROM commercial_provider_receipts"))return {rows:[],rowCount:0};
  if(text.includes("INSERT INTO commercial_provider_receipts"))return {rows:[{id:"receipt-company-7"}],rowCount:1};
  throw new Error(`Unexpected receipt query: ${text}`);
}};
const receipt=await persistVerifiedProviderReceipt(receiptClient,{id:"receipt-company-7",companyId:7,providerBindingId:"binding-company-7",providerEventReference:"evt_company_7",eventType:"checkout.session.completed",rawPayload:raw,payloadDigest:digest,signatureVerifiedAt:"2026-10-04T12:00:00Z"});
assert.deepEqual(receipt,{id:"receipt-company-7",replayed:false});
await assert.rejects(()=>persistVerifiedProviderReceipt(receiptClient,{id:"receipt-company-7",companyId:7,providerBindingId:"binding-company-7",providerEventReference:"evt_company_7",eventType:"checkout.session.completed",rawPayload:`${raw} `,payloadDigest:digest,signatureVerifiedAt:"2026-10-04T12:00:00Z"}),/digest/);

console.log("COMMERCIAL_PERSISTENCE_B223=PASS");
