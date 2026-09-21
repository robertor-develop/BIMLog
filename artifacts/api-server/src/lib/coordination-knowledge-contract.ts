import { createHash, randomUUID } from "node:crypto";

export const knowledgeStatuses = ["draft", "under_review", "approved", "retired"] as const;
export const lessonProposalStatuses = ["proposed", "under_review", "approved", "rejected", "merged"] as const;
export const projectCaseStatuses = ["open", "resolved", "verified"] as const;
export type KnowledgeStatus = typeof knowledgeStatuses[number];
export type LessonProposalStatus = typeof lessonProposalStatuses[number];
export type ProjectCaseStatus = typeof projectCaseStatuses[number];
export type KnowledgeEntityType = "conflict_type" | "coordination_rule" | "resolution_method" | "project_case" | "lesson_proposal";

const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const stableIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CoordinationKnowledgeContractError extends Error {
  constructor(public readonly code: string, public readonly field: string, message?: string) {
    super(message ?? `${code}: ${field}`);
  }
}

function fail(field: string, code = "COORDINATION_KNOWLEDGE_INVALID"): never {
  throw new CoordinationKnowledgeContractError(code, field);
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(field);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(field);
}
function text(value: unknown, field: string, max = 4000, required = true): string {
  if (typeof value !== "string") fail(field);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) fail(field);
  return normalized;
}
function optionalText(value: unknown, field: string, max = 4000): string | null {
  if (value == null || value === "") return null;
  return text(value, field, max);
}
function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) fail(field);
  return Number(value);
}
function boundedStrings(value: unknown, field: string, maxItems = 50, maxLength = 120): string[] {
  if (!Array.isArray(value) || value.length > maxItems) fail(field);
  const values = value.map((item, index) => text(item, `${field}[${index}]`, maxLength));
  if (new Set(values.map(item => item.toLocaleLowerCase("en-US"))).size !== values.length) fail(field);
  return values;
}
function stableId(value: unknown, field: string): string {
  const parsed = text(value, field, 64);
  if (!stableIdPattern.test(parsed)) fail(field);
  return parsed.toLowerCase();
}
function code(value: unknown, field: string): string {
  const parsed = text(value, field, 64).toUpperCase();
  if (!codePattern.test(parsed)) fail(field);
  return parsed;
}
function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) fail(field);
  return value as T;
}

export type KnowledgeIdentity = {
  id: string;
  companyId: number;
  code: string;
  createdById: number;
  createdAt: string;
};

export type ConflictTypeRevision = {
  id: string;
  conflictTypeId: string;
  companyId: number;
  revision: number;
  status: KnowledgeStatus;
  name: string;
  description: string;
  disciplineA: string;
  disciplineB: string;
  elementTypeA: string;
  elementTypeB: string;
  conflictCategory: string;
  coordinationStage: string;
  tags: string[];
  authoredById: number;
};

export type CoordinationRuleRevision = {
  id: string;
  ruleId: string;
  companyId: number;
  revision: number;
  status: KnowledgeStatus;
  title: string;
  guidance: string;
  applicability: Record<string, unknown>;
  rationale: string;
  exceptions: string[];
  references: Array<Record<string, unknown>>;
  authoredById: number;
};

export type ResolutionMethodRevision = {
  id: string;
  resolutionMethodId: string;
  companyId: number;
  revision: number;
  status: KnowledgeStatus;
  name: string;
  description: string;
  applicability: Record<string, unknown>;
  responsibleTrade: string | null;
  constraints: string[];
  advantages: string[];
  disadvantages: string[];
  requiredApprovals: string[];
  rfiRequirement: "never" | "conditional" | "required";
  details: Record<string, unknown>;
  conflictTypeIds: string[];
  ruleRevisionIds: string[];
  authoredById: number;
};

export type ProjectCaseReference = {
  id: string;
  companyId: number;
  projectId: number;
  lensViewpointId: number;
  conflictTypeRevisionId: string | null;
  resolutionMethodRevisionId: string | null;
  status: ProjectCaseStatus;
  createdById: number;
};

export type LessonLearnedProposal = {
  id: string;
  companyId: number;
  projectId: number;
  projectCaseId: string;
  status: LessonProposalStatus;
  proposal: string;
  proposedById: number;
};

export type KnowledgeRevision = ConflictTypeRevision | CoordinationRuleRevision | ResolutionMethodRevision;

