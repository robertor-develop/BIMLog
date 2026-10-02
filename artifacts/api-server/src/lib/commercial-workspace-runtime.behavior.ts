import assert from "node:assert/strict";
import {deriveCommercialRuntimeWorkspace} from "./commercial-workspace-runtime";
const incomplete=deriveCommercialRuntimeWorkspace({companyId:7,companyName:"BIMCorp",memberCount:12,commercialAccess:true,subscriptionConfigured:false,billingIdentityComplete:false,paymentProviderConfigured:false,webhookConfigured:false,billingPortalConfigured:false,supportConfigured:true});
assert.equal(incomplete.readiness,"action_required");
assert.deepEqual(incomplete.blockers,["SUBSCRIPTION_NOT_CONFIGURED","BILLING_IDENTITY_INCOMPLETE","PAYMENT_PROVIDER_NOT_CONFIGURED","WEBHOOK_NOT_CONFIGURED","BILLING_PORTAL_NOT_CONFIGURED"]);
const ready=deriveCommercialRuntimeWorkspace({companyId:7,companyName:"BIMCorp",memberCount:12,commercialAccess:true,subscriptionConfigured:true,billingIdentityComplete:true,paymentProviderConfigured:true,webhookConfigured:true,billingPortalConfigured:true,supportConfigured:true});
assert.deepEqual({readiness:ready.readiness,provider:ready.paymentProviderStatus,portal:ready.billingPortalStatus},{readiness:"ready",provider:"ready",portal:"ready"});
assert.equal(JSON.stringify(ready).includes("secret"),false);
console.log("B066 live commercial readiness projection: PASS");
