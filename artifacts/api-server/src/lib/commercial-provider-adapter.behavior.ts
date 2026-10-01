import assert from "node:assert/strict";
import { createStripeCheckoutSession, inspectStripeCommercialConfiguration } from "./commercial-provider-adapter";
import { createCheckoutAttempt, createCommercialOrder, createCompanySubscription, transitionCommercialOrder } from "./subscription-authority";

const configured = inspectStripeCommercialConfiguration({
  secretKey: "sk_test_bimlog_1234567890", webhookSecret: "whsec_bimlog_1234567890",
  portalConfigurationId: "bpc_bimlog", appOrigin: "https://app.bimlog.com/",
});
assert.deepEqual({ provider: configured.readiness.provider, mode: configured.readiness.mode, configured: configured.readiness.configured, portal: configured.readiness.portalConfigured, origin: configured.readiness.appOrigin }, { provider: "stripe", mode: "test", configured: true, portal: true, origin: "https://app.bimlog.com" });
assert.equal(configured.readiness.fingerprint.length, 64);
assert.equal("secretKey" in configured.readiness, false);
assert.equal("webhookSecret" in configured.readiness, false);
assert.equal(configured.configuration?.secretKey, "sk_test_bimlog_1234567890");

const incomplete = inspectStripeCommercialConfiguration({ secretKey: "", webhookSecret: "", appOrigin: "https://app.bimlog.com" });
assert.deepEqual(incomplete.readiness.missing, ["secret_key", "webhook_secret"]);
assert.equal(incomplete.configuration, null);
assert.throws(() => inspectStripeCommercialConfiguration({ secretKey: "sk_test_bimlog_1234567890", webhookSecret: "whsec_bimlog_1234567890", appOrigin: "http://evil.example" }), /must use HTTPS/);
assert.throws(() => inspectStripeCommercialConfiguration({ secretKey: "sk_test_bimlog_1234567890", webhookSecret: "whsec_bimlog_1234567890", appOrigin: "https://app.bimlog.com/path" }), /must not contain a path/);

const subscription = createCompanySubscription({ id: "sub-31", companyId: 31, planId: "team", catalogPriceVersion: 3, billingCycle: "annual", currency: "USD", amount: 2490, now: "2026-10-01T04:00:00Z" });
const readyOrder = createCommercialOrder({ id: "order-31", subscription, subtotal: 2490, tax: 0, expiresAt: "2026-10-02T04:00:00Z", now: subscription.createdAt });
const order = transitionCommercialOrder({ order: readyOrder, to: "submitted", expectedRevision: 1, now: "2026-10-01T04:01:00Z" });
const attempt = createCheckoutAttempt({ id: "attempt-31", order, provider: "stripe", idempotencyKey: "order-31-attempt-0001", existing: [], now: "2026-10-01T04:02:00Z" });
const customer = Object.freeze({ id: "binding-31", companyId: 31, billingProfileRevision: 1, provider: "stripe", providerCustomerReference: "cus_company_31", status: "active" as const, createdAt: "2026-10-01T04:00:00.000Z" });
let checkoutRequest: Parameters<NonNullable<Parameters<typeof createStripeCheckoutSession>[0]["transport"]>>[0] | undefined;
const checkout = await createStripeCheckoutSession({ configuration: configured.configuration!, order, attempt, customer, priceReference: "price_team_annual", transport: async (request) => {
  checkoutRequest = request;
  return { status: 200, body: { id: "cs_test_bimlog_31", url: "https://checkout.stripe.com/c/pay/bimlog31", expires_at: 1790829000 } };
} });
assert.equal(checkout.providerSessionId, "cs_test_bimlog_31");
assert.equal(checkoutRequest?.path, "/v1/checkout/sessions");
assert.equal(checkoutRequest?.headers["Idempotency-Key"], attempt.idempotencyKey);
assert.equal(checkoutRequest?.body.get("metadata[order_id]"), order.id);
assert.equal(checkoutRequest?.body.get("line_items[0][price]"), "price_team_annual");
assert.equal(checkoutRequest?.body.get("mode"), "subscription");
await assert.rejects(() => createStripeCheckoutSession({ configuration: configured.configuration!, order, attempt, customer, priceReference: "price_team_annual", transport: async () => ({ status: 200, body: { id: "cs_test_bad", url: "https://evil.example/pay", expires_at: 1790829000 } }) }), /untrusted hosted URL/);

console.log("Commercial provider Block 7 Build 032: PASS");
