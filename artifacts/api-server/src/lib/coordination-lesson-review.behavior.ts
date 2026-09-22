import assert from "node:assert/strict";
import { validateLessonDecision } from "./coordination-lesson-workflow";

for (const [from,to] of [["proposed","under_review"],["under_review","proposed"],["under_review","approved"],["under_review","rejected"]] as const)
  assert.doesNotThrow(()=>validateLessonDecision(from,to,to==="approved"||to==="rejected"?"Attributable review rationale.":null));
for (const [from,to] of [["proposed","approved"],["approved","rejected"],["rejected","under_review"]] as const)
  assert.throws(()=>validateLessonDecision(from,to,"Invalid transition."));
console.log("Coordination Knowledge Build 262 lesson review workflow: PASS");
