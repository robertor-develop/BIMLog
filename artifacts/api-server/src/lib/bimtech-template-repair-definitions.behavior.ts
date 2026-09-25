import assert from "node:assert/strict";
import {
  bimtechApprovedAllocation,
  bimtechGovernancePolicy,
  bimtechPricingTemplate,
  bimtechShopDrawingWorkflow,
  bimtechSleeveWorkflow,
  bimtechTemplateFingerprints,
} from "./bimtech-template-repair-definitions";

assert.deepEqual(bimtechShopDrawingWorkflow.phases.map(phase => phase.code), ["PRE", "COORD", "FR", "AB"]);
assert.deepEqual(bimtechSleeveWorkflow.phases.map(phase => phase.code), ["PRE", "COORD", "FR", "AB"]);
assert.equal(bimtechShopDrawingWorkflow.roles.execute, "DRAFTER");
assert.equal(bimtechShopDrawingWorkflow.roles.review, "QC_REVIEWER");
assert.equal(bimtechShopDrawingWorkflow.roles.approve, "PROJECT_LEADER");
assert.equal(bimtechGovernancePolicy.versioning.preserveHistory, true);
assert.deepEqual(bimtechPricingTemplate.definition.economicAllocation?.phases.map(phase => phase.percent), ["45.00", "35.00", "15.00", "5.00"]);
assert.equal(Number(bimtechApprovedAllocation.laborOperatingPercent) + Number(bimtechApprovedAllocation.projectIncentiveReservePercent) + Number(bimtechApprovedAllocation.projectEarningsPercent), 100);
assert.equal(Number(bimtechApprovedAllocation.directProductionLaborPercent) + Number(bimtechApprovedAllocation.projectAdministrativeLaborPercent), 100);
for (const fingerprint of Object.values(bimtechTemplateFingerprints)) assert.match(fingerprint, /^[a-f0-9]{64}$/);
console.log("BIMTECH template repair definitions: PASS");

