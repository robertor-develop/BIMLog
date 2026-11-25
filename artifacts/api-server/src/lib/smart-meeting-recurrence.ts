export interface MeetingRecurrenceRule {
  frequency: "weekly" | "biweekly";
  weekDays: number[];
  startTime: string;
  timeZone: string;
}

function parseStartTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("invalid_meeting_start_time");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("invalid_meeting_start_time");
  return { hour, minute };
}

export function nextMeetingOccurrence(
  rule: MeetingRecurrenceRule,
  after: Date,
) {
  const days = [...new Set(rule.weekDays)].filter((day) => day >= 0 && day <= 6);
  if (!days.length) throw new Error("meeting_week_day_required");
  const { hour, minute } = parseStartTime(rule.startTime);
  const intervalWeeks = rule.frequency === "biweekly" ? 2 : 1;
  for (let offset = 0; offset <= 21; offset += 1) {
    const candidate = new Date(after);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    candidate.setUTCHours(hour, minute, 0, 0);
    if (candidate <= after || !days.includes(candidate.getUTCDay())) continue;
    const weeksFromEpoch = Math.floor(candidate.getTime() / 604_800_000);
    if (weeksFromEpoch % intervalWeeks === 0) return candidate;
  }
  throw new Error("meeting_occurrence_not_found");
}

export function meetingOccurrenceKey(seriesId: number, occurrence: Date) {
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new Error("invalid_series_id");
  return `meeting-series:${seriesId}:${occurrence.toISOString()}`;
}
