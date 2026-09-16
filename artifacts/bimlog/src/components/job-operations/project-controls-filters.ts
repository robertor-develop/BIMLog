export type ProjectControlsSelection = { scopeId: string; packageId: string; memberId: string; risk: string };

export function filterProjectControlsRows<T extends { id: unknown; packageIds?: unknown; memberIds?: unknown; status?: unknown }>(rows: T[], selection: ProjectControlsSelection): T[] {
  return rows.filter(row =>
    (!selection.scopeId || String(row.id) === selection.scopeId) &&
    (!selection.packageId || (Array.isArray(row.packageIds) && row.packageIds.some(id => String(id) === selection.packageId))) &&
    (!selection.memberId || (Array.isArray(row.memberIds) && row.memberIds.some(id => String(id) === selection.memberId))) &&
    (!selection.risk || row.status === selection.risk),
  );
}

type ControlSource = {
  rows: Array<{ id: unknown; [key: string]: any }>;
  budgetVisible?: boolean;
  valueVisible?: boolean;
};

const numeric = (value: unknown) => Number(value ?? 0);
const fixed = (value: number) => value.toFixed(2);
const ratio = (numerator: number, denominator: number) => denominator > 0 ? Number((numerator / denominator).toFixed(2)) : null;
const forecast = (actual: number, progress: number) => actual > 0 && progress > 0 ? Number((actual / progress).toFixed(2)) : null;

export function attributableProjectControlsRows(input: {
  controls: ControlSource;
  tasks: Array<Record<string, any>>;
  assignments: Array<Record<string, any>>;
  workItems: Array<Record<string, any>>;
  packages: Array<Record<string, any>>;
  packageTasks: Array<Record<string, any>>;
  packageId: string;
  memberId: string;
}) {
  const { controls, tasks, assignments, workItems, packages, packageTasks, packageId, memberId } = input;
  if (!packageId && !memberId) return { rows: controls.rows, excludedUnlinkedAssignments: 0, attributed: false };
  const selectedPackage = packageId ? packages.find(item => String(item.id) === packageId) : null;
  if (packageId && (!selectedPackage || selectedPackage.status === "cancelled")) return { rows: [], excludedUnlinkedAssignments: 0, attributed: true };
  const packageTaskIds = new Set(packageTasks.filter(link => String(link.packageId) === packageId).map(link => String(link.taskId)));
  const taskById = new Map(tasks.filter(task => task.status !== "cancelled").map(task => [String(task.id), task]));
  const memberAssignments = memberId ? assignments.filter(assignment => String(assignment.userId) === memberId) : assignments;
  const excludedUnlinkedAssignments = memberAssignments.filter(assignment => !assignment.taskId && (!packageId || String(assignment.workItemId) === String(selectedPackage?.workItemId))).length;
  const rows = controls.rows.flatMap(source => {
    if (packageId && String(source.id) !== String(selectedPackage?.workItemId)) return [];
    const sourceTasks = tasks.filter(task => String(task.workItemId) === String(source.id) && task.status !== "cancelled" && (!packageId || packageTaskIds.has(String(task.id))));
    const sourceTaskIds = new Set(sourceTasks.map(task => String(task.id)));
    const linkedAssignments = memberAssignments.filter(assignment => String(assignment.workItemId) === String(source.id) && assignment.taskId && sourceTaskIds.has(String(assignment.taskId)));
    const selectedTaskIds = memberId ? new Set(linkedAssignments.map(assignment => String(assignment.taskId))) : sourceTaskIds;
    const selectedTasks = sourceTasks.filter(task => selectedTaskIds.has(String(task.id)));
    if (!selectedTasks.length) return [];
    const plannedHours = memberId ? linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.plannedHours), 0) : selectedTasks.reduce((sum, task) => sum + numeric(task.plannedHours), 0);
    const earnedHours = memberId
      ? linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.plannedHours) * numeric(taskById.get(String(assignment.taskId))?.progressPercent) / 100, 0)
      : selectedTasks.reduce((sum, task) => sum + numeric(task.plannedHours) * numeric(task.progressPercent) / 100, 0);
    const progressPercent = plannedHours > 0 ? Math.max(0, Math.min(100, earnedHours / plannedHours * 100)) : 0;
    const actualHours = linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.actualHours), 0);
    const plannedInternalCost = linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.plannedInternalCost), 0);
    const actualInternalCost = linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.actualHours) * numeric(assignment.internalHourlyRate), 0);
    const plannedBillableValue = linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.plannedBillableValue), 0);
    const workItemRate = workItems.find(item => String(item.id) === String(source.id))?.billingHourlyRate;
    const earnedBillableValue = linkedAssignments.reduce((sum, assignment) => sum + numeric(assignment.actualHours) * numeric(assignment.billingHourlyRate ?? workItemRate), 0);
    const progress = progressPercent / 100;
    const earnedInternalValue = plannedInternalCost * progress;
    const cpi = ratio(earnedInternalValue, actualInternalCost);
    const eacHours = forecast(actualHours, progress);
    const eacCost = forecast(actualInternalCost, progress);
    const relatedPackages = packageId ? (selectedPackage ? [selectedPackage] : []) : packages.filter(item => item.status !== "cancelled" && String(item.workItemId) === String(source.id) && packageTasks.some(link => String(link.packageId) === String(item.id) && selectedTaskIds.has(String(link.taskId))));
    const overduePackages = relatedPackages.filter(item => item.overdue === true).length;
    const blockedPackages = relatedPackages.filter(item => packageTasks.some(link => String(link.packageId) === String(item.id) && selectedTaskIds.has(String(link.taskId)) && taskById.get(String(link.taskId))?.status === "blocked")).length;
    let status = "healthy";
    if (progressPercent === 0 && actualHours === 0) status = "not_started";
    else if (blockedPackages > 0 || (cpi !== null && cpi < .8) || (plannedInternalCost > 0 && actualInternalCost > plannedInternalCost)) status = "critical";
    else if (overduePackages > 0 || (cpi !== null && cpi < 1) || (eacCost !== null && plannedInternalCost > 0 && eacCost > plannedInternalCost) || (eacHours !== null && plannedHours > 0 && eacHours > plannedHours)) status = "warning";
    return [{ ...source, status, progressPercent: Number(progressPercent.toFixed(2)), packageIds: relatedPackages.map(item => item.id), memberIds: memberId ? [Number(memberId)] : [...new Set(linkedAssignments.map(item => Number(item.userId)))],
      overduePackages, blockedPackages, plannedHours: fixed(plannedHours), actualHours: fixed(actualHours), earnedInternalValue: controls.budgetVisible ? fixed(earnedInternalValue) : null,
      estimatedHoursAtCompletion: eacHours?.toFixed(2) ?? null, plannedInternalCost: controls.budgetVisible ? fixed(plannedInternalCost) : null,
      actualInternalCost: controls.budgetVisible ? fixed(actualInternalCost) : null, cpi: controls.budgetVisible ? cpi : null,
      estimatedCostAtCompletion: controls.budgetVisible ? eacCost?.toFixed(2) ?? null : null,
      costVarianceAtCompletion: controls.budgetVisible && eacCost !== null ? fixed(plannedInternalCost - eacCost) : null,
      plannedBillableValue: controls.valueVisible ? fixed(plannedBillableValue) : null, earnedBillableValue: controls.valueVisible ? fixed(earnedBillableValue) : null,
    }];
  });
  return { rows, excludedUnlinkedAssignments, attributed: true };
}
