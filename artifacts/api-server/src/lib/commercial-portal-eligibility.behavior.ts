import assert from "node:assert/strict";
import {deriveCommercialPortalEligibility} from "./commercial-portal-eligibility";

const base={canManageBilling:true,providerCustomerBound:true,portalConfigured:true};
assert.deepEqual(deriveCommercialPortalEligibility({...base,lifecycle:"active"}),{ready:true,purpose:"manage",blockers:[]});
assert.deepEqual(deriveCommercialPortalEligibility({...base,lifecycle:"past_due"}),{ready:true,purpose:"recover_payment",blockers:[]});
assert.deepEqual(deriveCommercialPortalEligibility({...base,lifecycle:"suspended"}),{ready:true,purpose:"recover_payment",blockers:[]});
assert.deepEqual(deriveCommercialPortalEligibility({...base,lifecycle:"canceling"}),{ready:true,purpose:"review_cancellation",blockers:[]});
assert.deepEqual(deriveCommercialPortalEligibility({...base,lifecycle:"canceled"}),{ready:false,purpose:null,blockers:["subscription_state"]});
assert.deepEqual(deriveCommercialPortalEligibility({lifecycle:"active",canManageBilling:false,providerCustomerBound:false,portalConfigured:false}),{ready:false,purpose:"manage",blockers:["billing_authority","provider_customer","portal_service"]});
console.log("LR061 deterministic billing portal recovery eligibility: PASS");
