export const SMART_MEETING_LIFECYCLE = [
  "draft_agenda",
  "published_agenda",
  "in_progress",
  "draft_minutes",
  "published_minutes",
  "cancelled",
] as const;

export type SmartMeetingLifecycle = (typeof SMART_MEETING_LIFECYCLE)[number];

const transitions: Record<SmartMeetingLifecycle, readonly SmartMeetingLifecycle[]> = {
  draft_agenda: ["published_agenda", "cancelled"],
  published_agenda: ["in_progress", "cancelled"],
  in_progress: ["draft_minutes", "cancelled"],
  draft_minutes: ["published_minutes", "in_progress", "cancelled"],
  published_minutes: [],
  cancelled: [],
};

export function normalizeMeetingLifecycle(value: unknown): SmartMeetingLifecycle {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!SMART_MEETING_LIFECYCLE.includes(normalized as SmartMeetingLifecycle)) {
    throw new Error("meeting_lifecycle_invalid");
  }
  return normalized as SmartMeetingLifecycle;
}

export function assertMeetingLifecycleTransition(
  currentValue: unknown,
  nextValue: unknown,
): { current: SmartMeetingLifecycle; next: SmartMeetingLifecycle; replayed: boolean } {
  const current = normalizeMeetingLifecycle(currentValue);
  const next = normalizeMeetingLifecycle(nextValue);
  if (current === next) return { current, next, replayed: true };
  if (!transitions[current].includes(next)) {
    throw new Error("meeting_lifecycle_transition_denied");
  }
  return { current, next, replayed: false };
}
