export function salesInquiryResponseDueAt(receivedAt: Date): Date {
  if (!(receivedAt instanceof Date) || Number.isNaN(receivedAt.getTime())) throw new Error("Sales inquiry received time is invalid");
  const due = new Date(receivedAt);
  let remaining = 1;
  while (remaining > 0) {
    due.setUTCDate(due.getUTCDate() + 1);
    const day = due.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return due;
}

export function salesInquiryIsOverdue(input: { status: string; responseDueAt: Date | null; now?: Date }): boolean {
  if (input.status === "closed") return false;
  if (!input.responseDueAt || Number.isNaN(input.responseDueAt.getTime())) return false;
  return input.responseDueAt.getTime() < (input.now ?? new Date()).getTime();
}
