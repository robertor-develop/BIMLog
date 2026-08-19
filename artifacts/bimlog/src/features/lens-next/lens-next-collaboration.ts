import type { LensNextImmutableIssueIdentity, LensNextStatus } from "./lens-next-types";

export type LensNextRole =
  | "project_admin"
  | "lead_coordinator"
  | "trade_coordinator"
  | "reviewer"
  | "viewer";

export type LensNextPermission =
  | "create_issue"
  | "comment"
  | "assign"
  | "change_status"
  | "resolve"
  | "reopen"
  | "update_visual_state"
  | "publish"
  | "bulk_publish"
  | "migrate"
  | "resolve_duplicates";

export type LensNextCollaborativeAction =
  | "create_issue"
  | "comment"
  | "assignment"
  | "status"
  | "visual_state"
  | "publish";

export interface LensNextActorFootprint {
  userId: string;
  fullName: string;
  companyId: string | null;
  companyName: string | null;
  role: LensNextRole;
  navisworksSessionId: string;
}

export interface LensNextRecordVersion {
  identity: LensNextImmutableIssueIdentity;
  version: number;
  status: LensNextStatus;
  visualStateDigest: string;
  modelFingerprint: string;
}

export interface LensNextMutationIntent {
  operationId: string;
  action: LensNextCollaborativeAction;
  actor: LensNextActorFootprint;
  base: LensNextRecordVersion;
  issuedAt: string;
}

export interface LensNextPresenceHeartbeat {
  projectId: number;
  serverId: number | null;
  actor: LensNextActorFootprint;
  mode: "viewing" | "editing_metadata" | "editing_visual" | "publishing";
  modelFingerprint: string;
  seenAtEpochMs: number;
}

export interface LensNextVisualLease {
  projectId: number;
  serverId: number;
  leaseId: string;
  actorUserId: string;
  sessionId: string;
  acquiredAtEpochMs: number;
  expiresAtEpochMs: number;
}

export interface LensNextAuditFootprint {
  operationId: string;
  projectId: number;
  serverId: number;
  action: LensNextCollaborativeAction;
  actorUserId: string;
  actorFullName: string;
  companyName: string | null;
  role: LensNextRole;
  source: "bimlog_lens_next_navisworks";
  modelFingerprint: string;
  beforeVersion: number;
  afterVersion: number;
  occurredAt: string;
  reason: string | null;
}

const ROLE_PERMISSIONS: Readonly<Record<LensNextRole, readonly LensNextPermission[]>> = Object.freeze({
  project_admin: ["create_issue", "comment", "assign", "change_status", "resolve", "reopen", "update_visual_state", "publish", "bulk_publish", "migrate", "resolve_duplicates"],
  lead_coordinator: ["create_issue", "comment", "assign", "change_status", "resolve", "reopen", "update_visual_state", "publish", "bulk_publish"],
  trade_coordinator: ["create_issue", "comment", "change_status", "update_visual_state", "publish"],
  reviewer: ["comment", "change_status", "resolve", "reopen"],
  viewer: [],
});

export function lensNextRoleCan(role: LensNextRole, permission: LensNextPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function lensNextActionsConflict(
  first: LensNextCollaborativeAction,
  second: LensNextCollaborativeAction,
): boolean {
  if (first === "comment" || second === "comment") return false;
  if (first === "create_issue" || second === "create_issue") return false;
  if (first === "visual_state" || second === "visual_state") return true;
  if (first === "publish" || second === "publish") return true;
  return first === second;
}

export function validateLensNextMutationIntent(intent: LensNextMutationIntent): LensNextMutationIntent {
  if (!/^[0-9a-f-]{36}$/i.test(intent.operationId)) throw new Error("OPERATION_ID_INVALID");
  if (!Number.isSafeInteger(intent.base.version) || intent.base.version <= 0) throw new Error("BASE_VERSION_INVALID");
  if (!/^[0-9a-f]{64}$/i.test(intent.base.visualStateDigest)) throw new Error("VISUAL_DIGEST_INVALID");
  if (!/^[0-9a-f]{64}$/i.test(intent.base.modelFingerprint)) throw new Error("MODEL_FINGERPRINT_INVALID");
  if (!intent.actor.userId || !intent.actor.fullName || !intent.actor.navisworksSessionId) throw new Error("ACTOR_FOOTPRINT_REQUIRED");
  return Object.freeze({ ...intent, actor: Object.freeze({ ...intent.actor }), base: Object.freeze({ ...intent.base, identity: Object.freeze({ ...intent.base.identity }) }) });
}

export function evaluateLensNextOptimisticConcurrency(
  intent: LensNextMutationIntent,
  current: LensNextRecordVersion,
): { allowed: true } | { allowed: false; code: string } {
  validateLensNextMutationIntent(intent);
  if (current.identity.projectId !== intent.base.identity.projectId || current.identity.serverId !== intent.base.identity.serverId) {
    return { allowed: false, code: "IMMUTABLE_IDENTITY_MISMATCH" };
  }
  if (current.modelFingerprint !== intent.base.modelFingerprint) return { allowed: false, code: "MODEL_VERSION_MISMATCH" };
  if (current.version !== intent.base.version || current.identity.revisionNumber !== intent.base.identity.revisionNumber) {
    return { allowed: false, code: "VERSION_CONFLICT" };
  }
  return { allowed: true };
}

export function activeLensNextPresence(
  heartbeats: readonly LensNextPresenceHeartbeat[],
  nowEpochMs: number,
  ttlMs = 45_000,
): readonly LensNextPresenceHeartbeat[] {
  const newest = new Map<string, LensNextPresenceHeartbeat>();
  for (const heartbeat of heartbeats) {
    if (heartbeat.seenAtEpochMs > nowEpochMs || nowEpochMs - heartbeat.seenAtEpochMs > ttlMs) continue;
    const key = `${heartbeat.actor.userId}:${heartbeat.actor.navisworksSessionId}`;
    const prior = newest.get(key);
    if (!prior || prior.seenAtEpochMs < heartbeat.seenAtEpochMs) newest.set(key, heartbeat);
  }
  return Object.freeze([...newest.values()].sort((a, b) => b.seenAtEpochMs - a.seenAtEpochMs));
}

export function lensNextLeaseAvailable(
  current: LensNextVisualLease | null,
  actorUserId: string,
  sessionId: string,
  nowEpochMs: number,
): boolean {
  if (!current || current.expiresAtEpochMs <= nowEpochMs) return true;
  return current.actorUserId === actorUserId && current.sessionId === sessionId;
}

export const LENS_NEXT_COLLABORATION_INVARIANTS = Object.freeze({
  simultaneousDifferentIssueCreationAllowed: true,
  commentsAppendOnlyConcurrent: true,
  silentOverwriteAllowed: false,
  visualStateConcurrentOverwriteAllowed: false,
  actorFootprintRequired: true,
  modelFingerprintRequiredForWrites: true,
  folderLayoutParticipatesInIdentity: false,
  maximumPresenceTtlMs: 60_000,
});
