type Scope = { id: string; workPackages?: Array<{ tasks?: unknown[] }> };
type Assignment = { scopeItemId: string; workPackageId?: string | null };
export function expectedIntakeTaskCount(items: Scope[], assignments: Assignment[]): number {
  return items.reduce((total, item) => {
    const packages = item.workPackages ?? [];
    const scopeTask = !packages.length || assignments.some(row => row.scopeItemId === item.id && !row.workPackageId);
    return total + Number(scopeTask) + packages.reduce((count, entry) =>
      count + ((entry.tasks?.length ?? 0) || (scopeTask ? 0 : 1)), 0);
  }, 0);
}
