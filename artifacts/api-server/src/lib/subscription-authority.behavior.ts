import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  appendCommercialAuditEvent,
  applyCheckoutCompletion,
  changeSeatQuantity,
  createCompanySubscription,
  createCommercialOrder,
  createCheckoutAttempt,
  createEntitlementSnapshot,
  createPaidInvoice,
  createSeatQuantity,
  createSubscriptionTerm,
  recordCollectionFailure,
  scheduleSubscriptionCancellation,
  applyScheduledCancellation,
  SUBSCRIPTION_PLAN_IDS,
  transitionSubscription,
  transitionCommercialOrder,
  verifyEntitlementSnapshot,
  verifyCommercialAuditHistory,
  verifyAndReceiveProviderEvent,
} from "./subscription-authority";

assert.deepEqual(SUBSCRIPTION_PLAN_IDS, ["free", "professional", "team", "business", "enterprise"]);
const subscription = createCompanySubscription({
  id: "sub-company-7", companyId: 7, planId: "team", catalogPriceVersion: 1,
  billingCycle: "annual", currency: "USD", amount: 2490, now: "2026-09-30T20:00:00Z",
});
assert.deepEqual(subscription, {
  id: "sub-company-7", companyId: 7, planId: "team", catalogPriceVersion: 1,
  billingCycle: "annual", currency: "USD", amount: 2490, status: "draft", revision: 1,
  createdAt: "2026-09-30T20:00:00.000Z", updatedAt: "2026-09-30T20:00:00.000Z",
});
assert.throws(() => createCompanySubscription({ ...subscription, companyId: 0, now: subscription.createdAt }), /valid company/);
assert.throws(() => createCompanySubscription({ ...subscription, catalogPriceVersion: 0, now: subscription.createdAt }), /catalog price version/);
const pending = transitionSubscription({ subscription, to: "pending", expectedRevision: 1, now: "2026-09-30T20:01:00Z" });
const active = transitionSubscription({ subscription: pending, to: "active", expectedRevision: 2, now: "2026-09-30T20:02:00Z" });
const pastDue = transitionSubscription({ subscription: active, to: "past_due", expectedRevision: 3, now: "2026-09-30T20:03:00Z" });
const recovered = transitionSubscription({ subscription: pastDue, to: "active", expectedRevision: 4, now: "2026-09-30T20:04:00Z" });
assert.equal(recovered.revision, 5);
assert.throws(() => transitionSubscription({ subscription: recovered, to: "pending", expectedRevision: 5, now: "2026-09-30T20:05:00Z" }), /not allowed/);
assert.throws(() => transitionSubscription({ subscription: recovered, to: "cancelled", expectedRevision: 4, now: "2026-09-30T20:05:00Z" }), /stale/);

const memberSeats = createSeatQuantity({
  subscriptionId: recovered.id, seatClass: "member", purchased: 12, assigned: 7,
  now: "2026-09-30T20:06:00Z",
});
const expandedSeats = changeSeatQuantity({
  quantity: memberSeats, purchased: 20, expectedRevision: 1, now: "2026-09-30T20:07:00Z",
});
const assignedSeats = changeSeatQuantity({
  quantity: expandedSeats, assigned: 15, expectedRevision: 2, now: "2026-09-30T20:08:00Z",
});
assert.deepEqual(
  { purchased: assignedSeats.purchased, assigned: assignedSeats.assigned, revision: assignedSeats.revision },
  { purchased: 20, assigned: 15, revision: 3 },
);
assert.throws(() => changeSeatQuantity({ quantity: assignedSeats, purchased: 14, expectedRevision: 3, now: "2026-09-30T20:09:00Z" }), /cannot exceed/);
assert.throws(() => changeSeatQuantity({ quantity: assignedSeats, purchased: 25, expectedRevision: 2, now: "2026-09-30T20:09:00Z" }), /stale/);
assert.throws(() => createSeatQuantity({ subscriptionId: recovered.id, seatClass: "viewer", purchased: -1, now: recovered.updatedAt }), /non-negative integer/);

