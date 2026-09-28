import type { ResponsibilityWorkspaceItem } from "./responsibility-workspace";

const DAY_MS = 86_400_000;
const REVIEW_WAIT_STATUSES = new Set(["in_review", "pending_review", "waiting", "action_required"]);
const BLOCKED_STATUSES = new Set(["blocked", "action_required"]);

function utcDay(value: string | null, field: string): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field}_INVALID`);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function elapsedDays(earlier: number | null, today: number): number | null {
  return earlier === null ? null : Math.max(0, Math.floor((today - earlier) / DAY_MS));
}

export type ResponsibilityClassification = {
  groups: { due: boolean; overdue: boolean; blocked: boolean; noResponse: boolean };
  metrics: { recordAgeDays: number | null; deadlineDaysLate: number | null; reviewerDelayDays: number | null };
  definitions: {
    due: string;
    overdue: string;
    blocked: string;
    noResponse: string;
  };
};

export function classifyResponsibility(item: ResponsibilityWorkspaceItem, now: Date): ResponsibilityClassification {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const deadline = utcDay(item.deadline, "DEADLINE");
  const updated = utcDay(item.sourceUpdatedAt, "SOURCE_UPDATED_AT");
  const status = item.status.trim().toLowerCase();
  const deadlineDelta = deadline === null ? null : Math.floor((today - deadline) / DAY_MS);
  const recordAgeDays = elapsedDays(updated, today);
  const reviewerDelayDays = REVIEW_WAIT_STATUSES.has(status) ? recordAgeDays : null;
  return {
    groups: {
      due: deadline !== null && deadline === today,
      overdue: deadlineDelta !== null && deadlineDelta > 0,
      blocked: BLOCKED_STATUSES.has(status),
      noResponse: reviewerDelayDays !== null && reviewerDelayDays >= 7,
    },
    metrics: {
      recordAgeDays,
      deadlineDaysLate: deadlineDelta !== null && deadlineDelta > 0 ? deadlineDelta : null,
      reviewerDelayDays,
    },
    definitions: {
      due: "Deadline is the current UTC calendar day.",
      overdue: "Deadline is before the current UTC calendar day.",
      blocked: "Canonical presentation status is blocked or action_required.",
      noResponse: "A review/waiting action has not changed for at least seven UTC calendar days.",
    },
  };
}
