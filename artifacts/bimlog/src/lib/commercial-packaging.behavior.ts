import assert from "node:assert/strict";
import {
  BUYER_PROFILES,
  PACKAGE_CAPABILITIES,
  capabilitiesForPlan,
  getBuyerProfile,
  planIncludesCapability,
} from "./commercial-packaging";

assert.deepEqual(BUYER_PROFILES.map((profile) => profile.id), [
  "bim_coordinator",
  "coordination_firm",
  "general_contractor",
  "owner_operator",
]);
for (const profile of BUYER_PROFILES) {
  assert.ok(profile.name.en && profile.name.es);
  assert.ok(profile.buyingJob.en && profile.buyingJob.es);
  assert.ok(profile.proofNeeded.length >= 2);
}
assert.equal(getBuyerProfile("bim_coordinator").name.en, "BIM coordinator");

assert.equal(PACKAGE_CAPABILITIES.length, 8);
assert.equal(capabilitiesForPlan("free").length, 2);
assert.equal(capabilitiesForPlan("professional").length, 4);
assert.equal(capabilitiesForPlan("team").length, 6);
assert.equal(capabilitiesForPlan("business").length, 7);
assert.equal(capabilitiesForPlan("enterprise").length, 8);
assert.equal(planIncludesCapability("team", PACKAGE_CAPABILITIES[6]), false);
assert.equal(planIncludesCapability("enterprise", PACKAGE_CAPABILITIES[6]), true);

console.log("Commercial packaging builds 001-002 buyer profiles and capability matrix: PASS");
