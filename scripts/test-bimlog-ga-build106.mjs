import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/api-server/src/lib/workflow-phase-hours.behavior.ts");
runTsGate("artifacts/api-server/src/lib/job-intake.behavior.ts");

const service = fs.readFileSync("artifacts/api-server/src/lib/job-intake-service.ts", "utf8");
assert.match(service, /requireWorkflowPhaseHours/);
assert.match(service, /Verified workflow allocation:/);
for (const phase of ["PRE", "COORD", "FR", "AB"]) {
  assert.match(fs.readFileSync("artifacts/api-server/src/lib/workflow-phase-hours.behavior.ts", "utf8"), new RegExp(`\\b${phase}\\b`));
}
console.log("BIMLog GA Build 106: PASS published workflow hours remain allocated to PRE/COORD/FR/AB");
