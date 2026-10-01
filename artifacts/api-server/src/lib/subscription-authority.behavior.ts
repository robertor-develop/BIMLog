import assert from "node:assert/strict";
import {
  changeSeatQuantity,
  createCompanySubscription,
  createSeatQuantity,
  SUBSCRIPTION_PLAN_IDS,
  transitionSubscription,
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

console.log("Commercial subscription Builds 011-013 company record, lifecycle, and seats: PASS");
