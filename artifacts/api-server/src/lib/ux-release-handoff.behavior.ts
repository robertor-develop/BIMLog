import assert from "node:assert/strict";
import { verifyReleaseHandoff, type ReleaseHandoff } from "./ux-release-handoff";

const valid: ReleaseHandoff = {
  sourceCommit: "a".repeat(40), deploymentId: "deployment-100", completedGates: ["local-release", "authenticated-chrome"],
  knownLimits: [{ id: "native-field", disposition: "deferred", reason: "Physical affected-model acceptance is separately tracked." }],
  releaseScope: ["UX001-UX100"], rollbackSourceCommit: "b".repeat(40), rollbackRehearsed: true, unresolvedPriorities: ["P2"],
};
assert.equal(verifyReleaseHandoff(valid).status, "ready");
assert.equal(verifyReleaseHandoff({ ...valid, sourceCommit: "short" }).status, "blocked");
assert.equal(verifyReleaseHandoff({ ...valid, unresolvedPriorities: ["P1"] }).status, "blocked");
assert.equal(verifyReleaseHandoff({ ...valid, rollbackRehearsed: false }).status, "blocked");
console.log("UX100 release evidence, rollback and handoff: PASS");
