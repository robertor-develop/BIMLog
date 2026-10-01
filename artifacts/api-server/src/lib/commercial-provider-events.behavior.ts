import assert from "node:assert/strict";
import crypto from "node:crypto";
import { applyStripeCheckoutCompleted, applyStripeInvoicePaid, applyStripeRefund, applyStripeSubscriptionEvent, ingestStripeProviderEvent, markCommercialProviderEventUnresolved, projectCommercialProviderReconciliation, retryCommercialProviderEvent } from "./commercial-provider-events";
import { createCheckoutAttempt, createCommercialOrder, createCompanySubscription, transitionCommercialOrder, transitionSubscription } from "./subscription-authority";
import type { ProviderEventReceipt } from "./subscription-authority";

function verified(rawPayload: string, eventId: string, eventType: string): ProviderEventReceipt {
  return Object.freeze({ provider: "stripe", eventId, eventType, payloadDigest: crypto.createHash("sha256").update(rawPayload).digest("hex"), receivedAt: "2026-10-01T12:00:05.000Z" });
}

const checkoutRaw = JSON.stringify({ id: "evt_036", type: "checkout.session.completed", created: 1790856000, data: { object: { id: "cs_036", customer: "cus_036" } } });
const event036 = ingestStripeProviderEvent({ receipt: verified(checkoutRaw, "evt_036", "checkout.session.completed"), rawPayload: checkoutRaw, existing: [] });
assert.deepEqual({ type: event036.eventType, status: event036.status, object: event036.objectId, customer: event036.customerReference, attempts: event036.attemptCount }, { type: "checkout.session.completed", status: "pending", object: "cs_036", customer: "cus_036", attempts: 0 });
assert.throws(() => ingestStripeProviderEvent({ receipt: verified(checkoutRaw, "evt_036", "checkout.session.completed"), rawPayload: checkoutRaw, existing: [event036] }), /already ingested/);
assert.throws(() => ingestStripeProviderEvent({ receipt: verified(`${checkoutRaw} `, "evt_036", "checkout.session.completed"), rawPayload: checkoutRaw, existing: [] }), /does not match/);

const unknownRaw = JSON.stringify({ id: "evt_unknown", type: "radar.early_fraud_warning.created", created: 1790856000, data: { object: { id: "iss_unknown" } } });
const ignored = ingestStripeProviderEvent({ receipt: verified(unknownRaw, "evt_unknown", "radar.early_fraud_warning.created"), rawPayload: unknownRaw, existing: [] });
assert.equal(ignored.status, "ignored");
assert.equal(ignored.lastErrorCode, "UNSUPPORTED_EVENT_TYPE");

console.log("Commercial provider Block 8 Build 036: PASS");

const draftSubscription = createCompanySubscription({ id: "internal-sub-037", companyId: 37, planId: "team", catalogPriceVersion: 3, billingCycle: "annual", currency: "USD", amount: 2490, now: "2026-10-01T12:00:00Z" });
const pendingSubscription = transitionSubscription({ subscription: draftSubscription, to: "pending", expectedRevision: 1, now: "2026-10-01T12:01:00Z" });
const readyOrder = createCommercialOrder({ id: "order-037", subscription: draftSubscription, subtotal: 2490, tax: 0, expiresAt: "2026-10-02T12:00:00Z", now: "2026-10-01T12:00:00Z" });
const submittedOrder = transitionCommercialOrder({ order: readyOrder, to: "submitted", expectedRevision: 1, now: "2026-10-01T12:01:00Z" });
const createdAttempt = createCheckoutAttempt({ id: "attempt-037", order: submittedOrder, provider: "stripe", idempotencyKey: "order-037-attempt-0001", existing: [], now: "2026-10-01T12:02:00Z" });
const redirectedAttempt = Object.freeze({ ...createdAttempt, status: "redirect_ready" as const, providerReference: "cs_037" });
const checkout037Raw = JSON.stringify({ id: "evt_037", type: "checkout.session.completed", created: 1790856000, data: { object: { id: "cs_037", customer: "cus_037", subscription: "sub_stripe_037", payment_status: "paid", currency: "usd", amount_total: 249000, metadata: { order_id: submittedOrder.id, subscription_id: pendingSubscription.id, company_id: "37" } } } });
const intake037 = ingestStripeProviderEvent({ receipt: verified(checkout037Raw, "evt_037", "checkout.session.completed"), rawPayload: checkout037Raw, existing: [] });
const completion037 = applyStripeCheckoutCompleted({ event: intake037, rawPayload: checkout037Raw, attempt: redirectedAttempt, order: submittedOrder, subscription: pendingSubscription, now: "2026-10-01T12:03:00Z" });
assert.deepEqual({ event: completion037.event.status, attempt: completion037.attempt.status, order: completion037.order.status, subscription: completion037.subscription.status }, { event: "applied", attempt: "completed", order: "accepted", subscription: "active" });
assert.throws(() => applyStripeCheckoutCompleted({ event: intake037, rawPayload: checkout037Raw.replace("249000", "249001"), attempt: redirectedAttempt, order: submittedOrder, subscription: pendingSubscription, now: "2026-10-01T12:03:00Z" }), /does not match/);

