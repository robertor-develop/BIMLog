import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/bimlog/src/lib/job-intake-delivery-defaults.behavior.ts");
runTsGate("artifacts/bimlog/src/lib/delivery-guidance-status.behavior.ts");
runTsGate("artifacts/bimlog/src/pages/JobIntakeWorkspace.completion-guidance.behavior.ts");
console.log("OUTCOME-B029 PASS: published workflow selection hydrates one editable submittal strategy and milestone summary while preserving reviewed text");
