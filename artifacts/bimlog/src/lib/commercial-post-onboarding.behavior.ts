import assert from "node:assert/strict";
import {parsePostOnboardingCommercialIntent,postOnboardingCommercialDestination} from "./commercial-intent";

assert.equal(postOnboardingCommercialDestination(null,"/dashboard"),"/dashboard");
assert.equal(postOnboardingCommercialDestination({plan:"free",billing:"monthly",useCase:""},"/projects/7/intake"),"/projects/7/intake");
assert.equal(postOnboardingCommercialDestination({plan:"enterprise",billing:"annual",useCase:"portfolio"},"/dashboard"),"/dashboard");
const destination=postOnboardingCommercialDestination({plan:"team",billing:"annual",useCase:"shop drawings"},"/dashboard");
assert.equal(destination,"/settings/billing-support?plan=team&billing=annual&from=onboarding&useCase=shop+drawings");
assert.deepEqual(parsePostOnboardingCommercialIntent(destination.slice(destination.indexOf("?"))),{plan:"team",billing:"annual",useCase:"shop drawings"});
assert.equal(parsePostOnboardingCommercialIntent("?plan=team&billing=annual&from=onboarding&extra=1"),null);
assert.equal(parsePostOnboardingCommercialIntent("?plan=enterprise&billing=annual&from=onboarding"),null);
assert.equal(parsePostOnboardingCommercialIntent("?plan=team&billing=annual"),null);
console.log("LR021 deterministic post-onboarding commercial destination: PASS");
