import assert from "node:assert/strict";
import { createStripeBillingPortalLaunch, createStripeCheckoutSession, createStripeTransport, inspectStripeCommercialConfiguration, verifyStripeWebhook } from "./commercial-provider-adapter";
import crypto from "node:crypto";
import { createBillingPortalSession, createCheckoutAttempt, createCommercialOrder, createCompanySubscription, transitionCommercialOrder } from "./subscription-authority";

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

const webhookTimestamp = 1790829120;
const webhookPayload = JSON.stringify({ id: "evt_bimlog_31", type: "checkout.session.completed", data: { object: { id: checkout.providerSessionId } } });
const webhookSignature = crypto.createHmac("sha256", configured.configuration!.webhookSecret).update(`${webhookTimestamp}.${webhookPayload}`).digest("hex");
const receipt = verifyStripeWebhook({ rawPayload: webhookPayload, signatureHeader: `t=${webhookTimestamp},v1=00,v1=${webhookSignature}`, webhookSecret: configured.configuration!.webhookSecret, nowEpochSeconds: webhookTimestamp + 15, priorReceipts: [] });
assert.deepEqual({ provider: receipt.provider, id: receipt.eventId, type: receipt.eventType }, { provider: "stripe", id: "evt_bimlog_31", type: "checkout.session.completed" });
assert.equal(receipt.payloadDigest.length, 64);
assert.throws(() => verifyStripeWebhook({ rawPayload: webhookPayload, signatureHeader: `t=${webhookTimestamp},v1=${webhookSignature}`, webhookSecret: configured.configuration!.webhookSecret, nowEpochSeconds: webhookTimestamp + 301, priorReceipts: [] }), /replay window/);
assert.throws(() => verifyStripeWebhook({ rawPayload: `${webhookPayload} `, signatureHeader: `t=${webhookTimestamp},v1=${webhookSignature}`, webhookSecret: configured.configuration!.webhookSecret, nowEpochSeconds: webhookTimestamp, priorReceipts: [] }), /signature is invalid/);
assert.throws(() => verifyStripeWebhook({ rawPayload: webhookPayload, signatureHeader: `t=${webhookTimestamp},v1=${webhookSignature}`, webhookSecret: configured.configuration!.webhookSecret, nowEpochSeconds: webhookTimestamp, priorReceipts: [receipt] }), /already received/);

const internalPortal = createBillingPortalSession({ id: "portal-launch-31", customer, requestedBy: "billing-admin-31", returnPath: "/settings/billing", now: "2026-10-01T04:05:00Z" });
let portalRequest: Parameters<NonNullable<Parameters<typeof createStripeBillingPortalLaunch>[0]["transport"]>>[0] | undefined;
const portal = await createStripeBillingPortalLaunch({ configuration: configured.configuration!, session: internalPortal, customer, transport: async (request) => {
  portalRequest = request;
  return { status: 200, body: { id: "bps_bimlog_31", customer: customer.providerCustomerReference, url: "https://billing.stripe.com/p/session/bimlog31" } };
} });
assert.equal(portal.providerSessionId, "bps_bimlog_31");
assert.equal(portalRequest?.path, "/v1/billing_portal/sessions");
assert.equal(portalRequest?.body.get("customer"), customer.providerCustomerReference);
assert.equal(portalRequest?.body.get("return_url"), "https://app.bimlog.com/settings/billing");
assert.equal(portalRequest?.body.get("configuration"), "bpc_bimlog");
assert.equal(portalRequest?.headers["Idempotency-Key"], internalPortal.id);
await assert.rejects(() => createStripeBillingPortalLaunch({ configuration: configured.configuration!, session: internalPortal, customer, transport: async () => ({ status: 200, body: { id: "bps_bad", customer: customer.providerCustomerReference, url: "https://evil.example/portal" } }) }), /untrusted hosted URL/);

let transportUrl = "";
let transportInit: RequestInit | undefined;
const transport = createStripeTransport({ fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
  transportUrl = String(url); transportInit = init;
  return new Response(JSON.stringify({ id: "cs_test_transport" }), { status: 200, headers: { "content-type": "application/json", "content-length": "26" } });
}) as typeof fetch });
const transportResponse = await transport({ method: "POST", path: "/v1/checkout/sessions", headers: { Authorization: "Bearer test-secret", "Idempotency-Key": "transport-1" }, body: new URLSearchParams({ mode: "subscription" }) });
assert.equal(transportUrl, "https://api.stripe.com/v1/checkout/sessions");
assert.equal(transportInit?.method, "POST");
assert.equal(transportInit?.body, "mode=subscription");
assert.equal(transportResponse.status, 200);
assert.deepEqual(transportResponse.body, { id: "cs_test_transport" });
await assert.rejects(() => createStripeTransport({ maxResponseBytes: 1024, fetchImpl: (async () => new Response("x".repeat(1025), { status: 500 })) as typeof fetch })({ method: "POST", path: "/v1/test", headers: {}, body: new URLSearchParams() }), /size limit/);
await assert.rejects(() => transport({ method: "POST", path: "/v1/../secrets", headers: {}, body: new URLSearchParams() }), /path is invalid/);

console.log("Commercial provider Block 7 Build 035: PASS");
