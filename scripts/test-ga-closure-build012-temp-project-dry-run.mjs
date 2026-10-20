import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GA_PROTECTED_PROJECTS } from "../artifacts/api-server/src/lib/ga-protected-projects.ts";

const proof = JSON.parse(readFileSync("evidence/ga-closure-20261020/temp-gauntlet-deletion-dry-run.json", "utf8"));
const protectedIds = GA_PROTECTED_PROJECTS.map(project => project.id).sort((a, b) => a - b);

assert.equal(proof.mode, "dry_run_only");
assert.equal(proof.project.id, 64);
assert.equal(proof.project.code, "QA-GAUNTLET-1014");
assert.match(proof.project.declaredPurpose, /Temporary synthetic/);
assert.deepEqual(proof.protectedProjectIds, protectedIds);
assert.ok(!proof.protectedProjectIds.includes(proof.project.id));

for (const [name, value] of Object.entries(proof.ownershipEvidence)) {
  assert.equal(value, true, `${name} must be explicitly evidenced`);
}
for (const [name, value] of Object.entries(proof.dependencyEvidence)) {
  assert.equal(value, false, `${name} must remain unresolved until independently evidenced`);
}

assert.equal(proof.readyForIndependentReview, false);
assert.equal(proof.executionAuthorized, false);
assert.equal(proof.deleteCount, 0);
assert.equal(proof.protectedProjectsTouched, 0);
assert.equal(proof.blockers.length, 4);

console.log("GA-CLOSURE-B012 PASS: temporary project dry run is complete and fail-closed; deletion remains disabled with four exact evidence gaps");
