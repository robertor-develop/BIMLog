export type PublicationRecordState = "pending" | "completed" | "retry" | "dead_letter" | "cancelled";
export function publicationLifecycleAuthority(state: PublicationRecordState, retentionHold: boolean) {
  return { exportAllowed: true, correctionMode: "append_only" as const, archiveAllowed: state !== "pending" && state !== "retry", deleteAllowed: !retentionHold && state === "cancelled", immutableEvidence: state === "completed" || state === "dead_letter" || retentionHold };
}
