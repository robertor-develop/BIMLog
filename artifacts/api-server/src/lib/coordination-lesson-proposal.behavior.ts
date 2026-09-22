import assert from "node:assert/strict";
import { validateLessonDecision, validateLessonProposalContent } from "./coordination-lesson-workflow";

assert.deepEqual(validateLessonProposalContent({ lesson: "Route the duct below the beam.", organizationalApplicability: "Applicable to coordination-stage duct/beam clashes." }), {
  lesson: "Route the duct below the beam.", organizationalApplicability: "Applicable to coordination-stage duct/beam clashes.",
});
assert.throws(() => validateLessonProposalContent({ lesson: "", organizationalApplicability: "All projects" }));
assert.throws(() => validateLessonProposalContent({ lesson: "Valid", organizationalApplicability: "Valid", approved: true }));
assert.equal(validateLessonDecision("proposed", "under_review", null), null);
assert.equal(validateLessonDecision("under_review", "approved", "Evidence reviewed."), "Evidence reviewed.");
assert.throws(() => validateLessonDecision("proposed", "approved", "skip review"));
assert.throws(() => validateLessonDecision("under_review", "rejected", ""));
console.log("Coordination Knowledge Build 261 lesson proposal contract: PASS");
