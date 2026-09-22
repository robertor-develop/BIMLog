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

