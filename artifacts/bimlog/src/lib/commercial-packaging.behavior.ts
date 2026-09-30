import assert from "node:assert/strict";
import {
  BUYER_PROFILES,
  PACKAGE_CAPABILITIES,
  capabilitiesForPlan,
  getBuyerProfile,
  planIncludesCapability,
  recommendPackageFit,
  summarizePackageLimits,
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

assert.deepEqual(summarizePackageLimits("free", { projectLimit: 1, memberLimit: 5 }, "en"), {
  projects: "1 active project",
  members: "5 members per project",
  enforcement: "At a limit, existing work remains available and an administrator must expand the plan before adding capacity.",
});
assert.deepEqual(summarizePackageLimits("enterprise", { projectLimit: null, memberLimit: null }, "es"), {
  projects: "Definidos por acuerdo",
  members: "Definidos por habilitación",
  enforcement: "Los límites contratados se aplican según el acuerdo del cliente.",
});

const baseFit = {
  buyerProfileId: "bim_coordinator" as const,
  activeProjects: 1,
  membersPerProject: 5,
  needsAuditExports: false,
  needsTeamOperations: false,
  needsMeetingsOrTransmittals: false,
  needsPortfolioAgreement: false,
};
assert.equal(recommendPackageFit(baseFit).planId, "free");
assert.equal(recommendPackageFit({ ...baseFit, needsAuditExports: true }).planId, "professional");
assert.equal(recommendPackageFit({ ...baseFit, needsTeamOperations: true }).planId, "team");
assert.equal(recommendPackageFit({ ...baseFit, needsMeetingsOrTransmittals: true }).planId, "business");
assert.equal(recommendPackageFit({ ...baseFit, needsPortfolioAgreement: true }).planId, "enterprise");
assert.equal(recommendPackageFit({ ...baseFit, activeProjects: -5 }).planId, "free");

console.log("Commercial packaging builds 001-004 buyer profiles, capabilities, limits and fit guidance: PASS");