export type KnowledgeEvidence = {
  id: string;
  companyId: number;
  projectId: number;
  entityType: KnowledgeEntityType;
  entityId: string;
  revisionId: string | null;
  fileId: number;
  evidenceRole: "attachment" | "reference" | "before" | "after" | "supporting";
  addedById: number;
};

const knowledgeTransitions: Record<KnowledgeStatus, readonly KnowledgeStatus[]> = {
  draft: ["under_review"],
  under_review: ["draft", "approved"],
  approved: ["retired"],
  retired: [],
};
const lessonTransitions: Record<LessonProposalStatus, readonly LessonProposalStatus[]> = {
  proposed: ["under_review"],
  under_review: ["proposed", "approved", "rejected", "merged"],
  approved: ["merged"],
  rejected: [],
  merged: [],
};
const caseTransitions: Record<ProjectCaseStatus, readonly ProjectCaseStatus[]> = {
  open: ["resolved"],
  resolved: ["open", "verified"],
  verified: ["open"],
};

export function assertKnowledgeTransition(from: KnowledgeStatus, to: KnowledgeStatus): void {
  if (!knowledgeTransitions[from]?.includes(to)) fail("status", "KNOWLEDGE_TRANSITION_INVALID");
}
export function assertLessonProposalTransition(from: LessonProposalStatus, to: LessonProposalStatus): void {
  if (!lessonTransitions[from]?.includes(to)) fail("status", "LESSON_TRANSITION_INVALID");
}
export function assertProjectCaseTransition(from: ProjectCaseStatus, to: ProjectCaseStatus): void {
  if (!caseTransitions[from]?.includes(to)) fail("status", "PROJECT_CASE_TRANSITION_INVALID");
}

export function newKnowledgeId(): string { return randomUUID(); }

export function validateKnowledgeIdentity(input: unknown): KnowledgeIdentity {
  const value = record(input, "identity");
  exactKeys(value, ["id", "companyId", "code", "createdById", "createdAt"], "identity");
  const createdAt = text(value.createdAt, "createdAt", 40);
  if (!Number.isFinite(Date.parse(createdAt))) fail("createdAt");
  return { id: stableId(value.id, "id"), companyId: positiveInteger(value.companyId, "companyId"), code: code(value.code, "code"), createdById: positiveInteger(value.createdById, "createdById"), createdAt };
}

export function validateConflictTypeRevision(input: unknown): ConflictTypeRevision {
  const value = record(input, "conflictTypeRevision");
  exactKeys(value, ["id", "conflictTypeId", "companyId", "revision", "status", "name", "description", "disciplineA", "disciplineB", "elementTypeA", "elementTypeB", "conflictCategory", "coordinationStage", "tags", "authoredById"], "conflictTypeRevision");
  return {
    id: stableId(value.id, "id"), conflictTypeId: stableId(value.conflictTypeId, "conflictTypeId"), companyId: positiveInteger(value.companyId, "companyId"), revision: positiveInteger(value.revision, "revision"), status: oneOf(value.status, knowledgeStatuses, "status"),
    name: text(value.name, "name", 200), description: text(value.description, "description", 8000), disciplineA: text(value.disciplineA, "disciplineA", 120), disciplineB: text(value.disciplineB, "disciplineB", 120), elementTypeA: text(value.elementTypeA, "elementTypeA", 160), elementTypeB: text(value.elementTypeB, "elementTypeB", 160), conflictCategory: text(value.conflictCategory, "conflictCategory", 120), coordinationStage: text(value.coordinationStage, "coordinationStage", 120), tags: boundedStrings(value.tags, "tags"), authoredById: positiveInteger(value.authoredById, "authoredById"),
  };
}

export function validateCoordinationRuleRevision(input: unknown): CoordinationRuleRevision {
  const value = record(input, "coordinationRuleRevision");
  exactKeys(value, ["id", "ruleId", "companyId", "revision", "status", "title", "guidance", "applicability", "rationale", "exceptions", "references", "authoredById"], "coordinationRuleRevision");
  const applicability = record(value.applicability, "applicability");
  if (!Array.isArray(value.references) || value.references.length > 50) fail("references");
  const references = value.references.map((item, index) => record(item, `references[${index}]`));
  return { id: stableId(value.id, "id"), ruleId: stableId(value.ruleId, "ruleId"), companyId: positiveInteger(value.companyId, "companyId"), revision: positiveInteger(value.revision, "revision"), status: oneOf(value.status, knowledgeStatuses, "status"), title: text(value.title, "title", 240), guidance: text(value.guidance, "guidance", 16000), applicability, rationale: text(value.rationale, "rationale", 8000), exceptions: boundedStrings(value.exceptions, "exceptions", 50, 1000), references, authoredById: positiveInteger(value.authoredById, "authoredById") };
}

