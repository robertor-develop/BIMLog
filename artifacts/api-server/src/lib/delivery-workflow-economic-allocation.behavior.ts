import assert from "node:assert/strict";
import { EconomicAllocationError, previewEconomicAllocation, type CommercialApuAllocationSource } from "./delivery-workflow-economic-allocation";

const source: CommercialApuAllocationSource = {
  commercialApuVersionId: "apu-v1",
  commercialApuFingerprint: "a".repeat(64),
  currency: "USD",
  directProductionAmount: "8000.00",
  phases: [
    { phaseId: "pre", code: "PRE", name: "Preliminary", percent: "45.00" },
    { phaseId: "coord", code: "COORD", name: "Coordination", percent: "35.00" },
    { phaseId: "record", code: "FR", name: "For Record", percent: "15.00" },
    { phaseId: "built", code: "AB", name: "As-Built", percent: "5.00" },
  ],
};
const sleeve = { phaseId: "sleeve", code: "SLV", name: "Sleeve Installation", percent: "10.00" };
const baseline = previewEconomicAllocation(source, { method: "apu_default" });
assert.deepEqual(baseline.rows.map(row => row.workflowPercent), ["45.00", "35.00", "15.00", "5.00"]);
assert.deepEqual(baseline.rows.map(row => row.amount), ["3600.00", "2800.00", "1200.00", "400.00"]);
assert.equal(baseline.requiresApproval, false);

const proportional = previewEconomicAllocation(source, { method: "proportional", additions: [sleeve] });
assert.deepEqual(proportional.rows.map(row => row.workflowPercent), ["40.50", "31.50", "13.50", "4.50", "10.00"]);
assert.deepEqual(proportional.rows.map(row => row.amount), ["3240.00", "2520.00", "1080.00", "360.00", "800.00"]);
assert.equal(proportional.fingerprint, previewEconomicAllocation(source, { method: "proportional", additions: [sleeve] }).fingerprint);

const specific = previewEconomicAllocation(source, { method: "deduct_specific", additions: [sleeve], deductions: [
  { phaseId: "pre", percent: "6.00" }, { phaseId: "coord", percent: "4.00" },
] });
assert.deepEqual(specific.rows.map(row => row.workflowPercent), ["39.00", "31.00", "15.00", "5.00", "10.00"]);
const custom = previewEconomicAllocation(source, { method: "custom", phases: [
  { ...source.phases[0], percent: "50.00" },
  { ...source.phases[1], percent: "30.00" },
  ...source.phases.slice(2),
], approvalReason: "Approved economic exception" });
assert.equal(custom.requiresApproval, true);
assert.equal(custom.approvalReason, "Approved economic exception");

const expectCode = (code: string, run: () => unknown) =>
  assert.throws(run, error => error instanceof EconomicAllocationError && error.code === code);
expectCode("ALLOCATION_TOTAL_NOT_100", () => previewEconomicAllocation(source, { method: "custom", phases: source.phases.map(row => ({ ...row, percent: "25.00" })).slice(0, 3), approvalReason: "Exception" }));
expectCode("ALLOCATION_DEDUCTION_MISMATCH", () => previewEconomicAllocation(source, { method: "deduct_specific", additions: [sleeve], deductions: [{ phaseId: "pre", percent: "5.00" }] }));
expectCode("ALLOCATION_DUPLICATE_PHASE", () => previewEconomicAllocation(source, { method: "proportional", additions: [{ ...sleeve, phaseId: "pre" }] }));
expectCode("ALLOCATION_DECIMAL_INVALID", () => previewEconomicAllocation({ ...source, directProductionAmount: "NaN" }, { method: "apu_default" }));
expectCode("ALLOCATION_SOURCE_FINGERPRINT_INVALID", () => previewEconomicAllocation({ ...source, commercialApuFingerprint: "" }, { method: "apu_default" }));

const tiny = previewEconomicAllocation({ ...source, directProductionAmount: "0.03" }, { method: "apu_default" });
assert.equal(tiny.rows.reduce((cents, row) => cents + Number(row.amount.replace(".", "")), 0), 3);
const twoCents = previewEconomicAllocation({ ...source, directProductionAmount: "0.02" }, { method: "apu_default" });
assert.equal(twoCents.rows.reduce((cents, row) => cents + Number(row.amount.replace(".", "")), 0), 2);
console.log("delivery-workflow economic allocation: pass");
