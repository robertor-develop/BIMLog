export type DailyTask = {
  id: string;
  nameEn?: string;
  nameEs?: string;
  status: string;
  progressPercent?: number | string;
  plannedHours?: number | string;
  actualHours?: number | string;
  assigneeUserId?: number | string | null;
  dueDate?: string | null;
  canControl?: boolean;
};

export type DailyAssignment = {
  id: string;
  taskId?: string | null;
  userId?: number | string | null;
  personName?: string | null;
  internalHourlyRate?: number | string | null;
  billingHourlyRate?: number | string | null;
};

const active = (task: DailyTask) => !["complete", "cancelled"].includes(task.status);
const person = (value: unknown) => Number(value || 0);
const due = (task: DailyTask) => task.dueDate || "9999-12-31";

export function buildDailyWorkQueues(tasks: DailyTask[], assignments: DailyAssignment[], currentUserId: number, canManage: boolean) {
  const assigned = tasks.filter((task) => active(task) && (
    person(task.assigneeUserId) === currentUserId ||
    assignments.some((assignment) => assignment.taskId === task.id && person(assignment.userId) === currentUserId)
  ));
  const visible = canManage ? tasks.filter(active) : assigned;
  const order = (left: DailyTask, right: DailyTask) =>
    Number(right.status === "blocked") - Number(left.status === "blocked") || due(left).localeCompare(due(right));
  return {
    assigned: [...assigned].sort(order),
    blockers: visible.filter((task) => task.status === "blocked").sort(order),
    unassigned: canManage ? tasks.filter((task) => active(task) && !task.assigneeUserId && !assignments.some((assignment) => assignment.taskId === task.id && assignment.userId)).sort(order) : [],
  };
}

export function focusTask(taskId: string) {
  const element = document.getElementById(`jo-task-${taskId}`);
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  element?.focus({ preventScroll: true });
}

export function taskCostBinding(task: DailyTask, assignments: DailyAssignment[], members: Array<{ id: number | string; profileInternalHourlyRate?: number | string | null }>) {
  const priced = assignments.find((assignment) => assignment.taskId === task.id && assignment.internalHourlyRate != null);
  const member = members.find((candidate) => person(candidate.id) === person(task.assigneeUserId));
  return {
    assignment: priced ?? null,
    approvedProfileRate: member?.profileInternalHourlyRate ?? null,
    operationalOnly: Boolean(task.assigneeUserId) && !priced,
  };
}

export function nextTaskAction(task: DailyTask, packages: Array<{ status: string; responsibleUserId?: number | string | null }>, currentUserId: number, canManage: boolean) {
  if (task.status === "complete") return { key: "review", actor: "Independent reviewer", eligible: false };
  if (task.status === "blocked") return { key: "unblock", actor: task.assigneeUserId ? "Assignee or project leader" : "Project leader", eligible: Boolean(task.canControl || canManage) };
  if (!task.assigneeUserId) return { key: "assign", actor: "Project leader", eligible: canManage };
  if (packages.some((item) => ["internal_review", "submitted"].includes(item.status))) {
    return { key: "review", actor: "Independent reviewer", eligible: canManage && !packages.some((item) => person(item.responsibleUserId) === currentUserId) };
  }
  return { key: "work", actor: "Assigned member", eligible: Boolean(task.canControl) };
}

const numeric = (value: unknown) => Number(value ?? 0);
export function operationalHourMetrics(plannedValue: unknown, actualValue: unknown, progressValue: unknown) {
  const planned = Math.max(0, numeric(plannedValue));
  const actual = Math.max(0, numeric(actualValue));
  const progressPercent = Math.min(100, Math.max(0, numeric(progressValue)));
  const unused = Math.max(0, planned - actual);
  const estimatedAtCompletion = progressPercent > 0 ? actual / (progressPercent / 100) : null;
  const estimatedRemaining = progressPercent >= 100 ? 0 : estimatedAtCompletion == null ? null : Math.max(0, estimatedAtCompletion - actual);
  return { planned, actual, unused, progressPercent, estimatedAtCompletion, estimatedRemaining };
}

export function canonicalDocumentLauncher(projectId: number, taskId: string, entityType: "rfi" | "file_revision" | "transmittal") {
  const returnTo = `/projects/${projectId}/operations?taskId=${encodeURIComponent(taskId)}`;
  const routes = {
    rfi: `/projects/${projectId}/rfis?create=1&operationTaskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(returnTo)}`,
    file_revision: `/projects/${projectId}/files?operationTaskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(returnTo)}`,
    transmittal: `/projects/${projectId}/transmittals?operationTaskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(returnTo)}`,
  };
  return routes[entityType];
}

export type OperationalDocumentReturn = { taskId: string; returnTo: string };

export function safeOperationsReturnTarget(value: string | null, projectId: number): OperationalDocumentReturn | null {
  if (!value || !Number.isSafeInteger(projectId) || projectId < 1 || value.length > 500 || value.includes("#") || value.includes("\\")) return null;
  const [pathname, query = ""] = value.split("?");
  if (pathname !== `/projects/${projectId}/operations`) return null;
  const params = new URLSearchParams(query);
  const taskId = params.get("taskId")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(taskId) || [...params.keys()].some(key => key !== "taskId")) return null;
  return { taskId, returnTo: `${pathname}?taskId=${encodeURIComponent(taskId)}` };
}

/** Accept only the exact Operations task that launched the document workflow. */
export function parseOperationalDocumentReturn(search: string, projectId: number): OperationalDocumentReturn | null {
  if (!Number.isSafeInteger(projectId) || projectId < 1) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const taskId = params.get("operationTaskId")?.trim() ?? "";
  const rawReturn = params.get("returnTo") ?? "";
  const target = safeOperationsReturnTarget(rawReturn, projectId);
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(taskId) || target?.taskId !== taskId) return null;
  return target;
}
