import assert from "node:assert/strict";
import {
  calculateJobApuDraft,
  JOB_APU_DEFAULTS,
  normalizeJobApuDrafts,
} from "./job-apu-builder";
const drafts = normalizeJobApuDrafts(
  [
    {
      id: "DRAFTING",
      contractId: "BASE",
      title: "Drafting",
      templateKey: "drafting",
      method: "hours_hourly_rate",
      hours: "100",
      hourlyRate: JOB_APU_DEFAULTS.drafting.hourlyRate,
      rateProvenance: "portfolio_default",
    },
    {
      id: "COORD",
      contractId: "BASE",
      title: "Coordination",
      templateKey: "bim_coordination",
      method: "fixed_amount",
      fixedAmount: "2500",
      canonicalVersionId: 7,
    },
    {
      id: "SHOP",
      contractId: "PO",
      title: "Shop drawings",
      templateKey: "custom",
      method: "quantity_unit_cost",
      quantity: "12",
      unitCost: "450",
    },
  ],
  new Set(["BASE", "PO"]),
);
assert.equal(drafts.length, 3);
assert.equal(calculateJobApuDraft(drafts[0]), "3547.00");
assert.equal(calculateJobApuDraft(drafts[1]), "2500.00");
assert.equal(calculateJobApuDraft(drafts[2]), "5400.00");
assert.equal(drafts[1].authorityState, "approved_linked");
assert.equal(drafts[0].authorityState, "draft");
assert.throws(
  () =>
    normalizeJobApuDrafts(
      [{ id: "BAD", contractId: "MISSING" }],
      new Set(["BASE"]),
    ),
  /belong to an agreement/,
);
console.log("Job multiple-APU builder behavior: PASS");
