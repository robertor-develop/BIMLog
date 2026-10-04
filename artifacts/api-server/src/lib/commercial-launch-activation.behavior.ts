import assert from "node:assert/strict";
import {deriveCommercialLaunchActivation} from "./commercial-launch-activation";

const empty=deriveCommercialLaunchActivation({});
assert.equal(empty.ready,false);
assert.equal(empty.requiredActionCount,5);
assert.deepEqual(empty.steps.filter(step=>step.status==="action_required").map(step=>step.id),["catalog","provider","webhook","portal","support"]);
assert.equal(empty.steps.every(step=>step.owner==="bimlog_platform"),true);
assert.equal(JSON.stringify(empty).includes("undefined"),false);

const test=deriveCommercialLaunchActivation({BIMLOG_COMMERCIAL_MODE:"test",STRIPE_SECRET_KEY:"sk_test_abcdefghijkl",STRIPE_WEBHOOK_SECRET:"whsec_abcdefghijkl",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_test",BIMLOG_APP_ORIGIN:"https://bimlog.app",BIMLOG_STRIPE_PRICE_IDS:"professional.monthly=price_prof_monthly,professional.annual=price_prof_annual,team.monthly=price_team_monthly,team.annual=price_team_annual,business.monthly=price_business_monthly,business.annual=price_business_annual",SENDGRID_API_KEY:"SG.abcdefghijklmnop.qrstuvwxyzABCDE",BIMLOG_SUPPORT_FROM_EMAIL:"support@bimlog.app",BIMLOG_SUPPORT_INBOX_EMAIL:"help@bimlog.app"});
assert.equal(test.status,"test_only");
assert.deepEqual(test.steps.filter(step=>step.status==="action_required").map(step=>step.id),["live_mode"]);
assert.equal(JSON.stringify(test).includes("sk_test_"),false);
assert.equal(JSON.stringify(test).includes("SG."),false);
console.log("B251 secret-free commercial launch activation plan: PASS");
