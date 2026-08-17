export const relayStates = ["queued", "transferring", "receipt-verified", "cleanup-pending", "delivered", "manual-review", "held", "expired"] as const;
export type RelayState = typeof relayStates[number];
const transitions: Record<RelayState, ReadonlySet<RelayState>> = {
  queued: new Set(["transferring", "held", "manual-review"]),
  transferring: new Set(["queued", "receipt-verified", "held", "manual-review"]),
  "receipt-verified": new Set(["cleanup-pending", "delivered", "held", "manual-review"]),
  "cleanup-pending": new Set(["delivered", "held", "manual-review"]),
  delivered: new Set(["held", "manual-review"]),
  "manual-review": new Set(["queued", "held"]),
  held: new Set(["queued", "manual-review"]),
  expired: new Set([]),
};
export function assertRelayTransition(from: RelayState, to: RelayState) {
  if (!transitions[from]?.has(to)) throw Object.assign(new Error(`Relay transition ${from} -> ${to} is not allowed`), { code: "FEEDBACK_RELAY_TRANSITION_DENIED" });
}
export type RetentionPolicy = { version: string; approvedBy: string; approvedAt: string; scope: string; policySha256: string; temporaryDays: number; failureDays: number; quarantineDays: number; resolvedDays: number };
export function parseRetentionPolicy(environment: NodeJS.ProcessEnv): RetentionPolicy {
  const required = (key: string) => { const value = environment[key]?.trim(); if (!value) throw Object.assign(new Error("Feedback retention is not configured"), { code: "FEEDBACK_RETENTION_POLICY_REQUIRED" }); return value; };
  const read = (key: string) => { const value = Number(required(key)); if (!Number.isSafeInteger(value) || value < 1 || value > 3650) throw new Error(`Invalid ${key}`); return value; };
  const policy = { version: required("BIMLOG_FEEDBACK_RETENTION_POLICY_VERSION"), approvedBy: required("BIMLOG_FEEDBACK_RETENTION_APPROVED_BY"), approvedAt: required("BIMLOG_FEEDBACK_RETENTION_APPROVED_AT"), scope: required("BIMLOG_FEEDBACK_RETENTION_SCOPE"), policySha256: required("BIMLOG_FEEDBACK_RETENTION_POLICY_SHA256"), temporaryDays: read("BIMLOG_FEEDBACK_TEMPORARY_DAYS"), failureDays: read("BIMLOG_FEEDBACK_FAILURE_DAYS"), quarantineDays: read("BIMLOG_FEEDBACK_QUARANTINE_DAYS"), resolvedDays: read("BIMLOG_FEEDBACK_RESOLVED_DAYS") };
  if (!/^[a-f0-9]{64}$/.test(policy.policySha256) || Number.isNaN(Date.parse(policy.approvedAt))) throw new Error("Invalid feedback retention policy identity"); return policy;
}
export function expiryEligible(input: { state: RelayState; outcomeKnown: boolean; receiptVerified: boolean; temporaryDeleted: boolean; deleteFailed: boolean; hold: boolean; expiresAt: Date }, now = new Date()) {
  return input.state === "queued" && input.outcomeKnown && !input.receiptVerified && !input.temporaryDeleted && !input.deleteFailed && !input.hold && input.expiresAt.getTime() <= now.getTime();
}
