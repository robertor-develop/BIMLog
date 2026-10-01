import assert from "node:assert/strict";
import { createCompanySubscription } from "./subscription-authority";
import { deriveSubscriptionAccess } from "./commercial-billing-operations";
import { deriveCustomerSupportEntitlement, openCustomerSupportCase } from "./commercial-customer-support";

const subscriptionBase = createCompanySubscription({ id:"sub-46", companyId:7, planId:"business", catalogPriceVersion:7, billingCycle:"monthly", currency:"USD", amount:3000, now:"2026-10-01T00:00:00Z" });
const subscription = { ...subscriptionBase, status:"active" as const, revision:2, updatedAt:"2026-10-01T00:01:00.000Z" };
const term = { subscriptionId:subscription.id, sequence:1, billingCycle:"monthly" as const, startsAt:"2026-10-01T00:00:00.000Z", endsAt:"2026-11-01T00:00:00.000Z", renewsAt:"2026-11-01T00:00:00.000Z", sourceOrderId:"order-46", sourceInvoiceId:"invoice-46" };
const grant = deriveSubscriptionAccess({ subscription, term, catalogPriceVersionId:"price-v7", features:["projects","coordination"], seatLimit:12, existing:[], now:"2026-10-02T00:00:00Z" });
const entitlement = deriveCustomerSupportEntitlement({ subscription, grant, tier:"priority", channels:["web","email","web"], existing:[], now:"2026-10-02T00:00:00Z" });
assert.deepEqual({ company:entitlement.companyId, tier:entitlement.tier, channels:entitlement.channels, target:entitlement.responseTargetMinutes }, { company:7, tier:"priority", channels:["web","email"], target:240 });
assert.equal(deriveCustomerSupportEntitlement({ subscription, grant, tier:"priority", channels:["web"], existing:[entitlement], now:"2026-10-02T00:01:00Z" }), entitlement);
assert.throws(() => deriveCustomerSupportEntitlement({ subscription:{ ...subscription, status:"past_due" }, grant, tier:"standard", channels:["web"], existing:[], now:"2026-10-02T00:00:00Z" }), /active subscription/);
console.log("B046 subscription-bound customer support entitlement: PASS");

const supportCase = openCustomerSupportCase({ entitlement, requesterUserId:71, channel:"web", locale:"es", category:"billing", priority:"urgent", subject:"Invoice amount differs", description:"The October invoice does not match our approved subscription.", requestKey:"customer-71-october-invoice", existing:[], now:"2026-10-03T10:00:00Z" });
assert.deepEqual({ company:supportCase.companyId, status:supportCase.status, due:supportCase.responseDueAt, revision:supportCase.revision }, { company:7, status:"open", due:"2026-10-03T12:00:00.000Z", revision:1 });
assert.equal(openCustomerSupportCase({ entitlement, requesterUserId:71, channel:"web", locale:"es", category:"billing", priority:"urgent", subject:"Invoice amount differs", description:"The October invoice does not match our approved subscription.", requestKey:"customer-71-october-invoice", existing:[supportCase], now:"2026-10-03T10:01:00Z" }), supportCase);
assert.throws(() => openCustomerSupportCase({ entitlement, requesterUserId:71, channel:"phone" as never, locale:"en", category:"technical", priority:"normal", subject:"Phone request", description:"This channel is not included.", requestKey:"bad-channel", existing:[], now:"2026-10-03T10:00:00Z" }), /channel is not entitled/);
console.log("B047 idempotent support case intake and SLA: PASS");