const snapshot = createEntitlementSnapshot({ subscription: recovered, seatQuantities: [assignedSeats], effectiveAt: "2026-09-30T20:10:00Z" });
const sameSnapshot = createEntitlementSnapshot({ subscription: recovered, seatQuantities: [assignedSeats], effectiveAt: "2026-09-30T20:10:00Z" });
assert.equal(snapshot.enabled, true);
assert.equal(snapshot.fingerprint, sameSnapshot.fingerprint);
assert.equal(snapshot.subscriptionRevision, recovered.revision);
assert.ok(snapshot.capabilities.includes("team.manage"));
assert.equal(verifyEntitlementSnapshot(snapshot), true);
assert.equal(verifyEntitlementSnapshot({ ...snapshot, planId: "enterprise" }), false);
const suspended = transitionSubscription({ subscription: recovered, to: "suspended", expectedRevision: 5, now: "2026-09-30T20:11:00Z" });
const suspendedSnapshot = createEntitlementSnapshot({ subscription: suspended, seatQuantities: [assignedSeats], effectiveAt: "2026-09-30T20:11:00Z" });
assert.equal(suspendedSnapshot.enabled, false);
assert.deepEqual(suspendedSnapshot.capabilities, []);
assert.notEqual(suspendedSnapshot.fingerprint, snapshot.fingerprint);
assert.throws(() => createEntitlementSnapshot({ subscription: recovered, seatQuantities: [{ ...assignedSeats, subscriptionId: "sub-other" }], effectiveAt: recovered.updatedAt }), /another subscription/);

const createdEvent = appendCommercialAuditEvent({
  history: [], subscription, action: "subscription.created", actorId: "user-42",
  reason: "Company selected the Team annual plan", occurredAt: subscription.createdAt,
  details: { planId: subscription.planId, amount: subscription.amount },
});
const activatedEvent = appendCommercialAuditEvent({
  history: [createdEvent], subscription: active, action: "subscription.transitioned", actorId: "billing-worker",
  reason: "Payment provider confirmed the subscription", occurredAt: active.updatedAt,
  details: { from: "pending", to: "active" },
});
const auditHistory = [createdEvent, activatedEvent];
assert.equal(activatedEvent.sequence, 2);
assert.equal(activatedEvent.previousDigest, createdEvent.digest);
assert.equal(verifyCommercialAuditHistory(auditHistory), true);
assert.equal(verifyCommercialAuditHistory([createdEvent, { ...activatedEvent, reason: "altered" }]), false);
assert.throws(() => appendCommercialAuditEvent({ history: auditHistory, subscription: recovered, action: "seats.changed", actorId: "", reason: "Seat update", occurredAt: recovered.updatedAt }), /actor/);
assert.throws(() => appendCommercialAuditEvent({ history: [{ ...createdEvent, digest: "tampered" }], subscription, action: "subscription.transitioned", actorId: "user-42", reason: "Activate", occurredAt: pending.updatedAt }), /history is invalid/);

