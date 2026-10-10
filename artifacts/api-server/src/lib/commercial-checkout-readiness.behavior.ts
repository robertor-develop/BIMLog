import assert from "node:assert/strict";
import {deriveCommercialCheckoutReadiness,requireCommercialCheckoutReadiness} from "./commercial-checkout-readiness";

const prices="professional.monthly=price_prof_monthly,professional.annual=price_prof_annual,team.monthly=price_team_monthly,team.annual=price_team_annual,business.monthly=price_business_monthly,business.annual=price_business_annual";
const ready={BIMLOG_STRIPE_PRICE_IDS:prices,BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"sk_live_abcdefghijklmnop",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijklmnop",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_abcdefghijklmnop",BIMLOG_APP_ORIGIN:"https://bimlog.app",SENDGRID_API_KEY:"SG.abcdefghijk.abcdefghijk",BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app",BIMLOG_SUPPORT_INBOX_EMAIL:"support@bimlog.app"};
assert.deepEqual(deriveCommercialCheckoutReadiness(ready),{ready:true,status:"ready",blockers:[]});
const blocked=deriveCommercialCheckoutReadiness({});
assert.equal(blocked.ready,false);
assert.deepEqual(blocked.blockers,["catalog_unavailable","payment_provider_unavailable","payment_confirmation_unavailable","billing_self_service_unavailable","customer_support_unavailable"]);
assert.throws(()=>requireCommercialCheckoutReadiness({}),(error:unknown)=>error instanceof Error&&(error as Error&{code?:string}).code==="CHECKOUT_PLATFORM_NOT_READY");
assert.equal(requireCommercialCheckoutReadiness(ready).ready,true);
console.log("LR041 commercial checkout readiness: PASS");
