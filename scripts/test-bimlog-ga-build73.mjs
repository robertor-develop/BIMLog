import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const evidence = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build73-ref-integration.json", "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

assert.equal(evidence.schemaVersion, "bimlog-ga-build73-ref-integration-v1");
assert.equal(evidence.build, 73);
assert.equal(git("rev-parse", `${evidence.verifiedCandidate.commit}^{tree}`), evidence.verifiedCandidate.tree);
assert.doesNotThrow(() => git("merge-base", "--is-ancestor", evidence.verifiedCandidate.commit, "HEAD"));
for (const [ref, commit] of Object.entries(evidence.observedRemoteTrackingRefs)) {
  // This receipt records the remote state observed at Build 73. Later authorized
  // pushes necessarily move the tracking ref, so repeatable verification must
  // validate the recorded commit and its containment rather than require the
  // mutable ref to remain frozen forever.
  assert.doesNotThrow(() => git("cat-file", "-e", `${commit}^{commit}`), `${ref}'s observed commit is unavailable`);
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, evidence.verifiedCandidate.commit), `${ref} is not contained by the candidate`);
}
assert.equal(evidence.integration.strategy, "normal-fast-forward-only");
assert.equal(evidence.integration.forcePushAllowed, false);
assert.equal(evidence.integration.pushBoundary, "after-build75-block-gate");
assert.equal(evidence.integration.publicationBoundary, "after-build80-second-block-gate");
assert.equal(evidence.state, "INTEGRATION_READY_NOT_PUSHED");

console.log("BIMLog GA Build 73: PASS verified candidate contains every authorized observed ref and is ready for normal non-force integration");
