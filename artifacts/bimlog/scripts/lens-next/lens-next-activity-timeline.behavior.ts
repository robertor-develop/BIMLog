import assert from "node:assert/strict";
import {
  LENS_NEXT_TIMELINE_INVARIANTS,
  applyLensNextHistoryPage,
  createLensNextHistoryGetRequest,
  createLensNextTimelineState,
  markLensNextTimelineUnavailable,
  toLensNextTimelineItems,
  type LensNextActivityEvent,
  type LensNextTimelineState,
} from "../../src/features/lens-next/lens-next-activity-timeline";

const identity = {
  projectId: 26,
  serverId: 101,
  viewpointId: "vp-immutable-001",
  issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
  lifecycleStatus: "active" as const,
  revisionNumber: 4,
};
const digest = "a".repeat(64);
const initial = () =>
  createLensNextTimelineState({
    identity,
    historyVersion: 0,
    visualStateDigest: digest,
  });

function event(index: number): LensNextActivityEvent {
  const types = ["status", "comment", "assignment"] as const;
  return {
    activityId: `activity:immutable:${String(index).padStart(4, "0")}`,
    type: types[index % 3],
    identity: { ...identity },
    version: index + 1,
    occurredAt: new Date(Date.UTC(2026, 7, 12, 12, 0, index)).toISOString(),
    actorDisplayName: "Pilot Reviewer",
    summary: `Activity ${index + 1}`,
    visualStateDigest: digest,
  };
}

const request = createLensNextHistoryGetRequest({
  state: initial(),
  sessionId: "session:ephemeral:001",
  authenticated: true,
});
assert.ok(request);
assert.equal(request.method, "GET");
assert.equal(request.authenticated, true);
assert.equal(request.limit, 100);
assert.equal(
  createLensNextHistoryGetRequest({
    state: initial(),
    sessionId: "session:ephemeral:001",
    authenticated: false,
  }),
  null,
);

let state: LensNextTimelineState = initial();
for (let page = 0; page < 5; page += 1) {
  const pageEvents = Array.from({ length: 100 }, (_, offset) =>
    event(page * 100 + offset),
  );
  state = applyLensNextHistoryPage(state, {
    identity,
    requestCursor: state.nextCursor,
    nextCursor:
      page === 4 ? null : `cursor_${String(page + 1).padStart(4, "0")}`,
    historyVersion: page + 1,
    visualStateDigest: digest,
    events: pageEvents,
  });
  assert.equal(state.mode, "ready");
}
assert.equal(state.events.length, 500);
assert.equal(state.events[0].activityId, "activity:immutable:0000");
assert.equal(state.events[499].activityId, "activity:immutable:0499");

const deduped = applyLensNextHistoryPage(state, {
  identity,
  requestCursor: null,
  nextCursor: null,
  historyVersion: 5,
  visualStateDigest: digest,
  events: [event(499)],
});
assert.equal(deduped.mode, "ready");
assert.equal(deduped.events.length, 500);

const divergentDuplicate = { ...event(1), summary: "Different" };
const divergent = applyLensNextHistoryPage(
  applyLensNextHistoryPage(initial(), {
    identity,
    requestCursor: null,
    nextCursor: null,
    historyVersion: 1,
    visualStateDigest: digest,
    events: [event(1)],
  }),
  {
    identity,
    requestCursor: null,
    nextCursor: null,
    historyVersion: 1,
    visualStateDigest: digest,
    events: [divergentDuplicate],
  },
);
assert.equal(divergent.mode, "blocked");
assert.equal(divergent.reason, "DIVERGENT_ACTIVITY_DUPLICATE");

const stale = applyLensNextHistoryPage(
  { ...initial(), historyVersion: 3 },
  {
    identity,
    requestCursor: null,
    nextCursor: null,
    historyVersion: 2,
    visualStateDigest: digest,
    events: [],
  },
);
assert.equal(stale.mode, "blocked");
assert.equal(stale.reason, "STALE_HISTORY_VERSION");

const wrongCursor = applyLensNextHistoryPage(initial(), {
  identity,
  requestCursor: "cursor_wrong",
  nextCursor: null,
  historyVersion: 1,
  visualStateDigest: digest,
  events: [],
});
assert.equal(wrongCursor.mode, "blocked");
assert.equal(wrongCursor.reason, "CURSOR_MISMATCH");

const nonMonotonic = applyLensNextHistoryPage(initial(), {
  identity,
  requestCursor: null,
  nextCursor: null,
  historyVersion: 1,
  visualStateDigest: digest,
  events: [
    { ...event(2), version: 1 },
    { ...event(1), version: 2 },
  ],
});
assert.equal(nonMonotonic.mode, "blocked");
assert.equal(nonMonotonic.reason, "NON_MONOTONIC_HISTORY");

const identityMismatch = applyLensNextHistoryPage(initial(), {
  identity: { ...identity, serverId: 102 },
  requestCursor: null,
  nextCursor: null,
  historyVersion: 1,
  visualStateDigest: digest,
  events: [],
});
assert.equal(identityMismatch.mode, "blocked");

const empty = applyLensNextHistoryPage(initial(), {
  identity,
  requestCursor: null,
  nextCursor: null,
  historyVersion: 1,
  visualStateDigest: digest,
  events: [],
});
assert.equal(empty.mode, "empty");
assert.equal(markLensNextTimelineUnavailable(empty, "offline").mode, "offline");
assert.equal(markLensNextTimelineUnavailable(empty, "error").mode, "error");

const one = applyLensNextHistoryPage(initial(), {
  identity,
  requestCursor: null,
  nextCursor: null,
  historyVersion: 1,
  visualStateDigest: digest,
  events: [event(0), event(1), event(2)],
});
const english = toLensNextTimelineItems(one, "en");
const spanish = toLensNextTimelineItems(one, "es");
assert.deepEqual(
  english.map((item) => item.label),
  ["Status changed", "Comment added", "Assignment changed"],
);
assert.deepEqual(
  spanish.map((item) => item.label),
  ["Estado actualizado", "Comentario agregado", "Asignación actualizada"],
);
assert.ok(
  english.every(
    (item) =>
      item.key && item.actorLabel && item.timeLabel && item.versionLabel,
  ),
);

assert.deepEqual(LENS_NEXT_TIMELINE_INVARIANTS, {
  maximumEvents: 500,
  pageSize: 100,
  method: "GET",
  actionEnablement: false,
  writeBehavior: false,
  fallbackMatching: false,
  automaticConflictResolution: false,
  visualStateMutation: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    events: state.events.length,
    pages: 5,
    duplicatesAdded: 0,
    deterministicOrdering: true,
    staleBlocked: true,
    divergentBlocked: true,
    cursorBlocked: true,
    states: ["empty", "ready", "offline", "error", "blocked"],
    locales: 2,
    writes: 0,
    io: { network: false, database: false, customer: false, provider: false },
  }),
);
