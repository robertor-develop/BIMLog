import { z } from "zod/v4";
import { createHash } from "node:crypto";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalNullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();

export const meetingParticipantInputSchema = z.object({
  user_id: z.number().int().positive().optional(),
  company_id: z.number().int().positive().optional(),
  directory_entry_id: z.number().int().positive().optional(),
  external_email: z.string().trim().email().max(320).optional(),
  full_name: boundedText(256),
  company: optionalNullableText(256),
  role: optionalNullableText(256),
}).strict();

export const meetingCreateCommandSchema = z.object({
  title: boundedText(500),
  meeting_date: z.string().datetime({ offset: true }),
  location: optionalNullableText(500),
  notes: z.string().max(100_000).nullable().optional(),
  attendees: z.array(meetingParticipantInputSchema).max(500).optional(),
  rfi_ids: z.array(z.number().int().positive()).max(500).optional(),
  submittal_ids: z.array(z.number().int().positive()).max(500).optional(),
  lens_viewpoint_ids: z.array(z.number().int().positive()).max(500).optional(),
}).strict();

export const meetingUpdateCommandSchema = meetingCreateCommandSchema
  .omit({ rfi_ids: true, submittal_ids: true, lens_viewpoint_ids: true })
  .partial()
  .extend({
    ai_summary: z.string().max(100_000).nullable().optional(),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const meetingActionCommandSchema = z.object({
  items: z.array(z.object({
    description: boundedText(8_000),
    assigned_to_id: z.number().int().positive().optional(),
    assigned_to_name: optionalNullableText(256),
    assigned_to_email: z.string().trim().email().max(320).optional(),
    due_date: z.string().date().optional(),
  }).strict()).min(1).max(200),
}).strict();

const currentViewSections = ["summary", "meetings", "actions", "linked_records"] as const;
export type MeetingCurrentViewSection = (typeof currentViewSections)[number];

export function parseMeetingCurrentViewQuery(query: Record<string, unknown>) {
  const language = query.lang === "es" ? "es" : "en";
  const view = query.view === "actions" ? "actions" : "meetings";
  const requested = typeof query.sections === "string"
    ? query.sections.split(",").map((value) => value.trim()).filter(
        (value): value is MeetingCurrentViewSection =>
          currentViewSections.includes(value as MeetingCurrentViewSection),
      )
    : [];
  const defaults: MeetingCurrentViewSection[] = view === "actions"
    ? ["summary", "actions"]
    : ["summary", "meetings", "linked_records"];
  return { language, view, sections: new Set(requested.length ? requested : defaults) } as const;
}

export const safeMeetingReportText = (value: unknown, fallback = "—") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || fallback;
};

export const formatMeetingReportDate = (
  value: unknown,
  language: "en" | "es" = "en",
) => {
  if (!value) return "—";
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(language === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function parseMeetingLegacyAgendaItems(notes: string | null | undefined) {
  if (!notes) return [];
  const block = notes.match(
    /(?:^|\n\n)AGENDA:\n([\s\S]*?)(?=\n\n[A-Z][A-Z /]+:\n|$)/,
  )?.[1];
  if (!block) return [];
  return block
    .split("\n")
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
}

export function nextMeetingVersionTimestamp(
  current: string | Date,
  now = Date.now(),
) {
  const currentMilliseconds = new Date(current).getTime();
  if (!Number.isFinite(currentMilliseconds)) {
    throw new Error("meeting_updated_at_invalid");
  }
  return new Date(Math.max(now, currentMilliseconds + 1));
}

export function meetingCurrentViewSectionLabel(
  token: string,
  language: "en" | "es",
) {
  const labels: Record<string, { en: string; es: string }> = {
    summary: { en: "Summary", es: "Resumen" },
    meetings: { en: "Meeting Register", es: "Registro de reuniones" },
    actions: { en: "Actions", es: "Acciones" },
    linked_records: { en: "Linked Records", es: "Registros vinculados" },
  };
  return labels[token]?.[language] ?? "";
}

export function meetingCommandIdempotencyDigest(
  rawKey: unknown,
  context: { projectId: number; userId: number; command: string },
) {
  if (typeof rawKey !== "string" || !rawKey.trim()) return null;
  const key = rawKey.trim();
  if (key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new Error("meeting_idempotency_key_invalid");
  }
  return createHash("sha256")
    .update(`${context.projectId}:${context.userId}:${context.command}:${key}`)
    .digest("hex");
}

export function parseMeetingCommandReceipt(details: string | null | undefined) {
  if (!details) return null;
  try {
    const value = JSON.parse(details) as Record<string, unknown>;
    return typeof value.idempotencyDigest === "string" ? value : null;
  } catch {
    return null;
  }
}
