import assert from "node:assert/strict";
import {
  meetingActionAssigneeIdentity,
  meetingParticipantIdentity,
  resolveMeetingActionInputs,
  resolveMeetingParticipants,
} from "./meeting-participant-action-identity";

assert.equal(meetingParticipantIdentity({ full_name: "Roberto", user_id: 7 }), "user:7");
assert.equal(
  meetingParticipantIdentity({ full_name: "External", external_email: " PERSON@Example.COM " }),
  "external:person@example.com",
);
assert.throws(
  () => resolveMeetingParticipants([
    { full_name: "First", external_email: "person@example.com" },
    { full_name: "Second", external_email: "PERSON@example.com" },
  ]),
  /meeting_participant_duplicate_identity/,
);

const participants = resolveMeetingParticipants([
  { full_name: "  Roberto   Rodriguez ", company: " IgniteSmart " },
]);
assert.equal(participants[0].fullName, "Roberto Rodriguez");
assert.equal(participants[0].identity, "named:roberto rodriguez|ignitesmart");

assert.equal(
  meetingActionAssigneeIdentity({ description: "Follow up", assigned_to_email: " OWNER@EXAMPLE.COM " }),
  "external:owner@example.com",
);
const actions = resolveMeetingActionInputs({
  items: [{ description: "  Coordinate   response ", assigned_to_name: " Owner ", due_date: "2026-09-30" }],
});
assert.equal(actions[0].description, "Coordinate response");
assert.equal(actions[0].assigneeIdentity, "named:owner");
assert.equal(actions[0].dueDate?.toISOString(), "2026-09-30T00:00:00.000Z");

console.log("POST120_BUILD167=PASS participant_identity=centralized action_identity=centralized duplicates=denied");
