import assert from "node:assert/strict";
import { validatePricingTemplate } from "./company-pricing-template-contract";
import { economicCheckerAllowed, sourceFromVerifiedCommercialApu } from "./delivery-workflow-allocation-source-contract";
import { FinancialControlError } from "./financial-control-contract";

const definition = {
  schemaVersion: 1, currency: "USD", industry: "BIM Services", name: "Sleeves",
  nodes: [
    { id: "labor", label: "Drawing labor", method: "hours_hourly_rate", hours: "10", hourlyRate: "25" },
    { id: "review", label: "Review", method: "fixed_amount", amount: "50" },
  ],
  economicAllocation: {
    directProductionNodeIds: ["labor"],
    phases: [
      { phaseId: "pre", code: "PRE", name: "Preliminary", percent: "60.00" },
      { phaseId: "record", code: "FR", name: "For Record", percent: "40.00" },
    ],
  },
};
const fingerprint = validatePricingTemplate(definition).fingerprint;
const source = sourceFromVerifiedCommercialApu({ definition, versionId: "apu-v2", fingerprint, currency: "USD" });
assert.equal(source.directProductionAmount, "250.00");
assert.equal(source.commercialApuVersionId, "apu-v2");
assert.equal(source.phases.length, 2);
assert.equal(economicCheckerAllowed({ creatorId: 1, lastEditorId: 1, checkerId: 2, hasFinanceGrant: true }), true);
assert.equal(economicCheckerAllowed({ creatorId: 1, lastEditorId: 2, checkerId: 2, hasFinanceGrant: true }), false);
assert.equal(economicCheckerAllowed({ creatorId: 1, lastEditorId: 1, checkerId: 2, hasFinanceGrant: false }), false);
assert.throws(() => sourceFromVerifiedCommercialApu({ definition, versionId: "apu-v2", fingerprint: "0".repeat(64), currency: "USD" }),
  (error: unknown) => error instanceof FinancialControlError && error.code === "WORKFLOW_APU_INTEGRITY");
assert.throws(() => sourceFromVerifiedCommercialApu({ definition, versionId: "apu-v2", fingerprint, currency: "EUR" }),
  (error: unknown) => error instanceof FinancialControlError && error.code === "WORKFLOW_APU_INTEGRITY");
const legacy = { ...definition, economicAllocation: undefined };
assert.throws(() => sourceFromVerifiedCommercialApu({
  definition: legacy, versionId: "apu-v1", fingerprint: validatePricingTemplate(legacy).fingerprint, currency: "USD",
}), (error: unknown) => error instanceof FinancialControlError && error.code === "WORKFLOW_APU_PHASE_DEFAULTS_MISSING");
console.log("workflow allocation source integrity: pass");
