export type HeadquartersProjectState = {
  id: number;
  status?: string | null;
  workspaceGroup?: string | null;
};

const NON_RECOMMENDABLE_STATES = new Set(["archived", "inactive", "retired"]);

export function isHeadquartersRecommendationEligible(project: HeadquartersProjectState): boolean {
  return Number.isSafeInteger(project.id)
    && project.id > 0
    && !NON_RECOMMENDABLE_STATES.has(String(project.status ?? "").trim().toLowerCase())
    && !NON_RECOMMENDABLE_STATES.has(String(project.workspaceGroup ?? "").trim().toLowerCase());
}

export function recommendationEligibleProjects<T extends HeadquartersProjectState>(projects: readonly T[]): T[] {
  return projects.filter(isHeadquartersRecommendationEligible);
}
