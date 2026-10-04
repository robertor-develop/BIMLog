import assert from "node:assert/strict";
import {createStripeCustomer,inspectStripeCommercialConfiguration} from "./commercial-provider-adapter";
const configuration=inspectStripeCommercialConfiguration({secretKey:"sk_test_abcdefghijklmnop",webhookSecret:"whsec_abcdefghijklmnop",appOrigin:"https://bimlog.app"}).configuration!;
let seen:any;
const created=await createStripeCustomer({configuration,companyId:47,companyName:" BIM Tech ",billingEmail:"OWNER@Example.com",idempotencyKey:"setup-company-47-0001",transport:async request=>{seen=request;return {status:200,body:{id:"cus_bimlog_company_47",metadata:{company_id:"47"}}};}});
assert.equal(created.providerCustomerReference,"cus_bimlog_company_47");assert.equal(seen.path,"/v1/customers");assert.equal(seen.body.get("name"),"BIM Tech");assert.equal(seen.body.get("email"),"owner@example.com");assert.equal(seen.body.get("metadata[company_id]"),"47");assert.equal(seen.headers["Idempotency-Key"],"setup-company-47-0001");
await assert.rejects(()=>createStripeCustomer({configuration,companyId:47,companyName:"BIM Tech",billingEmail:"invalid",idempotencyKey:"setup-company-47-0001",transport:async()=>({status:200,body:{id:"cus_ok_123456",metadata:{company_id:"47"}}})}),/billing email/);
await assert.rejects(()=>createStripeCustomer({configuration,companyId:47,companyName:"BIM Tech",billingEmail:"owner@example.com",idempotencyKey:"setup-company-47-0001",transport:async()=>({status:200,body:{id:"cus_other_123456",metadata:{company_id:"48"}}})}),/response identity/);
console.log("B291 bounded replay-safe Stripe customer creation: PASS");
