import assert from "node:assert/strict";
import { allocateWorkflowPhaseHours } from "./workflow-phase-hours";
const phases = [{ id: "pre", code: "PRE", name: "Preliminary" }, { id: "coord", code: "COORD", name: "Coordination" }, { id: "record", code: "FR", name: "For Record" }, { id: "built", code: "AB", name: "As-Built" }];
const allocation = phases.map((phase, index) => ({ phaseId: phase.id, code: phase.code, workflowPercent: ["20.00", "30.00", "40.00", "10.00"][index] }));
assert.deepEqual(allocateWorkflowPhaseHours("100", phases, allocation).map(row => [row.code, row.plannedHours]), [["PRE", "20"], ["COORD", "30"], ["FR", "40"], ["AB", "10"]]);
assert.ok(Math.abs(allocateWorkflowPhaseHours("7.25", phases, allocation).reduce((sum, row) => sum + Number(row.plannedHours), 0) - 7.25) < 0.000001);
assert.throws(() => allocateWorkflowPhaseHours("100", phases), /verified workflow economic allocation/);
assert.deepEqual(allocateWorkflowPhaseHours("7.25", [phases[0]]), [{ ...phases[0], plannedHours: "7.25" }]);
console.log("workflow-phase-hours.behavior: PASS");
