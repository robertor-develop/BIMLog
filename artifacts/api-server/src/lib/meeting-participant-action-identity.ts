import { meetingActionCommandSchema, meetingParticipantInputSchema } from "./meeting-minute-contracts";

export type MeetingParticipantInput = ReturnType<typeof meetingParticipantInputSchema.parse>;
export type MeetingActionInput = ReturnType<typeof meetingActionCommandSchema.parse>["items"][number];

const normalizedEmail = (value?: string | null) => value?.trim().toLowerCase() || null;
const normalizedText = (value?: string | null) => value?.trim().replace(/\s+/g, " ") || null;

export function meetingParticipantIdentity(input: MeetingParticipantInput) {
  if (input.user_id) return `user:${input.user_id}`;
  if (input.directory_entry_id) return `directory:${input.directory_entry_id}`;
  const email = normalizedEmail(input.external_email);
  if (email) return `external:${email}`;
  return `named:${normalizedText(input.full_name)?.toLowerCase()}|${normalizedText(input.company)?.toLowerCase() ?? ""}`;
}

export function resolveMeetingParticipants(raw: unknown) {
  const inputs = Array.isArray(raw) ? raw.map((value) => meetingParticipantInputSchema.parse(value)) : [];
  const identities = new Set<string>();
  return inputs.map((input) => {
    const identity = meetingParticipantIdentity(input);
    if (identities.has(identity)) throw new Error("meeting_participant_duplicate_identity");
    identities.add(identity);
    return {
      identity,
      userId: input.user_id ?? null,
      companyId: input.company_id ?? null,
      directoryEntryId: input.directory_entry_id ?? null,
      externalEmail: normalizedEmail(input.external_email),
      fullName: normalizedText(input.full_name)!,
      company: normalizedText(input.company),
      role: normalizedText(input.role),
    };
  });
}

export function meetingActionAssigneeIdentity(input: MeetingActionInput) {
  if (input.assigned_to_id) return `user:${input.assigned_to_id}`;
  const email = normalizedEmail(input.assigned_to_email);
  if (email) return `external:${email}`;
  const name = normalizedText(input.assigned_to_name);
  return name ? `named:${name.toLowerCase()}` : null;
}

export function resolveMeetingActionInputs(raw: unknown) {
  const { items } = meetingActionCommandSchema.parse(raw);
  return items.map((input) => ({
    assigneeIdentity: meetingActionAssigneeIdentity(input),
    description: normalizedText(input.description)!,
    assignedToId: input.assigned_to_id ?? null,
    assignedToName: normalizedText(input.assigned_to_name),
    assignedToExternalEmail: normalizedEmail(input.assigned_to_email),
    dueDate: input.due_date ? new Date(`${input.due_date}T00:00:00.000Z`) : null,
  }));
}
