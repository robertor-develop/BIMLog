import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const file of [
  "scripts/test-full-ga-remediation-build21-publication-boundary.mjs",
  "scripts/test-full-ga-remediation-build22-security-isolation.mjs",
  "scripts/test-full-ga-remediation-build23-responsive-accessibility.mjs",
  "scripts/test-ga-final-block05-build033-failure-recovery.mjs",
  "scripts/test-full-ga-remediation-build24-recovery-purge-readiness.mjs",
]) runNodeGate(file);

const verdict = JSON.parse(readFileSync("evidence/full-ga-remediation-20261021/block05-verdict.json", "utf8"));
assert.deepEqual(verdict.builds, [21, 22, 23, 24, 25]);
assert.equal(verdict.implementationVerdict, "PASS");
assert.equal(verdict.gaReady, false);
assert.equal(verdict.publicationDue, false);
assert.equal(verdict.unpublishedBuildCount, 5);
assert.equal(verdict.productionMutation, false);
assert.equal(verdict.openExternalGates.length, 3);

console.log("Full-GA Block 5 Build 25 PASS: five-build implementation block is complete; final GA remains evidence-bound and fail-closed");
