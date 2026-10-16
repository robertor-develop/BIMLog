import assert from "node:assert/strict";
import { allocateWorkflowPhaseHours } from "./workflow-phase-hours";
const phases = [{ id: "pre", code: "PRE", name: "Preliminary" }, { id: "coord", code: "COORD", name: "Coordination" }, { id: "record", code: "FR", name: "For Record" }, { id: "built", code: "AB", name: "As-Built" }];
assert.deepEqual(allocateWorkflowPhaseHours("100", phases).map(row => [row.code, row.plannedHours]), [["PRE", "45"], ["COORD", "35"], ["FR", "15"], ["AB", "5"]]);
assert.ok(Math.abs(allocateWorkflowPhaseHours("7.25", phases).reduce((sum, row) => sum + Number(row.plannedHours), 0) - 7.25) < 0.000001);
console.log("workflow-phase-hours.behavior: PASS");
