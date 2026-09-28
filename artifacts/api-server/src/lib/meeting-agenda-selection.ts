import crypto from "node:crypto";

export type AgendaSourceKind = "rfi" | "submittal" | "meeting_action" | "schedule_task" | "lens_issue";
export type AgendaSource = {
  tenantId: number;
  projectId: number;
  kind: AgendaSourceKind;
  sourceId: string;
  sourceVersion: number;
  title: string;
  status: string;
  dueDate?: string;
  blocked?: boolean;
  sourceUrl: string;
};

export type MeetingAgendaSnapshot = {
  tenantId: number;
  projectId: number;
  meetingId: string;
  capturedAt: string;
  items: readonly (AgendaSource & { reason: "overdue" | "blocked" })[];
  fingerprint: string;
};

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("AGENDA_DATE_INVALID");
  return value;
}

export function buildMeetingAgenda(input: {
  tenantId: number;
  projectId: number;
  meetingId: string;
  capturedAt: string;
  sources: readonly AgendaSource[];
}): MeetingAgendaSnapshot {
  if (!input.meetingId.trim() || Number.isNaN(Date.parse(input.capturedAt))) throw new Error("AGENDA_IDENTITY_INVALID");
  const today = input.capturedAt.slice(0, 10);
  const seen = new Set<string>();
  const items = input.sources.flatMap(source => {
    if (source.tenantId !== input.tenantId || source.projectId !== input.projectId) throw new Error("AGENDA_SOURCE_SCOPE_DENIED");
    const key = `${source.kind}:${source.sourceId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const overdue = Boolean(source.dueDate && dateOnly(source.dueDate) < today && !/closed|complete|resolved/i.test(source.status));
    if (!source.blocked && !overdue) return [];
    return [{ ...source, reason: source.blocked ? "blocked" as const : "overdue" as const }];
  }).sort((a, b) => `${a.reason}:${a.kind}:${a.sourceId}`.localeCompare(`${b.reason}:${b.kind}:${b.sourceId}`));
  const body = { tenantId: input.tenantId, projectId: input.projectId, meetingId: input.meetingId, capturedAt: input.capturedAt, items };
  return Object.freeze({ ...body, items: Object.freeze(items.map(item => Object.freeze(item))), fingerprint: crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
