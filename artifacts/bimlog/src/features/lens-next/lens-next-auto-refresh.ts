export type LensNextAutoRefreshMode =
  | "idle"
  | "refreshing"
  | "saved"
  | "offline"
  | "conflict"
  | "action_blocked";

export interface LensNextRefreshIdentity {
  projectId: number;
  issueFamilyId: string;
  serverId: number;
  viewpointId: string;
  lifecycleStatus: "active" | "superseded" | "voided";
  revisionNumber: number;
}

export interface LensNextRefreshSession {
  sessionId: string;
  projectId: number;
  credentialVersion: number;
  active: boolean;
  ephemeralInMemory: true;
}

export interface LensNextRefreshRequest {
  requestId: string;
  method: "GET";
  path: string;
  authenticated: true;
  sessionId: string;
  credentialVersion: number;
  identity: LensNextRefreshIdentity;
  expectedVersion: number;
  visualStateDigest: string;
  issuedAtMs: number;
}

export interface LensNextRefreshResponse {
  requestId: string;
  identity: LensNextRefreshIdentity;
  version: number;
  visualStateDigest: string;
  issueCount: number;
  issueSetDigest: string;
  responseFingerprint: string;
}

export interface LensNextAutoRefreshState {
  mode: LensNextAutoRefreshMode;
  identity: LensNextRefreshIdentity;
  version: number;
  visualStateDigest: string;
  issueCount: number;
  issueSetDigest: string;
  lastResponseFingerprint: string | null;
  inFlight: LensNextRefreshRequest | null;
  retryAttempt: number;
  nextRetryAtMs: number | null;
  reason: string | null;
}

export type LensNextRefreshStart =
  | {
      started: true;
      state: LensNextAutoRefreshState;
      request: LensNextRefreshRequest;
    }
  | { started: false; state: LensNextAutoRefreshState; request: null };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const MAX_ISSUES = 500;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 8_000;

function validIdentity(identity: LensNextRefreshIdentity) {
  return (
    Number.isSafeInteger(identity.projectId) &&
    identity.projectId > 0 &&
    UUID.test(identity.issueFamilyId) &&
    Number.isSafeInteger(identity.serverId) &&
    identity.serverId > 0 &&
    ID.test(identity.viewpointId) &&
    identity.lifecycleStatus === "active" &&
    Number.isSafeInteger(identity.revisionNumber) &&
    identity.revisionNumber > 0
  );
}

function sameStableIdentity(
  left: LensNextRefreshIdentity,
  right: LensNextRefreshIdentity,
) {
  return (
    left.projectId === right.projectId &&
    left.issueFamilyId === right.issueFamilyId &&
    left.serverId === right.serverId &&
    left.viewpointId === right.viewpointId &&
    left.lifecycleStatus === right.lifecycleStatus
  );
}

function stopped(
  state: LensNextAutoRefreshState,
  mode: "conflict" | "action_blocked",
  reason: string,
): LensNextAutoRefreshState {
  return {
    ...state,
    mode,
    inFlight: null,
    nextRetryAtMs: null,
    reason,
  };
}

export function createLensNextAutoRefreshState(input: {
  identity: LensNextRefreshIdentity;
  version: number;
  visualStateDigest: string;
  issueCount?: number;
  issueSetDigest?: string;
}): LensNextAutoRefreshState {
  if (!validIdentity(input.identity))
    throw new Error("REFRESH_IDENTITY_INVALID");
  if (!Number.isSafeInteger(input.version) || input.version < 1)
    throw new Error("REFRESH_VERSION_INVALID");
  if (!SHA256.test(input.visualStateDigest))
    throw new Error("VISUAL_STATE_DIGEST_INVALID");
  const issueCount = input.issueCount ?? 0;
  const issueSetDigest = input.issueSetDigest ?? "0".repeat(64);
  if (
    !Number.isSafeInteger(issueCount) ||
    issueCount < 0 ||
    issueCount > MAX_ISSUES ||
    !SHA256.test(issueSetDigest)
  )
    throw new Error("ISSUE_SET_INVALID");
  return {
    mode: "idle",
    identity: { ...input.identity },
    version: input.version,
    visualStateDigest: input.visualStateDigest,
    issueCount,
    issueSetDigest,
    lastResponseFingerprint: null,
    inFlight: null,
    retryAttempt: 0,
    nextRetryAtMs: null,
    reason: null,
  };
}

