import assert from "node:assert/strict";
import {deriveCommercialOfferHandoff} from "./commercial-offer-handoff";

const base={subscriptionStatus:"not_configured",preparedSubscription:null} as any;
const selected={plan:"team",cycle:"annual"} as const;
const intent={plan:"team",billing:"annual",useCase:"coordination"} as const;
assert.deepEqual(deriveCommercialOfferHandoff(intent,base,selected),{selectedFromPricing:true,matchesPreparedOffer:false,nextAction:"prepare"});
assert.equal(deriveCommercialOfferHandoff(intent,{...base,subscriptionStatus:"pending",preparedSubscription:{plan:"team",billingCycle:"annual"}},selected).nextAction,"checkout");
assert.equal(deriveCommercialOfferHandoff(intent,{...base,subscriptionStatus:"active"},selected).nextAction,"manage");
assert.equal(deriveCommercialOfferHandoff(intent,{...base,subscriptionStatus:"pending",preparedSubscription:{plan:"business",billingCycle:"annual"}},selected).nextAction,"review");
console.log("LR026 commercial offer handoff model: PASS");
