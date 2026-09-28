export interface ReviewedSpecificationRequirement {
  sourceSectionId: string;
  sourceFileRevisionId: string;
  sourcePage: number;
  requirementCode: string;
  title: string;
}

export interface ExistingRegisterRequirement {
  id: string;
  projectId: number;
  sourceIdentity: string | null;
  requirementCode: string;
  manual: boolean;
}

export type RequirementPreviewDisposition = "create" | "duplicate";
export interface RequirementImportPreviewRow extends ReviewedSpecificationRequirement {
  sourceIdentity: string;
  disposition: RequirementPreviewDisposition;
  existingRequirementId: string | null;
}

function sourceIdentity(item: ReviewedSpecificationRequirement): string {
  if (!item.sourceSectionId.trim() || !item.sourceFileRevisionId.trim() || !Number.isSafeInteger(item.sourcePage) || item.sourcePage <= 0) {
    throw new Error("Reviewed requirement source identity is incomplete.");
  }
  return `${item.sourceFileRevisionId.trim()}:${item.sourceSectionId.trim()}:${item.sourcePage}:${item.requirementCode.trim().toLocaleLowerCase()}`;
}

export function previewSpecificationRequirementImport(input: {
  projectId: number;
  reviewed: readonly ReviewedSpecificationRequirement[];
  existing: readonly ExistingRegisterRequirement[];
}): RequirementImportPreviewRow[] {
  const existingBySource = new Map(input.existing.filter(item => item.projectId === input.projectId && item.sourceIdentity)
    .map(item => [item.sourceIdentity!, item]));
  const seen = new Set<string>();
  return input.reviewed.map(item => {
    const identity = sourceIdentity(item);
    const duplicate = existingBySource.get(identity);
    const repeated = seen.has(identity);
    seen.add(identity);
    return { ...item, sourceIdentity: identity, disposition: duplicate || repeated ? "duplicate" : "create", existingRequirementId: duplicate?.id ?? null };
  });
}

export function acceptedRequirementCreates(preview: readonly RequirementImportPreviewRow[]): RequirementImportPreviewRow[] {
  return preview.filter(item => item.disposition === "create");
}
