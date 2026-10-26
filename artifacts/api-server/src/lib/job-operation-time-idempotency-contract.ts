export type StoredJobOperationTime = {
  projectId: number;
  taskId: string;
  assignmentId: string | null;
  userId: number;
  workDate: string;
  hours: string;
  note: string;
  createdById: number;
};

export type RequestedJobOperationTime = StoredJobOperationTime;

function scaledHours(value: string) {
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
}

export function isExactJobOperationTimeReplay(
  stored: StoredJobOperationTime,
  requested: RequestedJobOperationTime,
) {
  return stored.projectId === requested.projectId
    && stored.taskId === requested.taskId
    && stored.assignmentId === requested.assignmentId
    && stored.userId === requested.userId
    && stored.workDate === requested.workDate
    && scaledHours(stored.hours) === scaledHours(requested.hours)
    && stored.note === requested.note
    && stored.createdById === requested.createdById;
}
