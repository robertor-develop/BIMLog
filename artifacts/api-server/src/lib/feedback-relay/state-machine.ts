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
export const feedbackRetentionOutcomes = ["temporary-absent", "no-temporary-object"] as const;
export type FeedbackRetentionOutcome = typeof feedbackRetentionOutcomes[number];
export type ExpiryCandidate = { state: RelayState; outcome: FeedbackRetentionOutcome | null; receiptVerified: boolean; temporaryObjectExists: boolean; temporaryDeleted: boolean; absenceVerified: boolean; deleteFailed: boolean; hold: boolean; expiresAt: Date };
export function expiryEligible(input: ExpiryCandidate, now = new Date()) {
  const custodyClosed = input.outcome === "no-temporary-object"
    ? !input.temporaryObjectExists
    : input.outcome === "temporary-absent" && input.temporaryObjectExists && input.temporaryDeleted && input.absenceVerified;
  return input.state === "queued" && custodyClosed && !input.receiptVerified && !input.deleteFailed && !input.hold && !Number.isNaN(input.expiresAt.getTime()) && input.expiresAt.getTime() <= now.getTime();
}

export type FeedbackPurgeCommand = {
  commandVersion: "1"; commandId: string; jobId: string; objectId: string; companyId: number; projectId: number | null; feedbackId: number;
  jobVersion: number; fencingToken: string; holdSnapshotVersion: number; noActiveHoldProofSha256: string;
  resolvedEvidenceSha256: string; customerClosureEvidenceSha256: string; internalClosureEvidenceSha256: string;
  policyId: string; policyVersion: string; policySha256: string; approvalId: string; approvalAuthority: string; approvedAt: string;
  deliveryReceiptSha256: string; readbackSha256: string; issuedAt: string; expiresAt: string; revokedAt: string | null;
  signingKeyId: string; signatureReference: string; canonicalSha256: string;
};

const PURGE_COMMAND_DOMAIN = "bimlog-feedback-purge-command-v1";
const purgeText = (value: string, field: string) => text(value, field);
const purgeHash = (value: string, field: string) => {
  const normalized = purgeText(value, field);
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new FeedbackRelayAuthorityError("FEEDBACK_PURGE_COMMAND_INVALID", `Invalid ${field}`);
  return normalized;
};
export function canonicalizeFeedbackPurgeCommand(command: Omit<FeedbackPurgeCommand, "canonicalSha256" | "signatureReference" | "revokedAt">): string {
  const issuedAt = new Date(command.issuedAt), expiresAt = new Date(command.expiresAt), approvedAt = new Date(command.approvedAt);
  if ([issuedAt, expiresAt, approvedAt].some(value => Number.isNaN(value.getTime())) || approvedAt > issuedAt || issuedAt >= expiresAt)
    throw new FeedbackRelayAuthorityError("FEEDBACK_PURGE_COMMAND_INVALID", "Invalid purge command time authority");
  if (!Number.isSafeInteger(command.companyId) || command.companyId < 1 || (command.projectId !== null && (!Number.isSafeInteger(command.projectId) || command.projectId < 1)) || !Number.isSafeInteger(command.feedbackId) || command.feedbackId < 1 || !Number.isSafeInteger(command.jobVersion) || command.jobVersion < 1 || !Number.isSafeInteger(command.holdSnapshotVersion) || command.holdSnapshotVersion < 0)
    throw new FeedbackRelayAuthorityError("FEEDBACK_PURGE_COMMAND_INVALID", "Invalid purge command numeric authority");
  return [PURGE_COMMAND_DOMAIN,`commandVersion:${command.commandVersion}`,`commandId:${purgeText(command.commandId,"commandId")}`,`jobId:${purgeText(command.jobId,"jobId")}`,`objectId:${purgeText(command.objectId,"objectId")}`,`companyId:${command.companyId}`,`projectId:${command.projectId ?? ""}`,`feedbackId:${command.feedbackId}`,`jobVersion:${command.jobVersion}`,`fencingToken:${purgeText(command.fencingToken,"fencingToken")}`,`holdSnapshotVersion:${command.holdSnapshotVersion}`,`noActiveHoldProofSha256:${purgeHash(command.noActiveHoldProofSha256,"noActiveHoldProofSha256")}`,`resolvedEvidenceSha256:${purgeHash(command.resolvedEvidenceSha256,"resolvedEvidenceSha256")}`,`customerClosureEvidenceSha256:${purgeHash(command.customerClosureEvidenceSha256,"customerClosureEvidenceSha256")}`,`internalClosureEvidenceSha256:${purgeHash(command.internalClosureEvidenceSha256,"internalClosureEvidenceSha256")}`,`policyId:${purgeText(command.policyId,"policyId")}`,`policyVersion:${purgeText(command.policyVersion,"policyVersion")}`,`policySha256:${purgeHash(command.policySha256,"policySha256")}`,`approvalId:${purgeText(command.approvalId,"approvalId")}`,`approvalAuthority:${purgeText(command.approvalAuthority,"approvalAuthority")}`,`approvedAt:${approvedAt.toISOString()}`,`deliveryReceiptSha256:${purgeHash(command.deliveryReceiptSha256,"deliveryReceiptSha256")}`,`readbackSha256:${purgeHash(command.readbackSha256,"readbackSha256")}`,`issuedAt:${issuedAt.toISOString()}`,`expiresAt:${expiresAt.toISOString()}`,`signingKeyId:${purgeText(command.signingKeyId,"signingKeyId")}`].join("\n");
}
export function feedbackPurgeCommandSha256(command: Omit<FeedbackPurgeCommand, "canonicalSha256" | "signatureReference" | "revokedAt">): string { return createHash("sha256").update(canonicalizeFeedbackPurgeCommand(command),"utf8").digest("hex"); }
export interface FeedbackPurgeSignatureVerifier { verify(input: { keyId: string; canonicalSha256: string; signatureReference: string }): Promise<boolean>; }
export const defaultDenyFeedbackPurgeSignatureVerifier: FeedbackPurgeSignatureVerifier = { async verify() { return false; } };
export async function assertFeedbackPurgeCommandSignature(command: FeedbackPurgeCommand, verifier: FeedbackPurgeSignatureVerifier = defaultDenyFeedbackPurgeSignatureVerifier) {
  const { canonicalSha256, signatureReference, revokedAt: _revokedAt, ...unsigned } = command;
  const computed = feedbackPurgeCommandSha256(unsigned);
  if (!/^[a-f0-9]{64}$/.test(canonicalSha256) || !timingSafeEqual(Buffer.from(computed,"hex"),Buffer.from(canonicalSha256,"hex"))) throw new FeedbackRelayAuthorityError("FEEDBACK_PURGE_COMMAND_HASH_MISMATCH","Purge command canonical digest mismatch");
  if (!await verifier.verify({keyId:command.signingKeyId,canonicalSha256,signatureReference})) throw new FeedbackRelayAuthorityError("FEEDBACK_PURGE_COMMAND_SIGNATURE_DENIED","Purge command signature authority denied");
  return command;
}
export function assertGovernedExpiry(input: ExpiryCandidate, policy: RetentionPolicy, now = new Date()): "expired" {
  assertRetentionPolicy(policy);
  if(!expiryEligible(input,now)) throw new FeedbackRelayAuthorityError("FEEDBACK_RELAY_EXPIRY_DENIED","Relay item does not satisfy governed expiry preconditions");
  return "expired";
}
