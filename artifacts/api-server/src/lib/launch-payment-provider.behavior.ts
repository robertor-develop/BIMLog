import assert from "node:assert/strict";
import { inspectLaunchPaymentSelection } from "./launch-payment-provider";

const manual = inspectLaunchPaymentSelection({ enabledMethods: ["bank_transfer"], bankReady: true, qrReady: false, stripeConfigured: false });
assert.equal(manual.ready, true);
assert.equal(manual.capabilities.find((item) => item.method === "bank_transfer")?.state, "PRODUCTION_CONFIGURED");
assert.equal(manual.capabilities.find((item) => item.method === "qr_payment")?.state, "DISABLED");
const sandbox = inspectLaunchPaymentSelection({ enabledMethods: ["stripe"], stripeMode: "sandbox", bankReady: false, qrReady: false, stripeConfigured: true, stripeVerified: true });
assert.equal(sandbox.capabilities[2]?.state, "SANDBOX_VERIFIED");
assert.deepEqual(inspectLaunchPaymentSelection({ enabledMethods: [], bankReady: false, qrReady: false, stripeConfigured: false }).issues, ["payment_method_required"]);
assert.match(inspectLaunchPaymentSelection({ enabledMethods: ["paypal"], bankReady: false, qrReady: false, stripeConfigured: false }).issues.join("|"), /unsupported:paypal/);
console.log("LAUNCH_PAYMENT_BUILD_21=PASS optionalMethods=true truthfulCapabilities=true unsupportedRefused=true");
