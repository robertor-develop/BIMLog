import assert from "node:assert/strict";
import {inspectCommercialPlatformReadiness} from "./commercial-platform-readiness";

const empty=inspectCommercialPlatformReadiness({});
assert.equal(empty.subscriptionConfigured,false);
assert.equal(empty.checks.length,5);
assert.equal(empty.checks.every(item=>item.status==="not_configured"),true);

const valid=inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_standard_2026,price_enterprise_2026"});
assert.equal(valid.subscriptionConfigured,true);
assert.equal(valid.checks[0]?.code,"catalog_ready");
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_good_2026,invalid"}).subscriptionConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_duplicate_2026,price_duplicate_2026"}).subscriptionConfigured,false);
assert.equal(JSON.stringify(valid).includes("BIMLOG_STRIPE_PRICE_IDS"),false);

const stripeReady=inspectCommercialPlatformReadiness({
  BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"sk_live_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",
  STRIPE_PORTAL_CONFIGURATION_ID:"bpc_live",BIMLOG_APP_ORIGIN:"https://bimlog.app",
});
assert.equal(stripeReady.paymentProviderConfigured,true);
assert.equal(stripeReady.webhookConfigured,true);
assert.equal(stripeReady.billingPortalConfigured,true);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"test",STRIPE_SECRET_KEY:"sk_live_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_live",BIMLOG_APP_ORIGIN:"https://bimlog.app"}).paymentProviderConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"bad",STRIPE_WEBHOOK_SECRET:"bad",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_live"}).billingPortalConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_COMMERCIAL_MODE:"live",STRIPE_SECRET_KEY:"sk_live_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",BIMLOG_APP_ORIGIN:"http://bimlog.app"}).paymentProviderConfigured,false);
const sendgridKey="SG.abcdefghijklmnop.qrstuvwxyzABCDE";
assert.equal(inspectCommercialPlatformReadiness({SENDGRID_API_KEY:sendgridKey}).supportConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({SENDGRID_API_KEY:sendgridKey,BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app"}).checks[4]?.code,"support_inbox_invalid");
assert.equal(inspectCommercialPlatformReadiness({SENDGRID_API_KEY:sendgridKey,BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app",BIMLOG_SUPPORT_INBOX_EMAIL:"help@bimlog.app"}).supportConfigured,true);
console.log("commercial platform readiness catalog behavior passed");
