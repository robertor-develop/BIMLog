import assert from "node:assert/strict";
import test from "node:test";
import { parseIcsMeeting } from "./smart-meeting-ics";

const fixture = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:meeting-42@example.com",
  "DTSTART:20261201T140000Z", "DTEND:20261201T160000Z",
  "SUMMARY:Weekly MEP Coordination", "LOCATION:Microsoft Teams",
  "ATTENDEE;CN=Ruben Crespo:mailto:RUBEN@example.com", "END:VEVENT", "END:VCALENDAR",
].join("\r\n");

test("parses a bounded UTC calendar event and normalized attendees", () => {
  assert.deepEqual(parseIcsMeeting(fixture), {
    uid: "meeting-42@example.com", title: "Weekly MEP Coordination",
    start: "2026-12-01T14:00:00Z", end: "2026-12-01T16:00:00Z",
    location: "Microsoft Teams", attendees: [{ fullName: "Ruben Crespo", email: "ruben@example.com" }],
  });
});

test("rejects missing event identity and ambiguous local dates", () => {
  assert.throws(() => parseIcsMeeting("BEGIN:VCALENDAR\nEND:VCALENDAR"), /meeting_ics_event_required/);
  assert.throws(() => parseIcsMeeting(fixture.replace("20261201T140000Z", "20261201T140000")), /meeting_ics_unsupported_date/);
});

test("rejects oversized calendar content before parsing", () => {
  assert.throws(() => parseIcsMeeting("x".repeat(1_000_001)), /meeting_ics_too_large/);
});
