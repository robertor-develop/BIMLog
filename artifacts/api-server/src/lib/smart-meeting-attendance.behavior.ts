import assert from "node:assert/strict";
import test from "node:test";
import { resolveMeetingParticipants } from "./meeting-participant-action-identity";

test("defaults invitation and attendance to explicit non-claims", () => {
  const [attendee] = resolveMeetingParticipants([{ full_name: "Ruben Crespo" }]);
  assert.equal(attendee.invitationStatus, "not_sent");
  assert.equal(attendee.attendanceStatus, "unknown");
});

test("accepts governed invitation and attendance states", () => {
  const [attendee] = resolveMeetingParticipants([{
    full_name: "Ruben Crespo", invitation_status: "accepted", attendance_status: "present",
  }]);
  assert.equal(attendee.invitationStatus, "accepted");
  assert.equal(attendee.attendanceStatus, "present");
});

test("rejects fabricated invitation and attendance states", () => {
  assert.throws(() => resolveMeetingParticipants([{ full_name: "Ruben", invitation_status: "emailed" }]));
  assert.throws(() => resolveMeetingParticipants([{ full_name: "Ruben", attendance_status: "maybe" }]));
});
