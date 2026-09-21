import assert from "node:assert/strict";
import {
  assertKnowledgeTransition,
  assertLessonProposalTransition,
  assertProjectCaseTransition,
  CoordinationKnowledgeContractError,
  knowledgeRevisionFingerprint,
  validateConflictTypeRevision,
  validateCoordinationRuleRevision,
  validateLessonLearnedProposal,
  validateProjectCaseReference,
  validateResolutionMethodRevision,
} from "./coordination-knowledge-contract";

const ids = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(8, "0")}-1111-4111-8111-${String(i + 1).padStart(12, "0")}`);
const conflict = validateConflictTypeRevision({ id: ids[0], conflictTypeId: ids[1], companyId: 7, revision: 1, status: "draft", name: "HVAC Duct vs Structural Beam", description: "Physical clash between an HVAC duct and a structural beam.", disciplineA: "HVAC", disciplineB: "Structural", elementTypeA: "Duct", elementTypeB: "Beam", conflictCategory: "physical_clash", coordinationStage: "coordination", tags: ["routing", "clearance"], authoredById: 12 });
assert.equal(conflict.companyId, 7);
assert.equal(conflict.conflictTypeId, ids[1]);
const rule = validateCoordinationRuleRevision({ id: ids[2], ruleId: ids[3], companyId: 7, revision: 2, status: "approved", title: "Preserve structural integrity", guidance: "Evaluate duct rerouting before requesting a structural change.", applicability: { disciplines: ["HVAC", "Structural"] }, rationale: "Structural modifications require engineering approval.", exceptions: ["Approved engineered opening"], references: [{ title: "Project coordination plan" }], authoredById: 12 });
assert.match(knowledgeRevisionFingerprint(rule), /^[a-f0-9]{64}$/);
const method = validateResolutionMethodRevision({ id: ids[4], resolutionMethodId: ids[5], companyId: 7, revision: 1, status: "under_review", name: "Offset or reroute duct", description: "Reroute the duct around the structural member.", applicability: { stages: ["coordination"] }, responsibleTrade: "HVAC", constraints: ["Maintain required clearance"], advantages: ["Avoids structural change"], disadvantages: ["May affect ceiling height"], requiredApprovals: ["BIM Manager"], rfiRequirement: "conditional", details: { preferredWhen: "Routing space is available" }, conflictTypeIds: [ids[1], ids[6]], ruleRevisionIds: [ids[2]], authoredById: 12 });
assert.equal(method.conflictTypeIds.length, 2);
assert.doesNotThrow(() => assertKnowledgeTransition("draft", "under_review"));
assert.doesNotThrow(() => assertKnowledgeTransition("under_review", "approved"));
assert.doesNotThrow(() => assertKnowledgeTransition("approved", "retired"));
assert.throws(() => assertKnowledgeTransition("draft", "approved"), (error: unknown) => error instanceof CoordinationKnowledgeContractError && error.code === "KNOWLEDGE_TRANSITION_INVALID");
assert.throws(() => assertKnowledgeTransition("retired", "approved"));
assert.doesNotThrow(() => assertProjectCaseTransition("open", "resolved"));
assert.doesNotThrow(() => assertProjectCaseTransition("verified", "open"));
assert.throws(() => assertProjectCaseTransition("open", "verified"));
assert.doesNotThrow(() => assertLessonProposalTransition("proposed", "under_review"));
assert.doesNotThrow(() => assertLessonProposalTransition("under_review", "approved"));
assert.throws(() => assertLessonProposalTransition("proposed", "approved"));
assert.deepEqual(validateProjectCaseReference({ id: ids[7], companyId: 7, projectId: 28, lensViewpointId: 184, conflictTypeRevisionId: null, resolutionMethodRevisionId: null, status: "open", createdById: 12 }), { id: ids[7], companyId: 7, projectId: 28, lensViewpointId: 184, conflictTypeRevisionId: null, resolutionMethodRevisionId: null, status: "open", createdById: 12 });
assert.equal(validateLessonLearnedProposal({ id: ids[8], companyId: 7, projectId: 28, projectCaseId: ids[7], status: "proposed", proposal: "Use this verified project result as a review candidate.", proposedById: 12 }).status, "proposed");
assert.throws(() => validateLessonLearnedProposal({ id: ids[8], companyId: 7, projectId: 28, projectCaseId: ids[7], status: "approved", proposal: "Silent promotion", proposedById: 12 }), (error: unknown) => error instanceof CoordinationKnowledgeContractError && error.code === "LESSON_PROMOTION_REQUIRES_REVIEW_DECISION");
assert.throws(() => validateConflictTypeRevision({ ...conflict, companyId: 0 }), (error: unknown) => error instanceof CoordinationKnowledgeContractError && error.field === "companyId");
assert.throws(() => validateConflictTypeRevision({ ...conflict, tags: ["routing", "ROUTING"] }), (error: unknown) => error instanceof CoordinationKnowledgeContractError && error.field === "tags");
assert.throws(() => validateResolutionMethodRevision({ ...method, conflictTypeIds: [] }), (error: unknown) => error instanceof CoordinationKnowledgeContractError && error.field === "conflictTypeIds");
console.log("Coordination Knowledge Build 226 contract: canonical identities, optional classification, reviewed promotion and lifecycle transitions passed");
