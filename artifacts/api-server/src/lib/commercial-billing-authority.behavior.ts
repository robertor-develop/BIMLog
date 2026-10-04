import assert from "node:assert/strict";
import {requireCommercialBillingManager,resolveCommercialBillingAuthority} from "./commercial-billing-authority";

const query=(row:Record<string,unknown>)=>({query:async()=>({rows:[row]})});
const admin=await resolveCommercialBillingAuthority(query({id:4,company_id:7,is_super_admin:false,is_financial_administrator:true}),{userId:4,companyId:7});
assert.equal(requireCommercialBillingManager(admin).role,"billing_admin");
const platform=await resolveCommercialBillingAuthority(query({id:1,company_id:7,is_super_admin:true,is_financial_administrator:false}),{userId:1,companyId:7});
assert.equal(platform.canManageBilling,true);
const viewer=await resolveCommercialBillingAuthority(query({id:5,company_id:7,is_super_admin:false,is_financial_administrator:false}),{userId:5,companyId:7});
assert.equal(viewer.role,"viewer");
assert.throws(()=>requireCommercialBillingManager(viewer),/administrator authority/);
assert.rejects(()=>resolveCommercialBillingAuthority({query:async()=>({rows:[]})},{userId:4,companyId:7}),/identity is unavailable/);
console.log("commercial billing authority behavior passed");
