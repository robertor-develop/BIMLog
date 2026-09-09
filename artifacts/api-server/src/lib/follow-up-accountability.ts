import { z } from "zod/v4";

export const accountabilityItemSchema = z.object({
  id: z.string().trim().min(1).max(1_024),
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  accountableCompanyId: z.number().int().positive(),
  accountableContactId: z.number().int().positive(),
  assignedUserId: z.number().int().positive().nullable(),
  dueAt: z.string().datetime({ offset: true }),
  status: z.enum(["open", "completed", "cancelled"]),
  lastReminderAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export type AccountabilityState = "not_due" | "due" | "overdue" | "closed";

export function evaluateAccountability(input: unknown, nowInput: string): { state: AccountabilityState; escalationProposed: boolean } {
  const item = accountabilityItemSchema.parse(input);
  const now = z.string().datetime({ offset: true }).transform((value) => new Date(value)).parse(nowInput);
  if (item.status !== "open") return { state: "closed", escalationProposed: false };
  const due = new Date(item.dueAt);
  if (now.getTime() < due.getTime()) return { state: "not_due", escalationProposed: false };
  if (now.getTime() === due.getTime()) return { state: "due", escalationProposed: false };
  return { state: "overdue", escalationProposed: true };
}