const order = createCommercialOrder({ id: "ord-company-7", subscription, subtotal: 2490, tax: 174.3, expiresAt: "2026-10-30T20:00:00Z", now: subscription.createdAt });
assert.deepEqual({ companyId: order.companyId, planId: order.planId, total: order.total, status: order.status, revision: order.revision }, { companyId: 7, planId: "team", total: 2664.3, status: "ready", revision: 1 });
const taxPendingOrder = createCommercialOrder({ subscription, subtotal: 2490, expiresAt: "2026-10-30T20:00:00Z", now: subscription.createdAt });
assert.equal(taxPendingOrder.status, "draft");
assert.equal(taxPendingOrder.total, null);
assert.throws(() => createCommercialOrder({ subscription, subtotal: -1, expiresAt: "2026-10-30T20:00:00Z", now: subscription.createdAt }), /subtotal/);
assert.throws(() => createCommercialOrder({ subscription, subtotal: 2490, tax: 0, expiresAt: subscription.createdAt, now: subscription.createdAt }), /future/);
const finalizedOrder = transitionCommercialOrder({ order: taxPendingOrder, to: "ready", expectedRevision: 1, tax: 174.3, now: "2026-09-30T20:11:00Z" });
const submittedOrder = transitionCommercialOrder({ order: finalizedOrder, to: "submitted", expectedRevision: 2, now: "2026-09-30T20:12:00Z" });
assert.deepEqual({ status: submittedOrder.status, total: submittedOrder.total, revision: submittedOrder.revision }, { status: "submitted", total: 2664.3, revision: 3 });
assert.throws(() => transitionCommercialOrder({ order: submittedOrder, to: "accepted", expectedRevision: 2, now: "2026-09-30T20:13:00Z" }), /stale/);
assert.throws(() => transitionCommercialOrder({ order, to: "accepted", expectedRevision: 1, now: "2026-09-30T20:13:00Z" }), /not allowed/);
assert.throws(() => transitionCommercialOrder({ order: taxPendingOrder, to: "ready", expectedRevision: 1, now: "2026-09-30T20:11:00Z" }), /finalized tax/);
const checkout = createCheckoutAttempt({ id: "checkout-1", order: submittedOrder, provider: " Stripe ", idempotencyKey: "company-7-order-20260930", existing: [], now: "2026-09-30T20:13:00Z" });
assert.deepEqual({ provider: checkout.provider, amount: checkout.amount, status: checkout.status }, { provider: "stripe", amount: 2664.3, status: "created" });
assert.equal(createCheckoutAttempt({ order: submittedOrder, provider: "stripe", idempotencyKey: checkout.idempotencyKey, existing: [checkout], now: "2026-09-30T20:14:00Z" }), checkout);
assert.throws(() => createCheckoutAttempt({ order: { ...submittedOrder, total: 1 }, provider: "stripe", idempotencyKey: checkout.idempotencyKey, existing: [checkout], now: "2026-09-30T20:14:00Z" }), /conflicts/);
assert.throws(() => createCheckoutAttempt({ order, provider: "stripe", idempotencyKey: "company-7-order-20260930", existing: [], now: "2026-09-30T20:14:00Z" }), /submitted order/);
const providerPayload = JSON.stringify({ id: "evt-1", type: "checkout.completed", checkoutId: checkout.id, orderId: submittedOrder.id });
const providerIssuedAt = 1790799300;
const providerSecret = "test-only-signing-secret";
const providerSignature = crypto.createHmac("sha256", providerSecret).update(`${providerIssuedAt}.${providerPayload}`).digest("hex");
const providerReceipt = verifyAndReceiveProviderEvent({ provider: "stripe", eventId: "evt-1", eventType: "checkout.completed", rawPayload: providerPayload, signatureHex: providerSignature, signingSecret: providerSecret, issuedAtEpochSeconds: providerIssuedAt, nowEpochSeconds: providerIssuedAt + 10, priorReceipts: [] });
assert.equal(providerReceipt.eventId, "evt-1");
assert.equal(providerReceipt.payloadDigest.length, 64);
assert.throws(() => verifyAndReceiveProviderEvent({ provider: "stripe", eventId: "evt-1", eventType: "checkout.completed", rawPayload: providerPayload, signatureHex: providerSignature, signingSecret: providerSecret, issuedAtEpochSeconds: providerIssuedAt, nowEpochSeconds: providerIssuedAt + 10, priorReceipts: [providerReceipt] }), /already received/);
assert.throws(() => verifyAndReceiveProviderEvent({ provider: "stripe", eventId: "evt-2", eventType: "checkout.completed", rawPayload: providerPayload, signatureHex: "00", signingSecret: providerSecret, issuedAtEpochSeconds: providerIssuedAt, nowEpochSeconds: providerIssuedAt + 10, priorReceipts: [] }), /signature/);
assert.throws(() => verifyAndReceiveProviderEvent({ provider: "stripe", eventId: "evt-2", eventType: "checkout.completed", rawPayload: providerPayload, signatureHex: providerSignature, signingSecret: providerSecret, issuedAtEpochSeconds: providerIssuedAt, nowEpochSeconds: providerIssuedAt + 301, priorReceipts: [] }), /replay window/);
const checkoutCompletion = applyCheckoutCompletion({ receipt: providerReceipt, rawPayload: providerPayload, attempt: checkout, order: submittedOrder, subscription: pending, now: "2026-09-30T20:16:00Z" });
assert.deepEqual({ checkout: checkoutCompletion.attempt.status, reference: checkoutCompletion.attempt.providerReference, order: checkoutCompletion.order.status, subscription: checkoutCompletion.subscription.status }, { checkout: "completed", reference: "evt-1", order: "accepted", subscription: "active" });
assert.throws(() => applyCheckoutCompletion({ receipt: providerReceipt, rawPayload: `${providerPayload} `, attempt: checkout, order: submittedOrder, subscription: pending, now: "2026-09-30T20:16:00Z" }), /does not match/);
assert.throws(() => applyCheckoutCompletion({ receipt: providerReceipt, rawPayload: providerPayload, attempt: checkout, order: submittedOrder, subscription, now: "2026-09-30T20:16:00Z" }), /pending subscription/);

const paidInvoice = createPaidInvoice({ id: "inv-1", invoiceNumber: "BIM-2026-0001", completion: checkoutCompletion, existing: [], issuedAt: "2026-09-30T20:17:00Z" });
assert.deepEqual({ status: paidInvoice.status, subtotal: paidInvoice.subtotalCents, tax: paidInvoice.taxCents, total: paidInvoice.totalCents, reference: paidInvoice.providerReference }, { status: "paid", subtotal: 249000, tax: 17430, total: 266430, reference: "evt-1" });
assert.throws(() => createPaidInvoice({ invoiceNumber: paidInvoice.invoiceNumber, completion: checkoutCompletion, existing: [paidInvoice], issuedAt: paidInvoice.issuedAt }), /already exists/);
assert.throws(() => createPaidInvoice({ invoiceNumber: "BIM-2026-0002", completion: { ...checkoutCompletion, attempt: { ...checkoutCompletion.attempt, amount: 1 } }, existing: [], issuedAt: paidInvoice.issuedAt }), /does not match/);

