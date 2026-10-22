import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/bimlog/src/lib/job-intake-apu-default.behavior.ts");
runTsGate("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.behavior.tsx");
runTsGate("artifacts/bimlog/src/lib/lorena-intake-correction-integration.behavior.ts");
console.log("OUTCOME-B028 PASS: a sole compatible APU is selectable and supplies the quantity-normalized unit rate without overwriting explicit choices");
