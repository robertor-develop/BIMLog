import assert from "node:assert/strict";
import {inspectCommercialPlatformReadiness} from "./commercial-platform-readiness";

const empty=inspectCommercialPlatformReadiness({});
assert.equal(empty.subscriptionConfigured,false);
assert.equal(empty.checks.length,5);
assert.equal(empty.checks.every(item=>item.status==="not_configured"),true);

const catalog="professional.monthly=price_prof_monthly,professional.annual=price_prof_annual,team.monthly=price_team_monthly,team.annual=price_team_annual,business.monthly=price_business_monthly,business.annual=price_business_annual";
const valid=inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:catalog});
assert.equal(valid.subscriptionConfigured,true);
assert.equal(valid.checks[0]?.code,"catalog_ready");
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_good_2026,invalid"}).subscriptionConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"professional.monthly=price_duplicate_2026,professional.annual=price_duplicate_2026"}).subscriptionConfigured,false);
assert.deepEqual(valid.catalogCoverage.map(item=>item.slot),["professional.monthly","professional.annual","team.monthly","team.annual","business.monthly","business.annual"]);
assert.equal(valid.catalogCoverage.every(item=>item.status==="ready"),true);
assert.equal(valid.providerMode,"unavailable");
const incompleteCatalog=inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"professional.monthly=price_duplicate_2026,professional.annual=price_duplicate_2026,team.monthly=bad"});
assert.equal(incompleteCatalog.catalogCoverage.find(item=>item.slot==="professional.monthly")?.status,"duplicate_price");
assert.equal(incompleteCatalog.catalogCoverage.find(item=>item.slot==="team.monthly")?.status,"invalid");
assert.equal(incompleteCatalog.catalogCoverage.find(item=>item.slot==="business.annual")?.status,"missing");
assert.equal(JSON.stringify(valid).includes("BIMLOG_STRIPE_PRICE_IDS"),false);

const stripeReady=inspectCommercialPlatformReadiness({
  BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"sk_live_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",
  STRIPE_PORTAL_CONFIGURATION_ID:"bpc_live",BIMLOG_APP_ORIGIN:"https://bimlog.app",
});
assert.equal(stripeReady.paymentProviderConfigured,true);
assert.equal(stripeReady.providerMode,"live");
assert.equal(stripeReady.webhookConfigured,true);
assert.equal(stripeReady.billingPortalConfigured,true);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"test",STRIPE_SECRET_KEY:"sk_test_abcdefghijklmnop",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_test",BIMLOG_APP_ORIGIN:"https://bimlog.app"}).providerMode,"test");
assert.equal(inspectCommercialPlatformReadiness({STRIPE_SECRET_KEY:"invalid"}).providerMode,"unavailable");
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"test",STRIPE_SECRET_KEY:"sk_live_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_live",BIMLOG_APP_ORIGIN:"https://bimlog.app"}).paymentProviderConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"bad",STRIPE_WEBHOOK_SECRET:"bad",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_live"}).billingPortalConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"sk_live_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",BIMLOG_APP_ORIGIN:"http://bimlog.app"}).paymentProviderConfigured,false);
const sendgridKey="SG.abcdefghijklmnop.qrstuvwxyzABCDE";
assert.equal(inspectCommercialPlatformReadiness({SENDGRID_API_KEY:sendgridKey}).supportConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({SENDGRID_API_KEY:sendgridKey,BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app"}).checks[4]?.code,"support_inbox_invalid");
assert.equal(inspectCommercialPlatformReadiness({SENDGRID_API_KEY:sendgridKey,BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app",BIMLOG_SUPPORT_INBOX_EMAIL:"help@bimlog.app"}).supportConfigured,true);
console.log("commercial platform readiness catalog behavior passed");
