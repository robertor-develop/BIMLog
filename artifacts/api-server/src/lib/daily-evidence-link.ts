export type DailyEvidenceState = "linked" | "upload_failed" | "privacy_restricted";

export interface DailyEvidenceLink {
  linkId: string;
  projectId: number;
  dailyRecordId: string;
  custodyObjectId: string | null;
  originalFileId: number | null;
  note: string | null;
  state: DailyEvidenceState;
  failureCode: string | null;
  linkedBy: string;
  linkedAt: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function linkDailyEvidence(input: DailyEvidenceLink, existing: readonly DailyEvidenceLink[]): DailyEvidenceLink {
  const prior = existing.find(link => link.projectId === input.projectId && link.linkId === input.linkId);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify(input)) throw new Error("Daily evidence retry conflicts with the existing link.");
    return prior;
  }
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("A valid project is required.");
  if (Number.isNaN(Date.parse(input.linkedAt))) throw new Error("A valid evidence link time is required.");
  required(input.dailyRecordId, "Daily record identity");
  required(input.linkedBy, "Evidence linker identity");
  if (input.state === "linked") {
    required(input.custodyObjectId ?? "", "Custody object identity");
    if (!Number.isSafeInteger(input.originalFileId) || (input.originalFileId ?? 0) <= 0) throw new Error("Linked evidence requires an original file identity.");
    if (input.failureCode !== null) throw new Error("Linked evidence cannot retain a failure code.");
  } else if (!input.failureCode?.trim()) {
    throw new Error("Unavailable evidence requires a visible failure code.");
  }
  return { ...input, note: input.note?.trim() || null };
}

export function dailyEvidenceForRecord(input: { projectId: number; dailyRecordId: string; links: readonly DailyEvidenceLink[] }): DailyEvidenceLink[] {
  return input.links.filter(link => link.projectId === input.projectId && link.dailyRecordId === input.dailyRecordId);
}
