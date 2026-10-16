import assert from "node:assert/strict";
import { connectContractItemsToApu } from "../../../bimlog/src/lib/job-intake-apu-connection";
import { selectPublishedDeliveryWorkflow } from "../../../bimlog/src/lib/job-intake-delivery-defaults";
import { previewEconomicAllocation } from "./delivery-workflow-economic-allocation";
import { allocateWorkflowPhaseHours } from "./workflow-phase-hours";

const item = connectContractItemsToApu([
  { id: "CI-LORENA", quantity: "10", unit: "Hours", billingHourlyRate: "0", apuPlanVersion: null },
], {
  version: 7,
  name: "Published coordination APU",
  sellingPrice: "1250.00",
  currency: "USD",
  fingerprint: "a".repeat(64),
})[0];
assert.equal(item.billingHourlyRate, "125");
assert.equal(item.rateSource?.planSellingPrice, "1250.00");

const phases = [
  { id: "pre", code: "PRE", name: "Preliminary", tasks: [{ name: "Draft" }] },
  { id: "coord", code: "COO", name: "Coordination", tasks: [{ name: "Coordinate" }] },
  { id: "record", code: "FOR", name: "For record", tasks: [{ name: "Issue" }] },
  { id: "built", code: "ASB", name: "As built", tasks: [{ name: "Archive" }] },
];
const selected = selectPublishedDeliveryWorkflow({}, { versionId: "workflow-v12", definition: { phases } });
assert.equal(selected.submittalStrategy, "Draft → Coordinate → Issue → Archive");
assert.equal(selected.milestoneSummary, "Preliminary → Coordination → For record → As built");

const preview = previewEconomicAllocation({
  commercialApuVersionId: "commercial-apu-v7",
  commercialApuFingerprint: "b".repeat(64),
  currency: "USD",
  directProductionAmount: "1000.00",
  phases: phases.map((phase, index) => ({ phaseId: phase.id, code: phase.code, name: phase.name, percent: ["25.00", "35.00", "30.00", "10.00"][index] })),
}, { method: "custom", phases: phases.map((phase, index) => ({ phaseId: phase.id, code: phase.code, name: phase.name, percent: ["20.00", "40.00", "30.00", "10.00"][index] })), approvalReason: "Reviewed company delivery allocation" });
const first = allocateWorkflowPhaseHours("37.25", phases, preview.rows);
const replay = allocateWorkflowPhaseHours("37.25", phases, preview.rows);
assert.deepEqual(first, replay, "reactivation must preserve the same frozen allocation");
assert.deepEqual(first.map(row => [row.code, row.plannedHours]), [["PRE", "7.45"], ["COO", "14.9"], ["FOR", "11.175"], ["ASB", "3.725"]]);
assert.ok(Math.abs(first.reduce((sum, row) => sum + Number(row.plannedHours), 0) - 37.25) < 0.000001);

console.log("lorena-correction-integration.behavior: PASS selected APU, immutable workflow, custom allocation, aliases, rounding and idempotent replay");
