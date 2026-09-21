import { normalizeSubmittalListQuery, type SubmittalListQuery } from "./submittal-list-query-state";

export type SubmittalPresentationScope = {
  projectId: number;
  visibleSubmittalIds: number[];
  query: SubmittalListQuery;
};

export function createSubmittalPresentationScope(input: {
  projectId: number;
  visibleSubmittalIds: number[];
  query?: Partial<SubmittalListQuery>;
}): SubmittalPresentationScope {
  if (!Number.isInteger(input.projectId) || input.projectId <= 0) throw new Error("Invalid submittal project scope");
  const ids = Array.from(new Set(input.visibleSubmittalIds));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("Invalid submittal identity scope");
  return {
    projectId: input.projectId,
    visibleSubmittalIds: ids,
    query: normalizeSubmittalListQuery(input.query || {}),
  };
}

export function createSubmittalHistoryScope(projectId: number, submittalId: number) {
  if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(submittalId) || submittalId <= 0) {
    throw new Error("Invalid submittal history scope");
  }
  return { projectId, submittalId };
}
