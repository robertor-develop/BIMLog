export type UserJourneyAcceptance = Readonly<{
  participant: "roberto" | "ruben" | "representative-user";
  journeyId: string;
  observedAt: string;
  completedWithoutCoaching: boolean;
  recoveredWithHelpAlone: boolean;
  wrongTurns: number;
  repeatedEntries: number;
  confusingStateIds: readonly string[];
  resolutionIds: readonly string[];
}>;

export function verifyUserAcceptance(records: readonly UserJourneyAcceptance[]) {
  const failures: string[] = [];
  for (const participant of ["roberto", "ruben", "representative-user"] as const)
    if (!records.some((record) => record.participant === participant)) failures.push(`MISSING_${participant.toUpperCase()}`);
  for (const record of records) {
    if (!record.journeyId.trim() || !Number.isFinite(Date.parse(record.observedAt))) failures.push(`INVALID_EVIDENCE_${record.participant.toUpperCase()}`);
    if (!record.completedWithoutCoaching && !record.recoveredWithHelpAlone) failures.push(`COACHING_REQUIRED_${record.participant.toUpperCase()}`);
    const resolved = new Set(record.resolutionIds);
    if (record.confusingStateIds.some((id) => !resolved.has(id))) failures.push(`UNRESOLVED_CONFUSION_${record.participant.toUpperCase()}`);
    if (record.wrongTurns < 0 || record.repeatedEntries < 0) failures.push(`INVALID_COUNTS_${record.participant.toUpperCase()}`);
  }
  return Object.freeze({ status: failures.length ? "blocked" : "passed", failures: Object.freeze(failures), evidenceCount: records.length });
}
