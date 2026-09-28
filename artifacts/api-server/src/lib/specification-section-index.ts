export type SpecificationExtractionState = "verified" | "uncertain" | "absent";

export interface SpecificationSectionSource {
  id: string;
  projectId: number;
  sectionNumber: string;
  title: string;
  fileId: number;
  fileRevisionId: string;
  pageStart: number;
  pageEnd: number;
  extractionState: SpecificationExtractionState;
  extractedText?: string | null;
}

export interface SpecificationSectionResult extends SpecificationSectionSource {
  sourceUrl: string;
  searchableText: string | null;
  sourceNotice: string | null;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function indexSpecificationSections(input: {
  projectId: number;
  sections: readonly SpecificationSectionSource[];
}): SpecificationSectionResult[] {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("A valid project is required.");
  const seen = new Set<string>();
  return input.sections.filter(section => section.projectId === input.projectId).map(section => {
    const sectionNumber = required(section.sectionNumber, "Specification section number");
    const fileRevisionId = required(section.fileRevisionId, "File revision identity");
    if (!Number.isSafeInteger(section.fileId) || section.fileId <= 0) throw new Error("A valid source file is required.");
    if (!Number.isSafeInteger(section.pageStart) || !Number.isSafeInteger(section.pageEnd) || section.pageStart <= 0 || section.pageEnd < section.pageStart) {
      throw new Error("A valid specification page range is required.");
    }
    const identity = `${section.fileId}:${fileRevisionId}:${sectionNumber}:${section.pageStart}-${section.pageEnd}`;
    if (seen.has(identity)) throw new Error(`Duplicate specification source: ${identity}`);
    seen.add(identity);
    const text = section.extractedText?.trim() || null;
    if (section.extractionState === "verified" && !text) throw new Error("Verified specification extraction requires source text.");
    return {
      ...section,
      sectionNumber,
      title: required(section.title, "Specification section title"),
      fileRevisionId,
      searchableText: section.extractionState === "verified" ? text : null,
      sourceNotice: section.extractionState === "verified" ? null : section.extractionState === "uncertain"
        ? "Extracted text is uncertain; verify the cited source pages."
        : "No searchable extraction is available; open the cited source pages.",
      sourceUrl: `/projects/${input.projectId}/files/${section.fileId}/revisions/${encodeURIComponent(fileRevisionId)}?page=${section.pageStart}`,
    };
  });
}

export function searchSpecificationSections(sections: readonly SpecificationSectionResult[], query: string): SpecificationSectionResult[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [...sections];
  return sections.filter(section => [section.sectionNumber, section.title, section.searchableText ?? ""]
    .some(value => value.toLocaleLowerCase().includes(term)));
}
