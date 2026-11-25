export const SMART_MEETING_LIFECYCLE_STATES = [
  "draft_agenda",
  "published_agenda",
  "in_progress",
  "draft_minutes",
  "published_minutes",
] as const;

export type SmartMeetingLifecycleState =
  (typeof SMART_MEETING_LIFECYCLE_STATES)[number];

export const SMART_MEETING_CARRY_FORWARD_KINDS = [
  "attendee",
  "agenda_topic",
  "rfi",
  "submittal",
  "action_item",
  "lens_viewpoint",
] as const;

export type SmartMeetingCarryForwardKind =
  (typeof SMART_MEETING_CARRY_FORWARD_KINDS)[number];

export interface SmartMeetingCarryForwardCandidate {
  kind: SmartMeetingCarryForwardKind;
  sourceId: number;
  status?: string | null;
  carriedForward?: boolean;
  excluded?: boolean;
}

const TERMINAL_STATUSES = new Set([
  "closed",
  "completed",
  "resolved",
  "cancelled",
  "canceled",
  "published",
]);

export function normalizeMeetingStatus(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

export function isUnresolvedMeetingItem(
  item: SmartMeetingCarryForwardCandidate,
) {
  if (item.excluded) return false;
  if (item.kind === "attendee") return true;
  return !TERMINAL_STATUSES.has(normalizeMeetingStatus(item.status));
}

export function selectSmartMeetingCarryForward(
  candidates: SmartMeetingCarryForwardCandidate[],
) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (!Number.isInteger(candidate.sourceId) || candidate.sourceId <= 0) {
      return false;
    }
    if (!isUnresolvedMeetingItem(candidate)) return false;
    const identity = `${candidate.kind}:${candidate.sourceId}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function assertSmartMeetingLifecycleTransition(
  current: SmartMeetingLifecycleState,
  next: SmartMeetingLifecycleState,
) {
  const order = SMART_MEETING_LIFECYCLE_STATES.indexOf(current);
  const target = SMART_MEETING_LIFECYCLE_STATES.indexOf(next);
  if (target !== order + 1) {
    throw new Error(`invalid_meeting_lifecycle_transition:${current}:${next}`);
  }
  return next;
}
