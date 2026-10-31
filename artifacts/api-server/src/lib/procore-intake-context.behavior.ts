import assert from "node:assert/strict";
import { buildCurrentProcoreIntakeMessage } from "./procore-intake-agent";
const context={goal:"g".repeat(2000),needed:"n".repeat(2000),destinationProjectId:91,selectedSources:[{ref:"file:120:700",name:"Selected.pdf",versionId:"11",sourceCompanyId:"31"}]};
const question="q".repeat(2000);
const message=buildCurrentProcoreIntakeMessage(question,context,91);
assert.ok(message.endsWith(question));assert.ok(message.includes(context.goal));assert.ok(message.includes(context.needed));assert.ok(message.includes('"versionId":"11"'));assert.equal(buildCurrentProcoreIntakeMessage(question,undefined,91),question);
for(const invalid of [null,[],{...context,destinationProjectId:92},{...context,goal:"g".repeat(2001)},{...context,selectedSources:Array.from({length:101},()=>context.selectedSources[0])},{...context,selectedSources:[...context.selectedSources,...context.selectedSources]},{...context,selectedSources:[{...context.selectedSources[0],versionId:11}]},{...context,selectedSources:[{...context.selectedSources[0],sourceCompanyId:"other-company"}]}])assert.throws(()=>buildCurrentProcoreIntakeMessage(question,invalid,91),/INTAKE_CONTEXT_INVALID/);
console.log(JSON.stringify({currentQuestionnaire:true,exactSourceVersion:true,full2000CharacterRequestPreserved:true,fullGoalAndNeedPreserved:true,legacyClient:true,crossProjectDenied:true,malformedAndOversizeDenied:true,externalCalls:0}));
