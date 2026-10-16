import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const file of [
  "scripts/test-ga-final-block05-build031-security-isolation.mjs",
  "scripts/test-ga-final-block05-build032-mobile-accessibility.mjs",
  "scripts/test-ga-final-block05-build033-failure-recovery.mjs",
  "scripts/test-ga-final-block05-build034-temp-cleanup-readiness.mjs",
  "scripts/test-ga-final-block05-build035-final-ga-verdict.mjs",
]) {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8", stdio: "inherit" });
  assert.equal(result.status, 0, `${file} failed`);
}

console.log("GA FINAL BLOCK 05 PASS: Builds 031-033 verified; Builds 034-035 remain explicitly fail-closed without production mutation");
