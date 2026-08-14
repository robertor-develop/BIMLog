import assert from "node:assert/strict";
import {
  LENS_NEXT_AUTO_REFRESH_INVARIANTS,
  applyLensNextRefreshResponse,
  createLensNextAutoRefreshState,
  markLensNextRefreshOffline,
  startLensNextAutoRefresh,
  type LensNextAutoRefreshState,
  type LensNextRefreshResponse,
  type LensNextRefreshSession,
} from "../../src/features/lens-next/lens-next-auto-refresh";

const identity = {
  projectId: 26,
  issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
  serverId: 101,
  viewpointId: "vp-immutable-001",
  lifecycleStatus: "active" as const,
  revisionNumber: 4,
};
const visualDigest = "a".repeat(64);
const emptyDigest = "0".repeat(64);
const issueDigest = "b".repeat(64);
const responseFingerprint = "c".repeat(64);
const session: LensNextRefreshSession = {
  sessionId: "session:ephemeral:001",
  projectId: 26,
  credentialVersion: 3,
  active: true,
  ephemeralInMemory: true,
};

const fresh = () =>
  createLensNextAutoRefreshState({
    identity,
    version: 7,
    visualStateDigest: visualDigest,
    issueSetDigest: emptyDigest,
  });

function start(state: LensNextAutoRefreshState, nowMs = 1000) {
  const started = startLensNextAutoRefresh(
    state,
    session,
    nowMs,
    `refresh:request:${nowMs}`,
  );
  assert.equal(started.started, true);
  if (!started.started) throw new Error("refresh should start");
  assert.equal(started.request.method, "GET");
  assert.equal(started.request.authenticated, true);
  assert.equal(started.state.mode, "refreshing");
  return started;
}

function response(
  requestId: string,
  overrides: Partial<LensNextRefreshResponse> = {},
): LensNextRefreshResponse {
  return {
    requestId,
    identity: { ...identity },
    version: 8,
    visualStateDigest: visualDigest,
    issueCount: 500,
    issueSetDigest: issueDigest,
    responseFingerprint,
    ...overrides,
  };
}

const first = start(fresh());
const singleFlight = startLensNextAutoRefresh(
  first.state,
  session,
  1001,
  "refresh:request:second",
);
assert.equal(singleFlight.started, false);
assert.equal(singleFlight.state.inFlight?.requestId, first.request.requestId);

const applied = applyLensNextRefreshResponse(
  first.state,
  response(first.request.requestId),
);
assert.equal(applied.mode, "saved");
assert.equal(applied.issueCount, 500);
assert.equal(applied.version, 8);
assert.equal(applied.visualStateDigest, visualDigest);

const duplicateStart = start(applied, 2000);
const duplicate = applyLensNextRefreshResponse(
  duplicateStart.state,
  response(duplicateStart.request.requestId, {
    identity: { ...identity },
    version: 8,
  }),
);
assert.equal(duplicate.mode, "saved");
assert.equal(duplicate.version, 8);
assert.equal(duplicate.issueCount, 500);

const staleStart = start(applied, 3000);
const stale = applyLensNextRefreshResponse(
  staleStart.state,
  response(staleStart.request.requestId, { version: 6 }),
);
assert.equal(stale.mode, "conflict");
assert.equal(stale.reason, "STALE_REFRESH_RESPONSE");

const divergentStart = start(applied, 4000);
const divergent = applyLensNextRefreshResponse(
  divergentStart.state,
  response(divergentStart.request.requestId, {
    identity: { ...identity },
    version: 8,
    issueSetDigest: "d".repeat(64),
    responseFingerprint: "e".repeat(64),
  }),
);
assert.equal(divergent.mode, "conflict");
assert.equal(divergent.reason, "DIVERGENT_DUPLICATE_RESPONSE");

const identityStart = start(fresh(), 5000);
const identityMismatch = applyLensNextRefreshResponse(
  identityStart.state,
  response(identityStart.request.requestId, {
    identity: { ...identity, serverId: 102 },
  }),
);
assert.equal(identityMismatch.mode, "action_blocked");
assert.equal(identityMismatch.reason, "IMMUTABLE_IDENTITY_MISMATCH");

const visualStart = start(fresh(), 6000);
const visualMismatch = applyLensNextRefreshResponse(
  visualStart.state,
  response(visualStart.request.requestId, {
    visualStateDigest: "f".repeat(64),
  }),
);
assert.equal(visualMismatch.mode, "action_blocked");
assert.equal(visualMismatch.reason, "VISUAL_STATE_DIVERGED");

const wrongRequest = applyLensNextRefreshResponse(
  start(fresh(), 7000).state,
  response("refresh:request:unbound"),
);
assert.equal(wrongRequest.mode, "action_blocked");
assert.equal(wrongRequest.reason, "UNBOUND_REFRESH_RESPONSE");

let offline = fresh();
for (let attempt = 1; attempt <= 4; attempt += 1) {
  const now = attempt * 10_000;
  const running = start(offline, Math.max(now, offline.nextRetryAtMs ?? now));
  offline = markLensNextRefreshOffline(running.state, now);
  assert.equal(offline.mode, "offline");
  assert.equal(offline.retryAttempt, attempt);
  assert.ok((offline.nextRetryAtMs ?? 0) > now);
}
const finalRunning = start(
  offline,
  Math.max(50_000, offline.nextRetryAtMs ?? 50_000),
);
const exhausted = markLensNextRefreshOffline(finalRunning.state, 50_000);
assert.equal(exhausted.mode, "action_blocked");
assert.equal(exhausted.reason, "RETRY_LIMIT_REACHED");

const unauthenticated = startLensNextAutoRefresh(
  fresh(),
  { ...session, active: false },
  9000,
  "refresh:request:unauthenticated",
);
assert.equal(unauthenticated.started, false);
assert.equal(unauthenticated.state.mode, "action_blocked");

assert.throws(
  () =>
    createLensNextAutoRefreshState({
      identity,
      version: 7,
      visualStateDigest: visualDigest,
      issueCount: 501,
      issueSetDigest: issueDigest,
    }),
  /ISSUE_SET_INVALID/,
);
assert.deepEqual(LENS_NEXT_AUTO_REFRESH_INVARIANTS, {
  maximumIssues: 500,
  maximumRetries: 4,
  maximumBackoffMs: 8000,
  requestMethod: "GET",
  writeEndpointsAllowed: false,
  automaticConflictResolutionAllowed: false,
  visualMutationAllowed: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    states: [
      "idle",
      "refreshing",
      "saved",
      "offline",
      "conflict",
      "action_blocked",
    ],
    oneInFlight: true,
    authenticatedGetOnly: true,
    retryAttempts: 4,
    maximumIssues: 500,
    duplicateIdempotent: true,
    visualStateInvariant: true,
    writeEndpoints: 0,
    io: { network: false, database: false, customer: false, provider: false },
  }),
);