console.log("Commercial provider Block 8 Build 037: PASS");

const subscription038Raw = JSON.stringify({ id: "evt_038", type: "customer.subscription.updated", created: 1790856100, data: { object: { id: "sub_stripe_038", customer: "cus_038", status: "past_due", metadata: { subscription_id: completion037.subscription.id, company_id: "37" } } } });
const event038 = ingestStripeProviderEvent({ receipt: verified(subscription038Raw, "evt_038", "customer.subscription.updated"), rawPayload: subscription038Raw, existing: [intake037] });
const synchronized038 = applyStripeSubscriptionEvent({ event: event038, rawPayload: subscription038Raw, binding: { subscriptionId: completion037.subscription.id, companyId: 37, providerSubscriptionReference: "sub_stripe_038", providerCustomerReference: "cus_038" }, subscription: completion037.subscription, now: "2026-10-01T12:05:00Z" });
assert.equal(synchronized038.subscription.status, "past_due");
assert.equal(synchronized038.event.status, "applied");
assert.throws(() => applyStripeSubscriptionEvent({ event: event038, rawPayload: subscription038Raw, binding: { subscriptionId: completion037.subscription.id, companyId: 37, providerSubscriptionReference: "sub_other", providerCustomerReference: "cus_038" }, subscription: completion037.subscription, now: "2026-10-01T12:05:00Z" }), /binding is invalid/);

console.log("Commercial provider Block 8 Build 038: PASS");

const invoice039Raw = JSON.stringify({ id: "evt_invoice_039", type: "invoice.paid", created: 1790856200, data: { object: { id: "in_039", number: "BIM-2026-0039", customer: "cus_038", subscription: "sub_stripe_038", currency: "usd", amount_paid: 249000, metadata: { subscription_id: completion037.subscription.id, company_id: "37" } } } });
const invoiceEvent039 = ingestStripeProviderEvent({ receipt: verified(invoice039Raw, "evt_invoice_039", "invoice.paid"), rawPayload: invoice039Raw, existing: [intake037, event038] });
const paid039 = applyStripeInvoicePaid({ event: invoiceEvent039, rawPayload: invoice039Raw, binding: { subscriptionId: completion037.subscription.id, companyId: 37, providerSubscriptionReference: "sub_stripe_038", providerCustomerReference: "cus_038" }, completion: completion037, existingInvoices: [], now: "2026-10-01T12:06:00Z" });
assert.equal(paid039.invoice.totalCents, 249000);
assert.equal(paid039.event.status, "applied");

const refund039Raw = JSON.stringify({ id: "evt_refund_039", type: "charge.refunded", created: 1790856300, data: { object: { id: "ch_039", currency: "usd", amount_refunded: 5000, metadata: { invoice_id: paid039.invoice.id } } } });
const refundEvent039 = ingestStripeProviderEvent({ receipt: verified(refund039Raw, "evt_refund_039", "charge.refunded"), rawPayload: refund039Raw, existing: [intake037, event038, invoiceEvent039] });
const refund039 = applyStripeRefund({ event: refundEvent039, rawPayload: refund039Raw, invoice: paid039.invoice, priorCredits: [], reason: "Approved service credit", now: "2026-10-01T12:07:00Z" });
assert.equal(refund039.credit.amountCents, 5000);
assert.equal(refund039.credit.status, "partial_refund");
assert.throws(() => applyStripeRefund({ event: refundEvent039, rawPayload: refund039Raw.replace("5000", "250000"), invoice: paid039.invoice, priorCredits: [], reason: "Approved service credit", now: "2026-10-01T12:07:00Z" }), /does not match/);

console.log("Commercial provider Block 8 Build 039: PASS");

const unresolved040 = markCommercialProviderEventUnresolved({ event: event038, errorCode: "LINEAGE_NOT_FOUND", nextRetryAt: "2026-10-01T12:10:00Z", now: "2026-10-01T12:08:00Z" });
const customerView040 = projectCommercialProviderReconciliation({ events: [completion037.event, paid039.event, refund039.event, unresolved040, ignored], role: "customer_admin" });
assert.equal(customerView040.status, "action_required");
assert.deepEqual(customerView040.counts, { pending: 0, ignored: 1, applied: 3, unresolved: 1 });
assert.equal(customerView040.issues[0]?.providerEventId, null);
const auditView040 = projectCommercialProviderReconciliation({ events: [unresolved040], role: "auditor" });
assert.equal(auditView040.issues[0]?.providerEventId, "evt_038");
assert.throws(() => retryCommercialProviderEvent({ event: unresolved040, expectedAttemptCount: 1, now: "2026-10-01T12:09:59Z" }), /has not arrived/);
const retry040 = retryCommercialProviderEvent({ event: unresolved040, expectedAttemptCount: 1, now: "2026-10-01T12:10:00Z" });
assert.equal(retry040.status, "pending");
assert.equal(retry040.lastErrorCode, "LINEAGE_NOT_FOUND");

console.log("Commercial provider Block 8 Build 040: PASS");
