import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMeetingLifecycleTransition,
  normalizeMeetingLifecycle,
} from "./smart-meeting-lifecycle";

test("meeting lifecycle accepts the governed forward sequence", () => {
  assert.deepEqual(assertMeetingLifecycleTransition("draft_agenda", "published_agenda"), {
    current: "draft_agenda", next: "published_agenda", replayed: false,
  });
  assert.equal(assertMeetingLifecycleTransition("draft_minutes", "published_minutes").next, "published_minutes");
});

test("meeting lifecycle permits idempotent replay", () => {
  assert.equal(assertMeetingLifecycleTransition("in_progress", "in_progress").replayed, true);
});

test("meeting lifecycle rejects skipped, reopened, and unknown states", () => {
  assert.throws(() => assertMeetingLifecycleTransition("draft_agenda", "published_minutes"), /transition_denied/);
  assert.throws(() => assertMeetingLifecycleTransition("published_minutes", "draft_minutes"), /transition_denied/);
  assert.throws(() => normalizeMeetingLifecycle("closed"), /lifecycle_invalid/);
});
