import { createHash, timingSafeEqual } from "node:crypto";

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
  if (!transitions[from]?.has(to)) throw new FeedbackRelayAuthorityError("FEEDBACK_RELAY_TRANSITION_DENIED", `Relay transition ${from} -> ${to} is not allowed`);
}
export class FeedbackRelayAuthorityError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "FeedbackRelayAuthorityError"; }
}
export type RetentionPolicyValues = { version: string; approvedBy: string; approvedAt: string; scope: string; temporaryDays: number; failureDays: number; quarantineDays: number; resolvedDays: number };
export type RetentionPolicy = RetentionPolicyValues & { policySha256: string };
const POLICY_DOMAIN = "bimlog-feedback-retention-policy-v1";
const text = (value: string, field: string) => { const normalized=value.trim().normalize("NFC"); if(!normalized||/[\r\n\0]/.test(normalized)) throw new FeedbackRelayAuthorityError("FEEDBACK_RETENTION_POLICY_INVALID",`Invalid ${field}`); return normalized; };
const days = (value: number, field: string) => { if(!Number.isSafeInteger(value)||value<1||value>3650) throw new FeedbackRelayAuthorityError("FEEDBACK_RETENTION_POLICY_INVALID",`Invalid ${field}`); return value; };
export function canonicalizeRetentionPolicy(input: RetentionPolicyValues): string {
  const approvedAt=new Date(text(input.approvedAt,"approvedAt"));
  if(Number.isNaN(approvedAt.getTime())) throw new FeedbackRelayAuthorityError("FEEDBACK_RETENTION_POLICY_INVALID","Invalid approvedAt");
  return [POLICY_DOMAIN,`version:${text(input.version,"version")}`,`approvedBy:${text(input.approvedBy,"approvedBy")}`,`approvedAt:${approvedAt.toISOString()}`,`scope:${text(input.scope,"scope")}`,`temporaryDays:${days(input.temporaryDays,"temporaryDays")}`,`failureDays:${days(input.failureDays,"failureDays")}`,`quarantineDays:${days(input.quarantineDays,"quarantineDays")}`,`resolvedDays:${days(input.resolvedDays,"resolvedDays")}`].join("\n");
}
export function retentionPolicySha256(input: RetentionPolicyValues): string { return createHash("sha256").update(canonicalizeRetentionPolicy(input),"utf8").digest("hex"); }
export function assertRetentionPolicy(policy: RetentionPolicy): RetentionPolicy {
  if(!/^[a-f0-9]{64}$/.test(policy.policySha256)) throw new FeedbackRelayAuthorityError("FEEDBACK_RETENTION_POLICY_INVALID","Invalid retention policy digest");
  if(!timingSafeEqual(Buffer.from(retentionPolicySha256(policy),"hex"),Buffer.from(policy.policySha256,"hex"))) throw new FeedbackRelayAuthorityError("FEEDBACK_RETENTION_POLICY_HASH_MISMATCH","Retention policy digest does not match its canonical contents");
  return policy;
}
export function parseRetentionPolicy(environment: NodeJS.ProcessEnv): RetentionPolicy {
  const required = (key: string) => { const value=environment[key]?.trim(); if(!value) throw new FeedbackRelayAuthorityError("FEEDBACK_RETENTION_POLICY_REQUIRED","Feedback retention is not configured"); return value; };
  const read = (key: string) => days(Number(required(key)),key);
  return assertRetentionPolicy({ version:required("BIMLOG_FEEDBACK_RETENTION_POLICY_VERSION"),approvedBy:required("BIMLOG_FEEDBACK_RETENTION_APPROVED_BY"),approvedAt:required("BIMLOG_FEEDBACK_RETENTION_APPROVED_AT"),scope:required("BIMLOG_FEEDBACK_RETENTION_SCOPE"),policySha256:required("BIMLOG_FEEDBACK_RETENTION_POLICY_SHA256"),temporaryDays:read("BIMLOG_FEEDBACK_TEMPORARY_DAYS"),failureDays:read("BIMLOG_FEEDBACK_FAILURE_DAYS"),quarantineDays:read("BIMLOG_FEEDBACK_QUARANTINE_DAYS"),resolvedDays:read("BIMLOG_FEEDBACK_RESOLVED_DAYS") });
}
export type ExpiryCandidate = { state: RelayState; outcomeKnown: boolean; receiptVerified: boolean; temporaryDeleted: boolean; deleteFailed: boolean; hold: boolean; expiresAt: Date };
export function expiryEligible(input: ExpiryCandidate, now = new Date()) {
  return input.state === "queued" && input.outcomeKnown && !input.receiptVerified && !input.temporaryDeleted && !input.deleteFailed && !input.hold && !Number.isNaN(input.expiresAt.getTime()) && input.expiresAt.getTime() <= now.getTime();
}
export function assertGovernedExpiry(input: ExpiryCandidate, policy: RetentionPolicy, now = new Date()): "expired" {
  assertRetentionPolicy(policy);
  if(!expiryEligible(input,now)) throw new FeedbackRelayAuthorityError("FEEDBACK_RELAY_EXPIRY_DENIED","Relay item does not satisfy governed expiry preconditions");
  return "expired";
}
