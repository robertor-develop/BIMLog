import assert from "node:assert/strict";
import {postOnboardingCommercialDestination} from "./commercial-intent";

assert.equal(postOnboardingCommercialDestination(null,"/dashboard"),"/dashboard");
assert.equal(postOnboardingCommercialDestination({plan:"free",billing:"monthly",useCase:""},"/projects/7/intake"),"/projects/7/intake");
assert.equal(postOnboardingCommercialDestination({plan:"enterprise",billing:"annual",useCase:"portfolio"},"/dashboard"),"/dashboard");
const destination=postOnboardingCommercialDestination({plan:"team",billing:"annual",useCase:"shop drawings"},"/dashboard");
assert.equal(destination,"/settings/billing-support");
console.log("LR021 deterministic post-onboarding commercial destination: PASS");
