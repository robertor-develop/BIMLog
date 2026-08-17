export const relayStates = ["queued", "transferring", "delivered", "cleanup-pending", "manual-review", "held", "expired"] as const;
export type RelayState = typeof relayStates[number];
const transitions: Record<RelayState, ReadonlySet<RelayState>> = {
  queued: new Set(["transferring", "held", "expired", "manual-review"]),
  transferring: new Set(["queued", "delivered", "held", "manual-review"]),
  delivered: new Set(["cleanup-pending", "held", "manual-review"]),
  "cleanup-pending": new Set(["held", "manual-review"]),
  "manual-review": new Set(["queued", "held", "expired"]),
  held: new Set(["queued", "manual-review"]),
  expired: new Set([]),
};
export function assertRelayTransition(from: RelayState, to: RelayState) {
  if (!transitions[from]?.has(to)) throw Object.assign(new Error(`Relay transition ${from} -> ${to} is not allowed`), { code: "FEEDBACK_RELAY_TRANSITION_DENIED" });
}
export type RetentionProposal = { temporaryDays: number; failureDays: number; quarantineDays: number; resolvedDays: number };
export function parseRetentionProposal(environment: NodeJS.ProcessEnv): RetentionProposal {
  const read = (key: string, proposed: number) => { const value = Number(environment[key] ?? proposed); if (!Number.isSafeInteger(value) || value < 1 || value > 3650) throw new Error(`Invalid ${key}`); return value; };
  return { temporaryDays: read("BIMLOG_FEEDBACK_TEMPORARY_DAYS", 7), failureDays: read("BIMLOG_FEEDBACK_FAILURE_DAYS", 30), quarantineDays: read("BIMLOG_FEEDBACK_QUARANTINE_DAYS", 30), resolvedDays: read("BIMLOG_FEEDBACK_RESOLVED_DAYS", 90) };
}
