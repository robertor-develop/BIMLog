import assert from "node:assert/strict";
import {
  applyAssignmentApuRate,
  INTAKE_APU_RATE_DEFAULTS,
  profileForApuRate,
  rateForApuProfile,
} from "./job-intake-apu-rates.ts";

assert.equal(INTAKE_APU_RATE_DEFAULTS.drafting, "35.47");
assert.equal(INTAKE_APU_RATE_DEFAULTS.bim_coordinator, "37.99");
assert.equal(rateForApuProfile("drafting"), "35.47");
assert.equal(rateForApuProfile("bim_coordinator"), "37.99");
assert.equal(rateForApuProfile("unsupported"), null);
assert.equal(profileForApuRate("35.47"), "drafting");
assert.equal(profileForApuRate("37.99"), "bim_coordinator");
assert.equal(profileForApuRate("41.25"), "");

const draft = {
  scopeItems: [
    { id: "scope-1", billingHourlyRate: "10.00" },
    { id: "scope-2", billingHourlyRate: "20.00" },
  ],
  team: {
    assignments: [
      {
        scopeItemId: "scope-1",
        role: "Custom role",
        internalHourlyRate: "5.10",
        incentiveAmount: "25.00",
      },
      { scopeItemId: "scope-2", role: "Other" },
    ],
  },
  review: { scopeConfirmed: true, pricingConfirmed: true },
};
const withDrafting = applyAssignmentApuRate(
  draft,
  0,
  rateForApuProfile("drafting")!,
  "Drafting",
);
assert.equal(withDrafting.scopeItems[0].billingHourlyRate, "35.47");
assert.equal(withDrafting.scopeItems[1].billingHourlyRate, "20.00");
assert.equal(withDrafting.team.assignments[0].role, "Drafting");
assert.equal(withDrafting.team.assignments[0].internalHourlyRate, "5.10");
assert.equal(withDrafting.team.assignments[0].incentiveAmount, "25.00");
assert.equal(withDrafting.team.assignments[1].role, "Other");
assert.equal(withDrafting.review.scopeConfirmed, false);
assert.equal(withDrafting.review.pricingConfirmed, false);
assert.strictEqual(applyAssignmentApuRate(draft, 8, "37.99"), draft);

console.log("job-intake-apu-rates.behavior: PASS");