export function validateResolutionMethodRevision(input: unknown): ResolutionMethodRevision {
  const value = record(input, "resolutionMethodRevision");
  exactKeys(value, ["id", "resolutionMethodId", "companyId", "revision", "status", "name", "description", "applicability", "responsibleTrade", "constraints", "advantages", "disadvantages", "requiredApprovals", "rfiRequirement", "details", "conflictTypeIds", "ruleRevisionIds", "authoredById"], "resolutionMethodRevision");
  const conflictTypeIds = boundedStrings(value.conflictTypeIds, "conflictTypeIds").map((item, index) => stableId(item, `conflictTypeIds[${index}]`));
  if (conflictTypeIds.length === 0) fail("conflictTypeIds");
  const ruleRevisionIds = boundedStrings(value.ruleRevisionIds, "ruleRevisionIds").map((item, index) => stableId(item, `ruleRevisionIds[${index}]`));
  return { id: stableId(value.id, "id"), resolutionMethodId: stableId(value.resolutionMethodId, "resolutionMethodId"), companyId: positiveInteger(value.companyId, "companyId"), revision: positiveInteger(value.revision, "revision"), status: oneOf(value.status, knowledgeStatuses, "status"), name: text(value.name, "name", 200), description: text(value.description, "description", 8000), applicability: record(value.applicability, "applicability"), responsibleTrade: optionalText(value.responsibleTrade, "responsibleTrade", 120), constraints: boundedStrings(value.constraints, "constraints", 50, 1000), advantages: boundedStrings(value.advantages, "advantages", 50, 1000), disadvantages: boundedStrings(value.disadvantages, "disadvantages", 50, 1000), requiredApprovals: boundedStrings(value.requiredApprovals, "requiredApprovals", 25, 200), rfiRequirement: oneOf(value.rfiRequirement, ["never", "conditional", "required"] as const, "rfiRequirement"), details: record(value.details, "details"), conflictTypeIds, ruleRevisionIds, authoredById: positiveInteger(value.authoredById, "authoredById") };
}

export function validateProjectCaseReference(input: unknown): ProjectCaseReference {
  const value = record(input, "projectCase");
  exactKeys(value, ["id", "companyId", "projectId", "lensViewpointId", "conflictTypeRevisionId", "resolutionMethodRevisionId", "status", "createdById"], "projectCase");
  return { id: stableId(value.id, "id"), companyId: positiveInteger(value.companyId, "companyId"), projectId: positiveInteger(value.projectId, "projectId"), lensViewpointId: positiveInteger(value.lensViewpointId, "lensViewpointId"), conflictTypeRevisionId: value.conflictTypeRevisionId == null ? null : stableId(value.conflictTypeRevisionId, "conflictTypeRevisionId"), resolutionMethodRevisionId: value.resolutionMethodRevisionId == null ? null : stableId(value.resolutionMethodRevisionId, "resolutionMethodRevisionId"), status: oneOf(value.status, projectCaseStatuses, "status"), createdById: positiveInteger(value.createdById, "createdById") };
}

export function validateLessonLearnedProposal(input: unknown): LessonLearnedProposal {
  const value = record(input, "lessonProposal");
  exactKeys(value, ["id", "companyId", "projectId", "projectCaseId", "status", "proposal", "proposedById"], "lessonProposal");
  const status = oneOf(value.status, lessonProposalStatuses, "status");
  if (status !== "proposed" && status !== "under_review") fail("status", "LESSON_PROMOTION_REQUIRES_REVIEW_DECISION");
  return { id: stableId(value.id, "id"), companyId: positiveInteger(value.companyId, "companyId"), projectId: positiveInteger(value.projectId, "projectId"), projectCaseId: stableId(value.projectCaseId, "projectCaseId"), status, proposal: text(value.proposal, "proposal", 16000), proposedById: positiveInteger(value.proposedById, "proposedById") };
}

export function knowledgeRevisionFingerprint(input: KnowledgeRevision): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
