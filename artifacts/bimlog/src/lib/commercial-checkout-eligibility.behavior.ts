import assert from "node:assert/strict";
import {deriveCommercialCheckoutEligibility} from "./commercial-checkout-eligibility";
const base={billingAuthority:{canManageBilling:true},billingIdentityStatus:"complete",subscriptionStatus:"pending",providerCustomerBound:true,paymentProviderStatus:"ready"} as any;
assert.deepEqual(deriveCommercialCheckoutEligibility(base),{ready:true,blockers:[]});
assert.deepEqual(deriveCommercialCheckoutEligibility({...base,billingAuthority:{canManageBilling:false},subscriptionStatus:"not_configured",providerCustomerBound:false}),{ready:false,blockers:["billing_authority","subscription","provider_customer"]});
assert.equal(deriveCommercialCheckoutEligibility({...base,subscriptionStatus:"active"}).ready,false);
console.log("B288 checkout eligibility fails closed on exact company authority and preparation: PASS");
