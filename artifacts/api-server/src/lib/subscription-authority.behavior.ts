import assert from "node:assert/strict";
import {
  appendCommercialAuditEvent,
  changeSeatQuantity,
  createCompanySubscription,
  createCommercialOrder,
  createEntitlementSnapshot,
  createSeatQuantity,
  SUBSCRIPTION_PLAN_IDS,
  transitionSubscription,
  transitionCommercialOrder,
  verifyEntitlementSnapshot,
  verifyCommercialAuditHistory,
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

console.log("Commercial subscription Block 3 Builds 011-015: PASS");
