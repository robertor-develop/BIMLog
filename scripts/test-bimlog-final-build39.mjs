import { runNodeGate, runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/api-server/src/lib/job-intake-idempotent-activation.behavior.ts");
runTsGate("artifacts/bimlog/src/lib/intake-phase-hours-preview.behavior.ts");
runTsGate("artifacts/bimlog/src/lib/job-intake-activation-preview.behavior.ts");
runNodeGate("scripts/test-intake-activation.mjs", { timeout: 180_000 });
console.log("BIMLog final closure Build 39: PASS canonical activation, idempotency, phase hours, Work Packages, and tasks");
