export type MeetingCurrentViewScope = {
  query: string;
  from: Date | null;
  to: Date | null;
  actionStatus: string | null;
};

const boundedQueryText = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

const boundedDate = (value: unknown, endOfDay = false) => {
  const text = boundedQueryText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function parseMeetingCurrentViewScope(query: Record<string, unknown>): MeetingCurrentViewScope {
  const from = boundedDate(query.from);
  const to = boundedDate(query.to, true);
  if (from && to && from.getTime() > to.getTime()) throw new Error("meeting_view_date_range_invalid");
  const requestedStatus = boundedQueryText(query.action_status, 40).toLowerCase();
  return {
    query: boundedQueryText(query.q, 200).toLowerCase(),
    from,
    to,
    actionStatus: requestedStatus && requestedStatus !== "all" ? requestedStatus : null,
  };
}

const includesQuery = (query: string, values: unknown[]) =>
  !query || values.some((value) => String(value ?? "").toLowerCase().includes(query));

const inDateRange = (value: unknown, scope: MeetingCurrentViewScope) => {
  const time = new Date(value as string | Date).getTime();
  if (Number.isNaN(time)) return false;
  return (!scope.from || time >= scope.from.getTime()) && (!scope.to || time <= scope.to.getTime());
};

export function filterMeetingCurrentView<
  M extends { title?: unknown; notes?: unknown; location?: unknown; meetingDate: unknown },
  A extends { description?: unknown; assignedToName?: unknown; status?: unknown; createdAt: unknown },
>(meetings: M[], actions: A[], scope: MeetingCurrentViewScope) {
  return {
    meetings: meetings.filter((meeting) =>
      inDateRange(meeting.meetingDate, scope) &&
      includesQuery(scope.query, [meeting.title, meeting.notes, meeting.location]),
    ),
    actions: actions.filter((action) =>
      inDateRange(action.createdAt, scope) &&
      (!scope.actionStatus || String(action.status ?? "").toLowerCase() === scope.actionStatus) &&
      includesQuery(scope.query, [action.description, action.assignedToName, action.status]),
    ),
  };
}

export function meetingCurrentViewScopeSummary(scope: MeetingCurrentViewScope) {
  return {
    q: scope.query || null,
    from: scope.from?.toISOString() ?? null,
    to: scope.to?.toISOString() ?? null,
    actionStatus: scope.actionStatus,
  };
}
