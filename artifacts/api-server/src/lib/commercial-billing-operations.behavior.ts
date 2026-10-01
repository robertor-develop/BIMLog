import assert from "node:assert/strict";
import { createCompanySubscription } from "./subscription-authority";
import { deriveSubscriptionAccess, evaluateSubscriptionAccess } from "./commercial-billing-operations";

const subscription = createCompanySubscription({ id:"sub-41", companyId:7, planId:"business", catalogPriceVersion:7, billingCycle:"monthly", currency:"USD", amount:3000, now:"2026-10-01T00:00:00Z" });
const active = { ...subscription, status:"active" as const, revision:2, updatedAt:"2026-10-01T00:01:00.000Z" };
const term = { subscriptionId:active.id, sequence:1, billingCycle:"monthly" as const, startsAt:"2026-10-01T00:00:00.000Z", endsAt:"2026-11-01T00:00:00.000Z", renewsAt:"2026-11-01T00:00:00.000Z", sourceOrderId:"order-41", sourceInvoiceId:"invoice-41" };
const grant = deriveSubscriptionAccess({ subscription:active, term, catalogPriceVersionId:"price-v7", features:["projects","coordination","projects"], seatLimit:12, existing:[], now:"2026-10-02T00:00:00Z" });
assert.deepEqual({ company:grant.companyId, features:grant.features, seats:grant.seatLimit, status:grant.status }, { company:7, features:["projects","coordination"], seats:12, status:"active" });
assert.equal(deriveSubscriptionAccess({ subscription:active, term, catalogPriceVersionId:"price-v7", features:["projects"], seatLimit:12, existing:[grant], now:"2026-10-02T00:00:00Z" }), grant);
assert.equal(evaluateSubscriptionAccess({ grant, subscription:{ ...active, status:"past_due" }, now:"2026-10-03T00:00:00Z" }).status, "expired");
assert.throws(() => deriveSubscriptionAccess({ subscription, term, catalogPriceVersionId:"price-v7", features:["projects"], seatLimit:12, existing:[], now:"2026-10-02T00:00:00Z" }), /active subscription/);
console.log("B041 subscription-derived commercial access: PASS");
