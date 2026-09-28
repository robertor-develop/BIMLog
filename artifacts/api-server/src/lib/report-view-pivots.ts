export type ReportProjectionRow = { dataset: "rfi" | "submittal"; recordId: string; version: number; status: string; company: string | null; reviewerStepId?: string | null };
export type ReportPivot = { groupBy: "status" | "company"; groups: Array<{ key: string; rowCount: number; distinctRecordCount: number; sourceKeys: string[] }> };

export function buildAuthorizedReportPivot(rows: readonly ReportProjectionRow[], groupBy: ReportPivot["groupBy"]): ReportPivot {
  const groups = new Map<string, { rowCount: number; sourceKeys: Set<string> }>();
  for (const row of rows) {
    const key = groupBy === "status" ? row.status : row.company ?? "Unassigned";
    const current = groups.get(key) ?? { rowCount: 0, sourceKeys: new Set<string>() };
    current.rowCount += 1;
    current.sourceKeys.add(`${row.dataset}:${row.recordId}:v${row.version}`);
    groups.set(key, current);
  }
  return { groupBy, groups: [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, rowCount: value.rowCount, distinctRecordCount: value.sourceKeys.size, sourceKeys: [...value.sourceKeys].sort() })) };
}

export function reconcilePivot(pivot: ReportPivot, rows: readonly ReportProjectionRow[]) {
  const rowCount = pivot.groups.reduce((sum, group) => sum + group.rowCount, 0);
  const distinctRecordCount = new Set(pivot.groups.flatMap(group => group.sourceKeys)).size;
  const expectedDistinct = new Set(rows.map(row => `${row.dataset}:${row.recordId}:v${row.version}`)).size;
  return { rowCount, distinctRecordCount, rowsReconcile: rowCount === rows.length, distinctRecordsReconcile: distinctRecordCount === expectedDistinct };
}
