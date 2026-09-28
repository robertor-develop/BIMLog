import assert from "node:assert/strict";import {linkResolvedWorkflowToLessonProposal} from "./knowledge-lesson-proposal-link";
const source={companyId:35,projectId:28,sourceType:"lens_issue" as const,sourceId:"CL-184",sourceRevision:"7",resolutionStatus:"verified" as const,evidenceIds:["FILE-2","FILE-1","FILE-1"]};
const linked=linkResolvedWorkflowToLessonProposal({companyId:35,projectId:28,proposalId:"LP-9",proposalStatus:"proposed",source,existingSourceKeys:[]});
assert.equal(linked.published,false);assert.equal(linked.sourceClosureChanged,false);assert.deepEqual(linked.evidenceIds,["FILE-1","FILE-2"]);assert.equal(linkResolvedWorkflowToLessonProposal({companyId:35,projectId:28,proposalId:"LP-9",proposalStatus:"proposed",source,existingSourceKeys:[linked.sourceKey]}).disposition,"already_linked");
assert.throws(()=>linkResolvedWorkflowToLessonProposal({companyId:31,projectId:28,proposalId:"LP-9",proposalStatus:"proposed",source,existingSourceKeys:[]}));
console.log("C086 resolved workflow to governed lesson proposal: PASS");
