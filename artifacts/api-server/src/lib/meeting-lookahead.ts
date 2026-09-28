import type { SchedulePlacement } from "./meeting-schedule-placement";

export type LookaheadConstraint = { id: string; state: "open" | "resolved"; ownerUserId: number; evidenceIds: readonly string[] };
export type LookaheadItem = SchedulePlacement & { ownerUserId: number; title: string; constraints: readonly LookaheadConstraint[] };

function day(value: string) { return Date.parse(`${value}T00:00:00Z`); }

export function buildMeetingLookahead(input: { asOfDate: string; weeks: 2 | 6; items: readonly LookaheadItem[] }) {
  const start = day(input.asOfDate);
  if (!Number.isFinite(start)) throw new Error("LOOKAHEAD_DATE_INVALID");
  const end = start + input.weeks * 7 * 86_400_000;
  const items = input.items.filter(item => day(item.plannedStart) <= end && day(item.plannedFinish) >= start).map(item => {
    const constraints = item.constraints.map(constraint => {
      if (constraint.state === "open" && (!constraint.ownerUserId || !constraint.evidenceIds.length)) throw new Error("LOOKAHEAD_CONSTRAINT_ACCOUNTABILITY_REQUIRED");
      return Object.freeze({ ...constraint, evidenceIds: Object.freeze([...constraint.evidenceIds]) });
    });
    const blocked = constraints.some(constraint => constraint.state === "open");
    const late = !blocked && day(item.plannedFinish) < start;
    return Object.freeze({ ...item, constraints: Object.freeze(constraints), condition: blocked ? "blocked" as const : late ? "late" as const : "planned" as const });
  }).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.commitmentId.localeCompare(b.commitmentId));
  return Object.freeze({ asOfDate: input.asOfDate, weeks: input.weeks, horizonEnd: new Date(end).toISOString().slice(0, 10), items: Object.freeze(items) });
}
