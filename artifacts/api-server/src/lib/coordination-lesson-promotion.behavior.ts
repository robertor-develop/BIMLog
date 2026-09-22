import assert from "node:assert/strict";
import { validateLessonPromotionRequest } from "./coordination-lesson-workflow";

assert.deepEqual(validateLessonPromotionRequest({targetEntityType:"coordination_rule",mode:"create",code:"RULE-01"}),{targetEntityType:"coordination_rule",mode:"create",targetId:null,code:"RULE-01"});
assert.deepEqual(validateLessonPromotionRequest({targetEntityType:"conflict_type",mode:"revise",targetId:"2fdc9ae3-6cd4-4ab0-8fce-9320a4115e27"}),{targetEntityType:"conflict_type",mode:"revise",targetId:"2fdc9ae3-6cd4-4ab0-8fce-9320a4115e27",code:null});
assert.throws(()=>validateLessonPromotionRequest({targetEntityType:"resolution_method",mode:"create"}));
assert.throws(()=>validateLessonPromotionRequest({targetEntityType:"project_case",mode:"create",code:"BAD"}));
console.log("Coordination Knowledge Build 263 controlled lesson promotion contract: PASS");
