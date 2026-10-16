import assert from "node:assert/strict";
import { previewEconomicAllocation } from "./delivery-workflow-economic-allocation";
import { allocateWorkflowPhaseHours } from "./workflow-phase-hours";

const phases = [
  { id: "pre", code: "PRE", name: "Preliminary" },
  { id: "coord", code: "COO", name: "Coordination" },
  { id: "record", code: "FOR", name: "For record" },
  { id: "built", code: "ASB", name: "As built" },
];
const preview = previewEconomicAllocation({
  commercialApuVersionId: "commercial-apu-v7", commercialApuFingerprint: "b".repeat(64),
  currency: "USD", directProductionAmount: "1000.00",
  phases: phases.map((phase, index) => ({ ...phase, phaseId: phase.id, percent: ["25.00", "35.00", "30.00", "10.00"][index] })),
}, { method: "custom", phases: phases.map((phase, index) => ({ ...phase, phaseId: phase.id, percent: ["20.00", "40.00", "30.00", "10.00"][index] })), approvalReason: "Reviewed company delivery allocation" });
const first = allocateWorkflowPhaseHours("37.25", phases, preview.rows);
const replay = allocateWorkflowPhaseHours("37.25", phases, preview.rows);
assert.deepEqual(first, replay, "reactivation must preserve the same frozen allocation");
assert.deepEqual(first.map(row => [row.code, row.plannedHours]), [["PRE", "7.45"], ["COO", "14.9"], ["FOR", "11.175"], ["ASB", "3.725"]]);
assert.ok(Math.abs(first.reduce((sum, row) => sum + Number(row.plannedHours), 0) - 37.25) < 0.000001);
console.log("lorena-allocation-correction-integration.behavior: PASS custom allocation, aliases, rounding and idempotent replay");
