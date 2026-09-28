import crypto from "node:crypto";

export type MeetingPackSection = { kind: "agenda" | "minutes" | "actions" | "schedule" | "next_meeting"; sourceId: string; sourceVersion: number; sha256: string };
export type MeetingPackActor = { tenantId: number; projectIds: readonly number[]; permissions: readonly string[] };

export function prepareMeetingPack(input: { tenantId: number; projectId: number; meetingId: string; sections: readonly MeetingPackSection[]; recipients: readonly string[] }, actor: MeetingPackActor) {
  if (actor.tenantId !== input.tenantId || !actor.projectIds.includes(input.projectId) || !actor.permissions.includes("meeting-pack:prepare")) throw new Error("MEETING_PACK_PREPARE_DENIED");
  const expected = ["agenda", "minutes", "actions", "schedule", "next_meeting"];
  const byKind = new Map(input.sections.map(section => [section.kind, section]));
  if (expected.some(kind => !byKind.has(kind as MeetingPackSection["kind"]))) throw new Error("MEETING_PACK_CHAIN_INCOMPLETE");
  if (input.sections.some(section => !/^[a-f0-9]{64}$/i.test(section.sha256))) throw new Error("MEETING_PACK_HASH_INVALID");
  const manifest = { tenantId: input.tenantId, projectId: input.projectId, meetingId: input.meetingId, state: "prepared" as const, sections: expected.map(kind => byKind.get(kind as MeetingPackSection["kind"])!), recipients: [...new Set(input.recipients)].sort(), sendPerformed: false as const };
  return Object.freeze({ ...manifest, sections: Object.freeze(manifest.sections.map(section => Object.freeze({ ...section }))), recipients: Object.freeze(manifest.recipients), fingerprint: crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex") });
}
