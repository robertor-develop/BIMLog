import assert from "node:assert/strict";
import { BUYER_PROFILES, getBuyerProfile } from "./commercial-packaging";

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

console.log("Commercial packaging build 001 buyer profiles: PASS");
