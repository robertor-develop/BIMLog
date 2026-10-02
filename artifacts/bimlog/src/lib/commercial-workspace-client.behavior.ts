import assert from "node:assert/strict";
import {parseCommercialWorkspace} from "./commercial-workspace-client";
const parsed=parseCommercialWorkspace({companyId:7,companyName:" BIMCorp ",memberCount:12,commercialAccess:true,subscriptionStatus:"active",billingIdentityStatus:"complete",paymentProviderStatus:"ready",webhookStatus:"ready",billingPortalStatus:"ready",supportStatus:"ready",readiness:"ready",blockers:[],actions:[{id:"review_plans",status:"available",href:"/pricing",blockers:[]}]});
assert.deepEqual({name:parsed.companyName,members:parsed.memberCount,readiness:parsed.readiness},{name:"BIMCorp",members:12,readiness:"ready"});
assert.throws(()=>parseCommercialWorkspace({...parsed,paymentProviderStatus:"connected"}),/provider status/);
assert.throws(()=>parseCommercialWorkspace({...parsed,memberCount:-1}),/identity/);
assert.throws(()=>parseCommercialWorkspace({...parsed,actions:[{id:"review_plans",status:"available",href:"/contact",blockers:[]}]}),/action authority/);
assert.throws(()=>parseCommercialWorkspace({...parsed,actions:[{id:"checkout",status:"available",href:"https:\/\/evil.example",blockers:[]}]}),/action/);
console.log("B068 strict commercial workspace client adapter: PASS");
