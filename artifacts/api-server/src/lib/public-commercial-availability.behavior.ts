import assert from "node:assert/strict";
import { derivePublicCommercialAvailability } from "./public-commercial-availability";

const blocked = derivePublicCommercialAvailability({});
assert.deepEqual(blocked, { schemaVersion:"bimlog-public-commercial-availability-v1", freeSignupAvailable:true, paidPlans:"consultation_only", nextAction:"request_plan_consultation" });
const ready = derivePublicCommercialAvailability({
  BIMLOG_STRIPE_PRICE_IDS:"professional.monthly=price_prof_m,professional.annual=price_prof_a,team.monthly=price_team_m,team.annual=price_team_a,business.monthly=price_business_m,business.annual=price_business_a",
  BIMLOG_COMMERCIAL_MODE:"live", STRIPE_SECRET_KEY:"sk_live_abcdefghijklmnop", STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijklmnop",
  STRIPE_PORTAL_CONFIGURATION_ID:"bpc_abcdefghijkl", BIMLOG_APP_ORIGIN:"https://bimlog.app", SENDGRID_API_KEY:"SG.abcdefghijklmnop.qrstuvwxyz123456",
  BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app", BIMLOG_SUPPORT_INBOX_EMAIL:"help@bimlog.app",
});
assert.equal(ready.paidPlans,"available");
assert.equal(ready.nextAction,"create_free_account");
assert.equal(JSON.stringify(ready).includes("STRIPE"),false);
console.log("LR011 safe public commercial availability: PASS");
