import assert from "node:assert/strict";
import { createCompanySubscription } from "./subscription-authority";
import { createCustomerBillingStatement, deriveSubscriptionAccess, evaluateSubscriptionAccess } from "./commercial-billing-operations";

const subscription = createCompanySubscription({ id:"sub-41", companyId:7, planId:"business", catalogPriceVersion:7, billingCycle:"monthly", currency:"USD", amount:3000, now:"2026-10-01T00:00:00Z" });
const active = { ...subscription, status:"active" as const, revision:2, updatedAt:"2026-10-01T00:01:00.000Z" };
const term = { subscriptionId:active.id, sequence:1, billingCycle:"monthly" as const, startsAt:"2026-10-01T00:00:00.000Z", endsAt:"2026-11-01T00:00:00.000Z", renewsAt:"2026-11-01T00:00:00.000Z", sourceOrderId:"order-41", sourceInvoiceId:"invoice-41" };
const grant = deriveSubscriptionAccess({ subscription:active, term, catalogPriceVersionId:"price-v7", features:["projects","coordination","projects"], seatLimit:12, existing:[], now:"2026-10-02T00:00:00Z" });
assert.deepEqual({ company:grant.companyId, features:grant.features, seats:grant.seatLimit, status:grant.status }, { company:7, features:["projects","coordination"], seats:12, status:"active" });
assert.equal(deriveSubscriptionAccess({ subscription:active, term, catalogPriceVersionId:"price-v7", features:["projects"], seatLimit:12, existing:[grant], now:"2026-10-02T00:00:00Z" }), grant);
assert.equal(evaluateSubscriptionAccess({ grant, subscription:{ ...active, status:"past_due" }, now:"2026-10-03T00:00:00Z" }).status, "expired");
assert.throws(() => deriveSubscriptionAccess({ subscription, term, catalogPriceVersionId:"price-v7", features:["projects"], seatLimit:12, existing:[], now:"2026-10-02T00:00:00Z" }), /active subscription/);
console.log("B041 subscription-derived commercial access: PASS");

const invoice = { id:"invoice-42", invoiceNumber:"INV-42", companyId:7, subscriptionId:active.id, orderId:"order-42", orderRevision:2, checkoutAttemptId:"attempt-42", provider:"stripe", providerReference:"in_42", currency:"USD" as const, subtotalCents:2800, taxCents:200, totalCents:3000, status:"paid" as const, issuedAt:"2026-10-03T00:00:00.000Z", paidAt:"2026-10-03T00:00:00.000Z" };
const credit = { id:"credit-42", creditNumber:"CN-42", invoiceId:invoice.id, subscriptionId:active.id, provider:"stripe", providerEventId:"evt-42", amountCents:500, currency:"USD" as const, reason:"Service adjustment", status:"partial_refund" as const, issuedAt:"2026-10-04T00:00:00.000Z" };
const statement = createCustomerBillingStatement({ companyId:7, subscriptionId:active.id, invoices:[invoice], credits:[credit], periodStartsAt:"2026-10-01T00:00:00Z", periodEndsAt:"2026-11-01T00:00:00Z", generatedAt:"2026-11-01T00:01:00Z" });
assert.deepEqual({ paid:statement.paidCents, credited:statement.creditedCents, net:statement.netPaidCents, status:statement.status }, { paid:3000, credited:500, net:2500, status:"partially_refunded" });
assert.equal(createCustomerBillingStatement({ companyId:7, subscriptionId:active.id, invoices:[invoice], credits:[credit], periodStartsAt:"2026-10-01T00:00:00Z", periodEndsAt:"2026-11-01T00:00:00Z", generatedAt:"2026-11-01T00:02:00Z" }).id, statement.id);
assert.throws(() => createCustomerBillingStatement({ companyId:8, subscriptionId:active.id, invoices:[invoice], credits:[], periodStartsAt:"2026-10-01T00:00:00Z", periodEndsAt:"2026-11-01T00:00:00Z", generatedAt:"2026-11-01T00:01:00Z" }), /invoice lineage/);
console.log("B042 deterministic customer billing statements: PASS");
