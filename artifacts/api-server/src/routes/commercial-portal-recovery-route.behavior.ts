import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./commercial-workspace.ts",import.meta.url),"utf8");
assert.match(source,/deriveCommercialPortalEligibility/);
assert.match(source,/lifecycle:subscriptionLifecycle\?\.status\?\?null/);
assert.match(source,/canManageBilling:billingAuthority\.canManageBilling/);
assert.match(source,/providerCustomerBound,portalConfigured:platform\.billingPortalConfigured/);
assert.match(source,/subscriptionLifecycle,portalEligibility,billingAuthority/);
console.log("LR063 tenant-scoped portal recovery projection: PASS");
