import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const file of [
  "scripts/test-ga-final-block05-build031-security-isolation.mjs",
  "scripts/test-ga-final-block05-build032-mobile-accessibility.mjs",
  "scripts/test-ga-final-block05-build033-failure-recovery.mjs",
  "scripts/test-ga-final-block05-build034-temp-cleanup-readiness.mjs",
  "scripts/test-ga-final-block05-build035-final-ga-verdict.mjs",
]) {
  runNodeGate(file);
}

console.log("GA FINAL BLOCK 05 PASS: Builds 031-033 verified; Builds 034-035 remain explicitly fail-closed without production mutation");
