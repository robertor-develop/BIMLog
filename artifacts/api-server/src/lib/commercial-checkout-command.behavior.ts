import assert from "node:assert/strict";
import {resolveCheckoutOffer} from "./commercial-checkout-command";
const env={BIMLOG_STRIPE_PRICE_IDS:"professional.monthly=price_prof_monthly,professional.annual=price_prof_annual,team.monthly=price_team_monthly,team.annual=price_team_annual,business.monthly=price_business_monthly,business.annual=price_business_annual"};
assert.deepEqual(resolveCheckoutOffer(env,"professional","monthly"),{plan:"professional",cycle:"monthly",priceReference:"price_prof_monthly",subtotalCents:14900,currency:"USD"});
assert.equal(resolveCheckoutOffer(env,"business","annual").subtotalCents,399000);
assert.throws(()=>resolveCheckoutOffer(env,"enterprise","annual"),/supported checkout/);
assert.throws(()=>resolveCheckoutOffer({},"team","monthly"),/not configured/);
console.log("commercial checkout command behavior passed");
