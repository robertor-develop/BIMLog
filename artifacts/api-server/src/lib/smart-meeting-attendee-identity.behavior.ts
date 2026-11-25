import assert from "node:assert/strict";
import test from "node:test";
import {
  meetingParticipantIdentity,
  resolveMeetingParticipants,
} from "./meeting-participant-action-identity";

test("normalizes external attendee email and human-readable fields", () => {
  const [attendee] = resolveMeetingParticipants([{
    external_email: "  RUBEN@Example.COM ",
    full_name: "  Ruben   Crespo ",
    company: "  BIMTECH   Corp ",
    role: "  BIM   Coordinator ",
  }]);
  assert.equal(attendee.identity, "external:ruben@example.com");
  assert.equal(attendee.externalEmail, "ruben@example.com");
  assert.equal(attendee.fullName, "Ruben Crespo");
  assert.equal(attendee.company, "BIMTECH Corp");
  assert.equal(attendee.role, "BIM Coordinator");
});

test("uses governed identity priority for known project contacts", () => {
  assert.equal(meetingParticipantIdentity({ user_id: 7, directory_entry_id: 8, external_email: "a@example.com", full_name: "A" }), "user:7");
  assert.equal(meetingParticipantIdentity({ directory_entry_id: 8, external_email: "a@example.com", full_name: "A" }), "directory:8");
});

test("rejects case-only duplicate external attendees", () => {
  assert.throws(() => resolveMeetingParticipants([
    { external_email: "ruben@example.com", full_name: "Ruben Crespo" },
    { external_email: "RUBEN@EXAMPLE.COM", full_name: "R. Crespo" },
  ]), /meeting_participant_duplicate_identity/);
});

test("retains distinct people without email by normalized name and company", () => {
  const attendees = resolveMeetingParticipants([
    { full_name: "Ruben Crespo", company: "BIMTECH" },
    { full_name: "Ruben Crespo", company: "Mega Contracting" },
  ]);
  assert.equal(attendees.length, 2);
});
