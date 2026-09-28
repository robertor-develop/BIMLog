export type CommitmentState = "open" | "closed";
export type MeetingCommitmentRevision = {
  commitmentId: string;
  revision: number;
  meetingId: string;
  ownerUserId: number;
  dueDate: string;
  state: CommitmentState;
  evidenceIds: readonly string[];
  carriedFromMeetingId?: string;
};

export function carryMeetingCommitments(input: {
  fromMeetingId: string;
  toMeetingId: string;
  commitments: readonly MeetingCommitmentRevision[];
}): readonly MeetingCommitmentRevision[] {
  if (!input.fromMeetingId.trim() || !input.toMeetingId.trim() || input.fromMeetingId === input.toMeetingId) throw new Error("MEETING_CARRY_TARGET_INVALID");
  const latest = new Map<string, MeetingCommitmentRevision>();
  for (const item of input.commitments) {
    const prior = latest.get(item.commitmentId);
    if (!prior || item.revision > prior.revision) latest.set(item.commitmentId, item);
  }
  return Object.freeze([...latest.values()].filter(item => item.state === "open").sort((a, b) => a.commitmentId.localeCompare(b.commitmentId)).map(item => Object.freeze({
    ...item,
    revision: item.revision + 1,
    meetingId: input.toMeetingId,
    carriedFromMeetingId: input.fromMeetingId,
    evidenceIds: Object.freeze([...item.evidenceIds]),
  })));
}

export function closeMeetingCommitment(item: MeetingCommitmentRevision, input: { meetingId: string; evidenceIds: readonly string[] }) {
  if (item.state !== "open") throw new Error("MEETING_COMMITMENT_ALREADY_CLOSED");
  if (!input.evidenceIds.length || input.evidenceIds.some(id => !id.trim())) throw new Error("MEETING_COMMITMENT_CLOSURE_EVIDENCE_REQUIRED");
  return Object.freeze({ ...item, revision: item.revision + 1, meetingId: input.meetingId, state: "closed" as const, evidenceIds: Object.freeze([...new Set([...item.evidenceIds, ...input.evidenceIds])]) });
}
