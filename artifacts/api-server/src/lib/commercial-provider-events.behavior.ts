import assert from "node:assert/strict";
import crypto from "node:crypto";
import { applyStripeCheckoutCompleted, ingestStripeProviderEvent } from "./commercial-provider-events";
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
