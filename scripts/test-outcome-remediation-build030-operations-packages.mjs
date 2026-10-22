import { runNodeGate, runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/bimlog/src/lib/job-intake-activation-preview.behavior.ts");
runNodeGate("scripts/test-intake-activation.mjs", { timeout: 180_000 });
console.log("OUTCOME-B030 PASS: activation preserves exact hours and creates the configured plus PRE/COO/FOR/ASB/PROD work-package links");
