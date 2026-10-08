export type CleanupReviewQueue = {
  projectIds: number[];
  currentProjectId: number | null;
  completedCount: number;
};

function boundedUnique(ids: readonly number[]): number[] {
  return [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 50);
}

export function beginCleanupReviewQueue(ids: readonly number[]): CleanupReviewQueue {
  const projectIds = boundedUnique(ids);
  return { projectIds, currentProjectId: projectIds[0] ?? null, completedCount: 0 };
}

export function advanceCleanupReviewQueue(queue: CleanupReviewQueue, reviewedProjectId: number): CleanupReviewQueue {
  if (queue.currentProjectId !== reviewedProjectId) return queue;
  const projectIds = queue.projectIds.filter(id => id !== reviewedProjectId);
  return { projectIds, currentProjectId: projectIds[0] ?? null, completedCount: queue.completedCount + 1 };
}

export function cancelCleanupReviewQueue(): CleanupReviewQueue {
  return { projectIds: [], currentProjectId: null, completedCount: 0 };
}
