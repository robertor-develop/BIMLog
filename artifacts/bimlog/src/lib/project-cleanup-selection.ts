export type ProjectCleanupRow = {
  id: number;
  name: string;
  code: string;
  status: string;
  workspaceGroup?: "active" | "testing" | "retired";
  canManageLifecycle?: boolean;
  updatedAt: string;
  memberCount?: number;
  fileCount?: number;
};

export type ProjectCleanupSummary = {
  selectedCount: number;
  activeCount: number;
  testingCount: number;
  retiredCount: number;
  memberCount: number;
  fileCount: number;
};

export const PROTECTED_WORKING_PROJECT_CODES = new Set(["PRO-521-TEST", "ELA01", "IBQ-LIT"]);

export type ProjectCleanupClassification = "protected-working" | "preferred-testing" | "testing-review" | "active-review" | "retired";

export function classifyCleanupRow(row: ProjectCleanupRow, preferredTestProjectId: number | null): ProjectCleanupClassification {
  if (row.workspaceGroup === "retired" || row.status === "archived") return "retired";
  if (PROTECTED_WORKING_PROJECT_CODES.has(row.code.trim().toUpperCase())) return "protected-working";
  if (row.workspaceGroup === "testing" || row.status === "testing") {
    return row.id === preferredTestProjectId ? "preferred-testing" : "testing-review";
  }
  return "active-review";
}

export function testingCleanupCandidateIds(rows: ProjectCleanupRow[], preferredTestProjectId: number | null): number[] {
  return selectableCleanupRows(rows)
    .filter(row => classifyCleanupRow(row, preferredTestProjectId) === "testing-review")
    .map(row => row.id);
}

export function retirementReviewQueue(rows: ProjectCleanupRow[], selectedIds: ReadonlySet<number>, preferredTestProjectId: number | null): number[] {
  return rows
    .filter(row => selectedIds.has(row.id) && classifyCleanupRow(row, preferredTestProjectId) === "testing-review")
    .map(row => row.id);
}

export function selectableCleanupRows(rows: ProjectCleanupRow[]): ProjectCleanupRow[] {
  return rows.filter(row => row.canManageLifecycle === true);
}

export function reconcileCleanupSelection(selectedIds: ReadonlySet<number>, rows: ProjectCleanupRow[]): Set<number> {
  const allowed = new Set(selectableCleanupRows(rows).map(row => row.id));
  return new Set([...selectedIds].filter(id => allowed.has(id)));
}

export function toggleCleanupSelection(selectedIds: ReadonlySet<number>, projectId: number): Set<number> {
  const next = new Set(selectedIds);
  if (next.has(projectId)) next.delete(projectId);
  else next.add(projectId);
  return next;
}

export function summarizeCleanupSelection(rows: ProjectCleanupRow[], selectedIds: ReadonlySet<number>): ProjectCleanupSummary {
  return rows.reduce<ProjectCleanupSummary>((summary, row) => {
    if (!selectedIds.has(row.id)) return summary;
    summary.selectedCount += 1;
    summary.memberCount += Number(row.memberCount || 0);
    summary.fileCount += Number(row.fileCount || 0);
    if (row.workspaceGroup === "retired" || row.status === "archived") summary.retiredCount += 1;
    else if (row.workspaceGroup === "testing" || row.status === "testing") summary.testingCount += 1;
    else summary.activeCount += 1;
    return summary;
  }, { selectedCount: 0, activeCount: 0, testingCount: 0, retiredCount: 0, memberCount: 0, fileCount: 0 });
}

export function toWorkspaceStateBatchItems(rows: ProjectCleanupRow[], selectedIds: ReadonlySet<number>) {
  return rows.filter(row => selectedIds.has(row.id)).map(row => ({ projectId: row.id, expectedUpdatedAt: row.updatedAt }));
}
