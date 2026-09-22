import assert from "node:assert/strict";
import { validateLessonDecision } from "./coordination-lesson-workflow";

assert.equal(validateLessonDecision("under_review","merged","Duplicate of the canonical reviewed proposal."),"Duplicate of the canonical reviewed proposal.");
assert.equal(validateLessonDecision("approved","merged","Consolidated into the canonical approved lesson."),"Consolidated into the canonical approved lesson.");
assert.throws(()=>validateLessonDecision("proposed","merged","Cannot skip review."));
assert.throws(()=>validateLessonDecision("rejected","merged","Cannot revive rejected proposal."));
console.log("Coordination Knowledge Build 264 merge/rejection/history contract: PASS");
