import assert from "node:assert/strict";
import { GAUNTLET_INTAKE_STAGES, inspectGauntletIntakeAcceptance } from "./gauntlet-intake-acceptance";

const base = {
  projectId: 64001, intakeId: "synthetic-intake-1", revision: 9, completedStages: GAUNTLET_INTAKE_STAGES,
  serverFingerprint: "a".repeat(64),
};
const ready = inspectGauntletIntakeAcceptance({ ...base, state: "ready_for_review" as const, activationConfirmedByUser: false, activationReceiptId: null, operationsEntryAvailable: false });
assert.equal(ready.reviewReady, true);
assert.equal(ready.active, false);
const active = inspectGauntletIntakeAcceptance({ ...base, state: "active" as const, activationConfirmedByUser: true, activationReceiptId: "activation-receipt-1", operationsEntryAvailable: true });
assert.equal(active.active, true);
assert.deepEqual(inspectGauntletIntakeAcceptance(JSON.parse(JSON.stringify({ ...base, state: "active", activationConfirmedByUser: true, activationReceiptId: "activation-receipt-1", operationsEntryAvailable: true }))), active);
assert.throws(() => inspectGauntletIntakeAcceptance({ ...base, state: "active", completedStages: GAUNTLET_INTAKE_STAGES.slice(0, -1), activationConfirmedByUser: true, activationReceiptId: "activation-receipt-1", operationsEntryAvailable: true }), /ACTIVE_CONTRADICTION/);
assert.throws(() => inspectGauntletIntakeAcceptance({ ...base, state: "active", activationConfirmedByUser: false, activationReceiptId: "activation-receipt-1", operationsEntryAvailable: true }), /ACTIVE_CONTRADICTION/);
assert.throws(() => inspectGauntletIntakeAcceptance({ ...base, state: "draft", activationConfirmedByUser: false, activationReceiptId: null, operationsEntryAvailable: true }), /INACTIVE_CONTRADICTION/);
console.log("B-GA015 Intake review, explicit activation, persistence, and Operations handoff contract: PASS");
