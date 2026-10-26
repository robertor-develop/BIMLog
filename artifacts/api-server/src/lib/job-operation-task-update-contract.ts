export function isTaskUpdateNoop(current: {
  status: unknown;
  progress_percent: unknown;
  assignee_user_id: unknown;
  start_date: unknown;
  due_date: unknown;
  predecessor_task_ids: unknown;
}, next: {
  status: string;
  progressPercent: number;
  assigneeUserId: number | null;
  startDate: string | null;
  dueDate: string | null;
  predecessorTaskIds: string[];
}) {
  const currentDate = (value: unknown) => value ? String(value).slice(0, 10) : null;
  const sorted = (value: unknown) => Array.isArray(value) ? [...value].map(String).sort() : [];
  return String(current.status) === next.status
    && Number(current.progress_percent) === next.progressPercent
    && (current.assignee_user_id == null ? null : Number(current.assignee_user_id)) === next.assigneeUserId
    && currentDate(current.start_date) === next.startDate
    && currentDate(current.due_date) === next.dueDate
    && JSON.stringify(sorted(current.predecessor_task_ids)) === JSON.stringify([...next.predecessorTaskIds].sort());
}
