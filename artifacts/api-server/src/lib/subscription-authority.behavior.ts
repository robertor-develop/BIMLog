import assert from "node:assert/strict";
import { createCompanySubscription, SUBSCRIPTION_PLAN_IDS, transitionSubscription } from "./subscription-authority";

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

console.log("Commercial subscription Builds 011-012 company record and lifecycle: PASS");
