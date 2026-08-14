import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LENS_NEXT_ACTIVITY_VIEW_INVARIANTS,
  LensNextActivityTimelineView,
} from "../../src/features/lens-next/LensNextActivityTimelineView";
import type { LensNextTimelineState } from "../../src/features/lens-next/lens-next-activity-timeline";

const identity = {
  projectId: 26,
  serverId: 101,
  viewpointId: "vp-immutable-001",
  issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
  lifecycleStatus: "active" as const,
  revisionNumber: 4,
};
const digest = "a".repeat(64);

function state(mode: LensNextTimelineState["mode"]): LensNextTimelineState {
  return {
    mode,
    identity,
    historyVersion: 7,
    visualStateDigest: digest,
    events: [],
    nextCursor: null,
    reason: mode === "blocked" ? "IMMUTABLE_IDENTITY_MISMATCH" : null,
  };
}

const stateCases = [
  ["loading", { state: state("empty"), loading: true }],
  ["empty", { state: state("empty") }],
  ["offline", { state: state("offline") }],
  ["error", { state: state("error") }],
  ["blocked", { state: state("blocked") }],
] as const;

for (const [expected, props] of stateCases) {
  const english = renderToStaticMarkup(
    <LensNextActivityTimelineView {...props} />,
  );
  const spanish = renderToStaticMarkup(
    <LensNextActivityTimelineView {...props} locale="es" />,
  );
  assert.match(english, new RegExp(`data-timeline-state="${expected}"`));
  assert.match(english, /aria-live="(polite|assertive)"/);
  assert.match(spanish, /Actividad del asunto/);
  assert.match(english, /mobile-280px-single-column/);
  assert.doesNotMatch(english, /<button|<a\b/);
}

const ready: LensNextTimelineState = {
  ...state("ready"),
  nextCursor: "cursor_0002",
  events: Array.from({ length: 500 }, (_, index) => ({
    activityId: `activity:immutable:${String(index).padStart(4, "0")}`,
    type: (["status", "comment", "assignment"] as const)[index % 3],
    identity,
    version: index + 1,
    occurredAt: new Date(Date.UTC(2026, 7, 12, 12, 0, index)).toISOString(),
    actorDisplayName: "Pilot Reviewer",
    summary: `Verified event ${index + 1}`,
    visualStateDigest: digest,
  })),
};

const markup = renderToStaticMarkup(
  <LensNextActivityTimelineView state={ready} visibleLimit={100} />,
);
assert.equal((markup.match(/<li/g) ?? []).length, 100);
assert.equal((markup.match(/<article/g) ?? []).length, 100);
assert.equal((markup.match(/<time/g) ?? []).length, 100);
assert.match(markup, /400 older events are not rendered/);
assert.match(markup, /More verified history is available/);
assert.match(markup, /data-more-history-available/);
assert.match(markup, /123e4567-e89b-42d3-a456-426614174000/);
assert.match(markup, /History version: 7/);
assert.match(markup, /Issue revision: 4/);
assert.doesNotMatch(markup, /<button|<a\b/);
assert.equal((markup.match(/<svg/g) ?? []).length, 101);

const narrowBound = renderToStaticMarkup(
  <LensNextActivityTimelineView state={ready} visibleLimit={500} />,
);
assert.equal((narrowBound.match(/<li/g) ?? []).length, 100);
assert.match(narrowBound, /data-render-limit="100"/);

assert.deepEqual(LENS_NEXT_ACTIVITY_VIEW_INVARIANTS, {
  maximumRenderedEvents: 100,
  maximumModelEvents: 500,
  minimumWidthPx: 280,
  actionControls: 0,
  networkBehavior: false,
  persistenceBehavior: false,
  writeBehavior: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    stateViews: 6,
    locales: 2,
    modelEvents: 500,
    renderedEvents: 100,
    hiddenEvents: 400,
    cursorPresentationOnly: true,
    actionControls: 0,
    networkBehavior: false,
    persistenceBehavior: false,
    writeBehavior: false,
  }),
);
