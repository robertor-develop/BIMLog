import { assertLessonProposalTransition, type LessonProposalStatus } from "./coordination-knowledge-contract";

export class CoordinationLessonWorkflowError extends Error {
  constructor(public readonly code: string, public readonly field: string) { super(`${code}: ${field}`); }
}

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum)
    throw new CoordinationLessonWorkflowError("LESSON_PROPOSAL_INVALID", field);
  return value.trim();
}

export type LessonProposalContent = Readonly<{ lesson: string; organizationalApplicability: string }>;
export type LessonPromotionTarget = "conflict_type" | "coordination_rule" | "resolution_method";
export type LessonPromotionRequest = Readonly<{ targetEntityType: LessonPromotionTarget; mode: "create" | "revise"; targetId: string | null; code: string | null }>;

export function validateLessonProposalContent(input: unknown): LessonProposalContent {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CoordinationLessonWorkflowError("LESSON_PROPOSAL_INVALID", "proposal");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !["lesson", "organizationalApplicability"].includes(key)))
    throw new CoordinationLessonWorkflowError("LESSON_PROPOSAL_INVALID", "proposal");
  return Object.freeze({
    lesson: boundedText(value.lesson, "lesson", 8000),
    organizationalApplicability: boundedText(value.organizationalApplicability, "organizationalApplicability", 4000),
  });
}

export function validateLessonDecision(from: LessonProposalStatus, to: LessonProposalStatus, rationale: unknown): string | null {
  assertLessonProposalTransition(from, to);
  if (["approved", "rejected", "merged"].includes(to)) return boundedText(rationale, "rationale", 2000);
  if (rationale == null || rationale === "") return null;
  return boundedText(rationale, "rationale", 2000);
}

export function validateLessonPromotionRequest(input: unknown): LessonPromotionRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CoordinationLessonWorkflowError("LESSON_PROMOTION_INVALID", "promotion");
  const value=input as Record<string,unknown>,targetEntityType=value.targetEntityType,mode=value.mode;
  if(!["conflict_type","coordination_rule","resolution_method"].includes(String(targetEntityType)))throw new CoordinationLessonWorkflowError("LESSON_PROMOTION_INVALID","targetEntityType");
  if(mode!=="create"&&mode!=="revise")throw new CoordinationLessonWorkflowError("LESSON_PROMOTION_INVALID","mode");
  const targetId=value.targetId==null?null:boundedText(value.targetId,"targetId",64),code=value.code==null?null:boundedText(value.code,"code",64).toUpperCase();
  if((mode==="revise")!==(targetId!==null)|| (mode==="create")!==(code!==null))throw new CoordinationLessonWorkflowError("LESSON_PROMOTION_INVALID",mode==="revise"?"targetId":"code");
  return Object.freeze({targetEntityType:targetEntityType as LessonPromotionTarget,mode,targetId,code});
}
