import assert from "node:assert/strict";
import { verifyLaunchPaymentMethod } from "./launch-payment-verification";

assert.equal((await verifyLaunchPaymentMethod({ method: "bank_transfer", configurationReady: true })).status, "configured");
assert.equal((await verifyLaunchPaymentMethod({ method: "qr_payment", configurationReady: false })).code, "configuration_invalid");
assert.equal((await verifyLaunchPaymentMethod({ method: "stripe", mode: "sandbox", configurationReady: true, accountReference: "acct_test", secretKey: "synthetic-secret", webhookSecret: "synthetic-webhook" })).status, "unavailable");
const verified = await verifyLaunchPaymentMethod({ method: "stripe", mode: "sandbox", configurationReady: true, accountReference: "acct_test", secretKey: "synthetic-secret", webhookSecret: "synthetic-webhook", stripeAdapter: async ({ mode }) => ({ method: "stripe", mode, status: "verified", code: "provider_connection_verified" }) });
assert.equal(verified.status, "verified");
console.log("LAUNCH_PAYMENT_BUILD_26=PASS manualNoTransaction=true providerAdapter=true unavailableTruthful=true");
