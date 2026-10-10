import assert from "node:assert/strict";
import {deriveCommercialBillingIdentity,parseCommercialBillingIdentityUpdate} from "./commercial-billing-identity";

assert.deepEqual(deriveCommercialBillingIdentity({companyId:7,legalName:" BIMCorp Inc ",address:null,phone:""}),{
  companyId:7,legalName:"BIMCorp Inc",address:"",phone:"",status:"incomplete",missingFields:["address","phone"],
});
assert.deepEqual(parseCommercialBillingIdentityUpdate({address:"  100 Main   Street ",phone:" +1 555 0100 "}),{address:"100 Main Street",phone:"+1 555 0100"});
assert.equal(deriveCommercialBillingIdentity({companyId:7,legalName:"BIMCorp Inc",address:"100 Main Street",phone:"+1 555 0100"}).status,"complete");
assert.throws(()=>parseCommercialBillingIdentityUpdate({address:"x",phone:"+1 555 0100"}),/address is invalid/);
assert.throws(()=>parseCommercialBillingIdentityUpdate({address:"100 Main Street",phone:"123",taxId:"hidden"}),/unsupported fields/);
assert.throws(()=>parseCommercialBillingIdentityUpdate({address:"100 Test Way\u0000",phone:"+1 555 0100"}),/invalid/);
assert.throws(()=>parseCommercialBillingIdentityUpdate({address:"100 Test Way",phone:"call-me-now"}),/invalid/);
assert.deepEqual(deriveCommercialBillingIdentity({companyId:7,legalName:"BIM Tech",address:"bad\u0000",phone:"call-me"}).missingFields,["address","phone"]);
console.log("LR031 canonical billing identity contract: PASS");
