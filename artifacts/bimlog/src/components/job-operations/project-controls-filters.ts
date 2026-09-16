export type ProjectControlsSelection = { scopeId: string; packageId: string; memberId: string; risk: string };

export function filterProjectControlsRows<T extends { id: unknown; packageIds?: unknown; memberIds?: unknown; status?: unknown }>(rows: T[], selection: ProjectControlsSelection): T[] {
  return rows.filter(row =>
    (!selection.scopeId || String(row.id) === selection.scopeId) &&
    (!selection.packageId || (Array.isArray(row.packageIds) && row.packageIds.some(id => String(id) === selection.packageId))) &&
    (!selection.memberId || (Array.isArray(row.memberIds) && row.memberIds.some(id => String(id) === selection.memberId))) &&
    (!selection.risk || row.status === selection.risk),
  );
}
