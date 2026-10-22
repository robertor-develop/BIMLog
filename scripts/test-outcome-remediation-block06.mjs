import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const build of [26, 27, 28, 29, 30]) {
  runNodeGate(`scripts/test-outcome-remediation-build0${build}-${[
    "release-continuity",
    "headquarters-eligibility",
    "apu-rate",
    "delivery-guidance",
    "operations-packages",
  ][build - 26]}.mjs`, { timeout: build === 30 ? 180_000 : 60_000 });
}
console.log("OUTCOME-REMEDIATION-BLOCK06 PASS: Builds 26-30 are verified at the ten-build push/publication boundary");
