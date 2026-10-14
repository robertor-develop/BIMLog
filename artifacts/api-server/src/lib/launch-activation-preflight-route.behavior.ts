import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const route = readFileSync(fileURLToPath(new URL("../routes/launch-configuration.ts", import.meta.url)), "utf8");
for (const token of ["inspectLaunchActivationPreflight", "configurationEntered:", "emailEvidence: emailVerification", "paymentEvidence: paymentVerifications", "preflight", 'private, no-store, max-age=0']) assert.ok(route.includes(token), token);
assert.match(route, /authMiddleware, isSuperAdminMiddleware/);
assert.doesNotMatch(route, /secretEnvelopes[^\n]*preflight/);
console.log("LAUNCH_CONFIGURATION_BUILD_37=PASS protectedProjection=true noStore=true secretFree=true");
