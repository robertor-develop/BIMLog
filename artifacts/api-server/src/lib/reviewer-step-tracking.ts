import { businessDuration, type BusinessCalendar } from "./business-calendar";
import type { ReviewerCustodyStep } from "./reviewer-custody-history";

export type ReviewerSequence = "sequential" | "parallel" | "unknown";

export interface ReviewerStepMeasure {
  stepIdentity: string;
  party: string | null;
  company: string | null;
  status: "completed" | "pending" | "unknown";
  returned: boolean;
  elapsedBusinessMinutes: number | null;
  calendarVersion: string;
  openedAt: string | null;
  closedAt: string | null;
}

export function reviewerStepTracking(input: {
  steps: readonly ReviewerCustodyStep[];
  recordCreatedAt: Date | string | null | undefined;
  now: Date | string;
  calendar: BusinessCalendar;
  sequence?: ReviewerSequence;
}) {
  const now = new Date(input.now);
  if (!Number.isFinite(now.getTime())) throw new Error("Reviewer-step clock requires a valid now instant");
  const seen = new Map<string, number>();
  const measures: ReviewerStepMeasure[] = input.steps.map((step, index) => {
    const partyKey = `${step.company ?? ""}\u0000${step.party ?? ""}`;
    const lastIndex = seen.get(partyKey);
    const returned = lastIndex !== undefined && index - lastIndex > 1;
    seen.set(partyKey, index);
    const elapsed = businessDuration({
      from: step.openedAt,
      to: step.intervalState === "open" ? now : step.closedAt,
      calendar: input.calendar,
    });
    return {
      stepIdentity: step.identity,
      party: step.party,
      company: step.company,
      status: step.intervalState === "closed" ? "completed" : step.intervalState === "open" ? "pending" : "unknown",
      returned,
      elapsedBusinessMinutes: elapsed.minutes,
      calendarVersion: elapsed.calendarVersion,
      openedAt: step.openedAt,
      closedAt: step.closedAt,
    };
  });

  const totalAge = businessDuration({ from: input.recordCreatedAt, to: now, calendar: input.calendar });
  const pending = measures.filter(step => step.status === "pending");
  const requestedSequence = input.sequence ?? "unknown";
  const effectiveSequence: ReviewerSequence = requestedSequence === "parallel" && pending.length > 1
    ? "parallel"
    : requestedSequence === "sequential"
      ? "sequential"
      : "unknown";

  return {
    sequence: effectiveSequence,
    steps: measures,
    currentSteps: pending,
    currentStepBusinessMinutes: pending.length === 1 ? pending[0]!.elapsedBusinessMinutes : null,
    parallelPendingBusinessMinutes: effectiveSequence === "parallel"
      ? pending.map(step => ({ stepIdentity: step.stepIdentity, minutes: step.elapsedBusinessMinutes }))
      : [],
    totalRecordAgeBusinessMinutes: totalAge.minutes,
    calendarVersion: input.calendar.version,
  };
}
