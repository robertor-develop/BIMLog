export interface SmartMeetingSeriesInput {
  name: string;
  meetingType?: string;
  frequency: "weekly" | "biweekly";
  weekDays: number[];
  startTime: string;
  durationMinutes: number;
  timeZone: string;
  agendaLeadDays?: number;
  agendaPolicy?: Record<string, boolean>;
}

const ALLOWED_POLICY_KEYS = new Set([
  "previousAttendees",
  "unresolvedAgendaItems",
  "openRfis",
  "pendingSubmittals",
  "openActionItems",
  "unresolvedLensViewpoints",
  "newRfisSinceLastMeeting",
  "newSubmittalsSinceLastMeeting",
]);

export function normalizeSmartMeetingSeries(input: SmartMeetingSeriesInput) {
  const name = input.name.trim();
  if (!name) throw new Error("meeting_series_name_required");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
    throw new Error("meeting_series_start_time_invalid");
  }
  const weekDays = [...new Set(input.weekDays)].sort((a, b) => a - b);
  if (!weekDays.length || weekDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("meeting_series_week_days_invalid");
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 720) {
    throw new Error("meeting_series_duration_invalid");
  }
  const agendaLeadDays = input.agendaLeadDays ?? 2;
  if (!Number.isInteger(agendaLeadDays) || agendaLeadDays < 0 || agendaLeadDays > 30) {
    throw new Error("meeting_series_agenda_lead_invalid");
  }
  const agendaPolicy = Object.fromEntries(
    Object.entries(input.agendaPolicy ?? {}).filter(
      ([key, value]) => ALLOWED_POLICY_KEYS.has(key) && typeof value === "boolean",
    ),
  );
  return {
    name,
    meetingType: input.meetingType?.trim() || "coordination",
    frequency: input.frequency,
    intervalCount: input.frequency === "biweekly" ? 2 : 1,
    weekDays,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    timeZone: input.timeZone.trim() || "America/New_York",
    agendaLeadDays,
    agendaPolicy,
  };
}
