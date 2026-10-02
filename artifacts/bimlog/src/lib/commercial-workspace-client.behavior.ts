import assert from "node:assert/strict";
import {parseCommercialWorkspace} from "./commercial-workspace-client";
const parsed=parseCommercialWorkspace({companyId:7,companyName:" BIMCorp ",memberCount:12,commercialAccess:true,subscriptionStatus:"active",billingIdentityStatus:"complete",paymentProviderStatus:"ready",webhookStatus:"ready",billingPortalStatus:"ready",supportStatus:"ready",readiness:"ready",blockers:[]});
assert.deepEqual({name:parsed.companyName,members:parsed.memberCount,readiness:parsed.readiness},{name:"BIMCorp",members:12,readiness:"ready"});
assert.throws(()=>parseCommercialWorkspace({...parsed,paymentProviderStatus:"connected"}),/provider status/);
assert.throws(()=>parseCommercialWorkspace({...parsed,memberCount:-1}),/identity/);
console.log("B068 strict commercial workspace client adapter: PASS");