export function startLensNextAutoRefresh(
  state: LensNextAutoRefreshState,
  session: LensNextRefreshSession,
  nowMs: number,
  requestId: string,
): LensNextRefreshStart {
  if (
    state.inFlight ||
    state.mode === "conflict" ||
    state.mode === "action_blocked"
  )
    return { started: false, state, request: null };
  if (
    !session.active ||
    session.ephemeralInMemory !== true ||
    session.projectId !== state.identity.projectId ||
    !ID.test(session.sessionId) ||
    !Number.isSafeInteger(session.credentialVersion) ||
    session.credentialVersion < 1
  ) {
    return {
      started: false,
      request: null,
      state: stopped(state, "action_blocked", "AUTHENTICATED_SESSION_REQUIRED"),
    };
  }
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || !ID.test(requestId))
    return {
      started: false,
      request: null,
      state: stopped(state, "action_blocked", "REFRESH_REQUEST_INVALID"),
    };
  if (state.nextRetryAtMs !== null && nowMs < state.nextRetryAtMs)
    return { started: false, state, request: null };
  const request: LensNextRefreshRequest = {
    requestId,
    method: "GET",
    path: `/api/projects/${state.identity.projectId}/clash-reports/lens-viewpoints/${state.identity.serverId}/active`,
    authenticated: true,
    sessionId: session.sessionId,
    credentialVersion: session.credentialVersion,
    identity: { ...state.identity },
    expectedVersion: state.version,
    visualStateDigest: state.visualStateDigest,
    issuedAtMs: nowMs,
  };
  return {
    started: true,
    request,
    state: { ...state, mode: "refreshing", inFlight: request, reason: null },
  };
}

export function applyLensNextRefreshResponse(
  state: LensNextAutoRefreshState,
  response: LensNextRefreshResponse,
): LensNextAutoRefreshState {
  const request = state.inFlight;
  if (!request || response.requestId !== request.requestId)
    return stopped(state, "action_blocked", "UNBOUND_REFRESH_RESPONSE");
  if (
    !validIdentity(response.identity) ||
    !sameStableIdentity(request.identity, response.identity)
  )
    return stopped(state, "action_blocked", "IMMUTABLE_IDENTITY_MISMATCH");
  if (
    !Number.isSafeInteger(response.issueCount) ||
    response.issueCount < 0 ||
    response.issueCount > MAX_ISSUES ||
    !SHA256.test(response.issueSetDigest) ||
    !SHA256.test(response.responseFingerprint)
  )
    return stopped(state, "action_blocked", "RESPONSE_BOUNDS_INVALID");
  if (response.visualStateDigest !== request.visualStateDigest)
    return stopped(state, "action_blocked", "VISUAL_STATE_DIVERGED");
  if (
    response.version < request.expectedVersion ||
    response.identity.revisionNumber < request.identity.revisionNumber
  )
    return stopped(state, "conflict", "STALE_REFRESH_RESPONSE");
  if (
    response.version === state.version &&
    response.identity.revisionNumber === state.identity.revisionNumber
  ) {
    if (
      state.lastResponseFingerprint === response.responseFingerprint ||
      (state.issueCount === response.issueCount &&
        state.issueSetDigest === response.issueSetDigest)
    )
      return {
        ...state,
        mode: "saved",
        inFlight: null,
        retryAttempt: 0,
        nextRetryAtMs: null,
        lastResponseFingerprint: response.responseFingerprint,
        reason: null,
      };
    return stopped(state, "conflict", "DIVERGENT_DUPLICATE_RESPONSE");
  }
  return {
    ...state,
    mode: "saved",
    identity: { ...response.identity },
    version: response.version,
    issueCount: response.issueCount,
    issueSetDigest: response.issueSetDigest,
    lastResponseFingerprint: response.responseFingerprint,
    inFlight: null,
    retryAttempt: 0,
    nextRetryAtMs: null,
    reason: null,
  };
}

export function markLensNextRefreshOffline(
  state: LensNextAutoRefreshState,
  nowMs: number,
): LensNextAutoRefreshState {
  if (!state.inFlight)
    return stopped(state, "action_blocked", "NO_IN_FLIGHT_REFRESH");
  const nextAttempt = state.retryAttempt + 1;
  if (nextAttempt > MAX_RETRIES)
    return stopped(state, "action_blocked", "RETRY_LIMIT_REACHED");
  const backoff = Math.min(
    BASE_BACKOFF_MS * 2 ** (nextAttempt - 1),
    MAX_BACKOFF_MS,
  );
  return {
    ...state,
    mode: "offline",
    inFlight: null,
    retryAttempt: nextAttempt,
    nextRetryAtMs: nowMs + backoff,
    reason: "NETWORK_OFFLINE",
  };
}

export const LENS_NEXT_AUTO_REFRESH_INVARIANTS = Object.freeze({
  maximumIssues: MAX_ISSUES,
  maximumRetries: MAX_RETRIES,
  maximumBackoffMs: MAX_BACKOFF_MS,
  requestMethod: "GET" as const,
  writeEndpointsAllowed: false as const,
  automaticConflictResolutionAllowed: false as const,
  visualMutationAllowed: false as const,
});
