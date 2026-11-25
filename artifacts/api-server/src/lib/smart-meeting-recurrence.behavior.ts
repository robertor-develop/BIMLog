import assert from "node:assert/strict";
import test from "node:test";
import { meetingOccurrenceKey, nextMeetingOccurrence } from "./smart-meeting-recurrence";

test("weekly recurrence selects the next configured weekday", () => {
  const next = nextMeetingOccurrence(
    { frequency: "weekly", weekDays: [2], startTime: "09:00", timeZone: "America/New_York" },
    new Date("2026-11-23T15:00:00.000Z"),
  );
  assert.equal(next.toISOString(), "2026-11-24T09:00:00.000Z");
});

test("recurrence skips a same-day time that already passed", () => {
  const next = nextMeetingOccurrence(
    { frequency: "weekly", weekDays: [2], startTime: "09:00", timeZone: "UTC" },
    new Date("2026-11-24T09:01:00.000Z"),
  );
  assert.equal(next.toISOString(), "2026-12-01T09:00:00.000Z");
});

test("occurrence identity is deterministic and series scoped", () => {
  const occurrence = new Date("2026-12-01T09:00:00.000Z");
  assert.equal(meetingOccurrenceKey(4, occurrence), "meeting-series:4:2026-12-01T09:00:00.000Z");
  assert.notEqual(meetingOccurrenceKey(4, occurrence), meetingOccurrenceKey(5, occurrence));
});

test("invalid recurrence input fails closed", () => {
  assert.throws(
    () => nextMeetingOccurrence(
      { frequency: "weekly", weekDays: [], startTime: "09:00", timeZone: "UTC" },
      new Date(),
    ),
    /meeting_week_day_required/,
  );
});
