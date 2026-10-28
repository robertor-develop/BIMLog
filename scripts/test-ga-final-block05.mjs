import { runNodeGate } from "./lib/observable-gate-runner.mjs";
import { GA_FINAL_BUILD031_TIMEOUT_MS } from "./lib/ga-timeout-contract.mjs";

const gates = [
  ["scripts/test-ga-final-block05-build031-security-isolation.mjs", GA_FINAL_BUILD031_TIMEOUT_MS],
  ["scripts/test-ga-final-block05-build032-mobile-accessibility.mjs", 180_000],
  ["scripts/test-ga-final-block05-build033-failure-recovery.mjs", 180_000],
  ["scripts/test-ga-final-block05-build034-temp-cleanup-readiness.mjs", 180_000],
  ["scripts/test-ga-final-block05-build035-final-ga-verdict.mjs", 180_000],
];
for (const [file, timeout] of gates) {
  runNodeGate(file, { timeout });
}

console.log("GA FINAL BLOCK 05 PASS: Builds 031-033 verified; Builds 034-035 remain explicitly fail-closed without production mutation");
