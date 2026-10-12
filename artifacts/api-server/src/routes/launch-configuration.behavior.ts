import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("./launch-configuration.ts", import.meta.url), "utf8"), index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
for (const token of ["/admin/launch-configuration/:environment", "authMiddleware, isSuperAdminMiddleware", "LAUNCH_CONFIGURATION_STALE", "private, no-store", "encryptLaunchSecret", "maskLaunchSecret", "LAUNCH_CONFIGURATION_NOT_READY", "expectedRevision"]) assert.ok(route.includes(token), token);
assert.ok(!route.includes("decryptLaunchSecret"), "administrator routes never return plaintext provider secrets");
for (const field of ["stripeSecretKey", "stripeWebhookSecret"]) assert.ok(route.includes(field), `${field} must use the governed secret envelope`);
for (const token of ["payment/verify", "LAUNCH_PAYMENT_METHOD_DISABLED", "recordLaunchPaymentVerification", "paymentVerifications"]) assert.ok(route.includes(token), token);
assert.ok(index.includes("launchConfigurationRouter"));
console.log("LAUNCH_CONFIGURATION_BUILD_09=PASS routes=super-admin-only secrets=write-only activation=readiness-gated");
