import {
  selectSmartMeetingCarryForward,
  type SmartMeetingCarryForwardCandidate,
  type SmartMeetingCarryForwardKind,
} from "./smart-meetings-continuity";

export interface SmartMeetingAgendaSource extends SmartMeetingCarryForwardCandidate {
  title: string;
  description?: string | null;
  responsible?: string | null;
  dueDate?: Date | null;
}

export interface SmartMeetingAgendaItem extends SmartMeetingAgendaSource {
  identity: string;
  sourceMeetingId: number;
  carriedForward: true;
}

const KIND_ORDER: SmartMeetingCarryForwardKind[] = [
  "agenda_topic",
  "rfi",
  "submittal",
  "action_item",
  "lens_viewpoint",
  "attendee",
];

export function buildSmartMeetingAgenda(
  sourceMeetingId: number,
  sources: SmartMeetingAgendaSource[],
) {
  if (!Number.isInteger(sourceMeetingId) || sourceMeetingId <= 0) {
    throw new Error("invalid_source_meeting_id");
  }

  const selectedIdentities = new Set(
    selectSmartMeetingCarryForward(sources).map(
      (source) => `${source.kind}:${source.sourceId}`,
    ),
  );

  return sources
    .filter((source) => selectedIdentities.has(`${source.kind}:${source.sourceId}`))
    .filter(
      (source, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.kind === source.kind && candidate.sourceId === source.sourceId,
        ) === index,
    )
    .sort((left, right) => {
      const kindDelta = KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind);
      if (kindDelta !== 0) return kindDelta;
      return left.sourceId - right.sourceId;
    })
    .map<SmartMeetingAgendaItem>((source) => ({
      ...source,
      identity: `${source.kind}:${source.sourceId}`,
      sourceMeetingId,
      carriedForward: true,
    }));
}
