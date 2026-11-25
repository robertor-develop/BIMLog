import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSmartMeetingSeries } from "./smart-meeting-series-policy";

test("series policy normalizes schedule and approved agenda options", () => {
  assert.deepEqual(normalizeSmartMeetingSeries({
    name: "  Weekly MEP  ", frequency: "weekly", weekDays: [2, 2, 1],
    startTime: "09:00", durationMinutes: 180, timeZone: "America/New_York",
    agendaPolicy: { openRfis: true, unsupported: true },
  }), {
    name: "Weekly MEP", meetingType: "coordination", frequency: "weekly",
    intervalCount: 1, weekDays: [1, 2], startTime: "09:00", durationMinutes: 180,
    timeZone: "America/New_York", agendaLeadDays: 2, agendaPolicy: { openRfis: true },
  });
});

test("series policy rejects invalid schedules", () => {
  assert.throws(() => normalizeSmartMeetingSeries({ name: "X", frequency: "weekly", weekDays: [], startTime: "09:00", durationMinutes: 60, timeZone: "UTC" }), /week_days/);
  assert.throws(() => normalizeSmartMeetingSeries({ name: "X", frequency: "weekly", weekDays: [1], startTime: "25:00", durationMinutes: 60, timeZone: "UTC" }), /start_time/);
  assert.throws(() => normalizeSmartMeetingSeries({ name: "X", frequency: "weekly", weekDays: [1], startTime: "09:00", durationMinutes: 5, timeZone: "UTC" }), /duration/);
});
