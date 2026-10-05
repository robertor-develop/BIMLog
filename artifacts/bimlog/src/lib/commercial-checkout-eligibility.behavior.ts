import assert from "node:assert/strict";
import {deriveCommercialCheckoutEligibility} from "./commercial-checkout-eligibility";
const base={billingAuthority:{canManageBilling:true},billingIdentityStatus:"complete",subscriptionStatus:"pending",preparedSubscription:{subscriptionId:"sub-47",plan:"team",billingCycle:"annual",seatQuantity:5},providerCustomerBound:true,paymentProviderStatus:"ready"} as any;
assert.deepEqual(deriveCommercialCheckoutEligibility(base,{plan:"team",cycle:"annual"}),{ready:true,blockers:[]});
assert.deepEqual(deriveCommercialCheckoutEligibility(base,{plan:"professional",cycle:"annual"}),{ready:false,blockers:["offer_mismatch"]});
assert.deepEqual(deriveCommercialCheckoutEligibility({...base,billingAuthority:{canManageBilling:false},subscriptionStatus:"not_configured",providerCustomerBound:false}),{ready:false,blockers:["billing_authority","subscription","provider_customer"]});
assert.equal(deriveCommercialCheckoutEligibility({...base,subscriptionStatus:"active"}).ready,false);
console.log("B288 checkout eligibility fails closed on exact company authority and preparation: PASS");
