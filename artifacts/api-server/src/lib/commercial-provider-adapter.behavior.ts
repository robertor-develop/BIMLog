import assert from "node:assert/strict";
import { inspectStripeCommercialConfiguration } from "./commercial-provider-adapter";

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

console.log("Commercial provider Block 7 Build 031: PASS");
