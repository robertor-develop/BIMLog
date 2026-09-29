export type SubmittalExperienceRecord = {
  id: number;
  parentSubmittalId?: number | null;
  revisionNumber?: number | null;
  status?: string | null;
  reviewDecision?: string | null;
  number?: string | null;
  updatedAt?: string | null;
};

export function submittalRevisionFamily<T extends SubmittalExperienceRecord>(records: readonly T[], current: T): T[] {
  const rootId = current.parentSubmittalId || current.id;
  return records
    .filter(record => record.id === rootId || record.parentSubmittalId === rootId)
    .sort((left, right) => (left.revisionNumber ?? 0) - (right.revisionNumber ?? 0) || left.id - right.id);
}

export function submittalReviewAction(record: SubmittalExperienceRecord): "review" | "revise" | "complete" {
  if (["approved", "approved_as_noted", "not_required"].includes(record.reviewDecision || record.status || "")) return "complete";
  if (["revise_resubmit", "rejected"].includes(record.reviewDecision || record.status || "")) return "revise";
  return "review";
}

export function submittalRoundTripSnapshot(record: SubmittalExperienceRecord) {
  return {
    id: record.id,
    number: record.number || "",
    revision: record.revisionNumber ?? 0,
    status: record.status || "",
    reviewDecision: record.reviewDecision || "",
  };
}
