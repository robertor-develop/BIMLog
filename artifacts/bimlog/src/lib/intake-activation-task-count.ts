type Scope = { id: string; deliveryWorkflowVersionId?: string; workPackages?: Array<{ tasks?: unknown[] }> };
type Assignment = { scopeItemId: string; workPackageId?: string | null };
type WorkflowOption = { versionId?: string; definition?: { phases?: unknown[] } };
export function expectedIntakeTaskCount(items: Scope[], assignments: Assignment[], workflowOptions: WorkflowOption[] = []): number {
  const phaseCounts = new Map(workflowOptions.map(option => [String(option.versionId ?? ""), option.definition?.phases?.length ?? 0]));
  return items.reduce((total, item) => {
    const packages = item.workPackages ?? [];
    const workflowPhaseTasks = phaseCounts.get(String(item.deliveryWorkflowVersionId ?? "")) ?? 0;
    if (workflowPhaseTasks > 0) {
      const packageTasks = packages.reduce((count, entry) => count + (entry.tasks?.length ?? 0), 0);
      return total + workflowPhaseTasks + packageTasks;
    }
    const scopeTask = !packages.length || assignments.some(row => row.scopeItemId === item.id && !row.workPackageId);
    return total + Number(scopeTask) + packages.reduce((count, entry) =>
      count + ((entry.tasks?.length ?? 0) || (scopeTask ? 0 : 1)), 0);
  }, 0);
}
