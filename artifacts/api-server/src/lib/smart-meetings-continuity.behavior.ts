import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSmartMeetingLifecycleTransition,
  isUnresolvedMeetingItem,
  selectSmartMeetingCarryForward,
} from "./smart-meetings-continuity";

test("carry-forward keeps unresolved records and attendees", () => {
  assert.equal(isUnresolvedMeetingItem({ kind: "rfi", sourceId: 1, status: "Open" }), true);
  assert.equal(isUnresolvedMeetingItem({ kind: "rfi", sourceId: 2, status: "Closed" }), false);
  assert.equal(isUnresolvedMeetingItem({ kind: "attendee", sourceId: 3 }), true);
});

test("carry-forward honors explicit exclusions and stable identity deduplication", () => {
  assert.deepEqual(
    selectSmartMeetingCarryForward([
      { kind: "rfi", sourceId: 7, status: "Pending" },
      { kind: "rfi", sourceId: 7, status: "Pending" },
      { kind: "submittal", sourceId: 7, status: "Pending" },
      { kind: "lens_viewpoint", sourceId: 8, status: "Resolved" },
      { kind: "action_item", sourceId: 9, status: "Open", excluded: true },
    ]),
    [
      { kind: "rfi", sourceId: 7, status: "Pending" },
      { kind: "submittal", sourceId: 7, status: "Pending" },
    ],
  );
});

test("meeting lifecycle advances one governed state at a time", () => {
  assert.equal(
    assertSmartMeetingLifecycleTransition("draft_agenda", "published_agenda"),
    "published_agenda",
  );
  assert.throws(
    () => assertSmartMeetingLifecycleTransition("draft_agenda", "published_minutes"),
    /invalid_meeting_lifecycle_transition/,
  );
});