const firstTerm = createSubscriptionTerm({ subscription: checkoutCompletion.subscription, invoice: paidInvoice, priorTerms: [], startsAt: "2026-09-30T20:17:00Z", automaticRenewal: true });
assert.deepEqual({ sequence: firstTerm.sequence, startsAt: firstTerm.startsAt, endsAt: firstTerm.endsAt, renewsAt: firstTerm.renewsAt }, { sequence: 1, startsAt: "2026-09-30T20:17:00.000Z", endsAt: "2027-09-30T20:17:00.000Z", renewsAt: "2027-09-30T20:17:00.000Z" });
const secondTerm = createSubscriptionTerm({ subscription: checkoutCompletion.subscription, invoice: paidInvoice, priorTerms: [firstTerm], startsAt: firstTerm.endsAt, automaticRenewal: false });
assert.equal(secondTerm.sequence, 2);
assert.equal(secondTerm.renewsAt, null);
assert.throws(() => createSubscriptionTerm({ subscription: checkoutCompletion.subscription, invoice: paidInvoice, priorTerms: [firstTerm], startsAt: "2027-10-01T20:17:00Z", automaticRenewal: true }), /prior term boundary/);

const failedPayload = JSON.stringify({ subscriptionId: checkoutCompletion.subscription.id, termSequence: firstTerm.sequence });
const failedSignature = crypto.createHmac("sha256", providerSecret).update(`${providerIssuedAt}.${failedPayload}`).digest("hex");
const failedReceipt = verifyAndReceiveProviderEvent({ provider: "stripe", eventId: "evt-failed-1", eventType: "invoice.payment_failed", rawPayload: failedPayload, signatureHex: failedSignature, signingSecret: providerSecret, issuedAtEpochSeconds: providerIssuedAt, nowEpochSeconds: providerIssuedAt + 10, priorReceipts: [] });
const collectionFailure = recordCollectionFailure({ id: "collection-1", subscription: checkoutCompletion.subscription, term: firstTerm, receipt: failedReceipt, nextRetryAt: "2026-10-02T20:17:00Z", graceEndsAt: "2026-10-08T20:17:00Z", now: "2026-10-01T20:17:00Z" });
assert.deepEqual({ subscription: collectionFailure.subscription.status, status: collectionFailure.collection.status, attempts: collectionFailure.collection.failedAttempts }, { subscription: "past_due", status: "retry_scheduled", attempts: 1 });
assert.throws(() => recordCollectionFailure({ subscription: collectionFailure.subscription, term: firstTerm, receipt: failedReceipt, existing: collectionFailure.collection, nextRetryAt: null, graceEndsAt: "2026-10-08T20:17:00Z", now: "2026-10-02T20:17:00Z" }), /already applied/);
assert.throws(() => recordCollectionFailure({ subscription: checkoutCompletion.subscription, term: firstTerm, receipt: failedReceipt, nextRetryAt: "2026-10-09T20:17:00Z", graceEndsAt: "2026-10-08T20:17:00Z", now: "2026-10-01T20:17:00Z" }), /inside the grace/);

const cancellation = scheduleSubscriptionCancellation({ id: "cancel-1", subscription: checkoutCompletion.subscription, term: firstTerm, requestedBy: "company-admin-7", reason: "Company requested non-renewal", requestedAt: "2027-09-01T12:00:00Z" });
assert.deepEqual({ status: cancellation.status, effectiveAt: cancellation.effectiveAt, actor: cancellation.requestedBy }, { status: "scheduled", effectiveAt: firstTerm.endsAt, actor: "company-admin-7" });
assert.throws(() => applyScheduledCancellation({ subscription: checkoutCompletion.subscription, cancellation, now: "2027-09-29T12:00:00Z" }), /has not arrived/);
const cancelledAtTerm = applyScheduledCancellation({ subscription: checkoutCompletion.subscription, cancellation, now: firstTerm.endsAt });
assert.deepEqual({ subscription: cancelledAtTerm.subscription.status, cancellation: cancelledAtTerm.cancellation.status, appliedAt: cancelledAtTerm.cancellation.appliedAt }, { subscription: "cancelled", cancellation: "applied", appliedAt: firstTerm.endsAt });
assert.throws(() => scheduleSubscriptionCancellation({ subscription: checkoutCompletion.subscription, term: firstTerm, requestedBy: "company-admin-7", reason: "Late request", requestedAt: firstTerm.endsAt }), /before the term ends/);

console.log("Commercial billing Block 5 Build 024: PASS");
