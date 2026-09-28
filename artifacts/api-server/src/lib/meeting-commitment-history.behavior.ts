import assert from "node:assert/strict";
import { carryMeetingCommitments, closeMeetingCommitment } from "./meeting-commitment-history";

const open = { commitmentId: "A-1", revision: 1, meetingId: "M-1", ownerUserId: 20, dueDate: "2026-10-01", state: "open" as const, evidenceIds: ["RFI-10"] };
const closed = closeMeetingCommitment({ ...open, commitmentId: "A-2" }, { meetingId: "M-1", evidenceIds: ["FILE-8"] });
const carried = carryMeetingCommitments({ fromMeetingId: "M-1", toMeetingId: "M-2", commitments: [open, open, closed] });
assert.equal(carried.length, 1);
assert.deepEqual(carried[0], { ...open, revision: 2, meetingId: "M-2", carriedFromMeetingId: "M-1", evidenceIds: ["RFI-10"] });
assert.throws(() => closeMeetingCommitment(open, { meetingId: "M-1", evidenceIds: [] }), /CLOSURE_EVIDENCE_REQUIRED/);
assert.throws(() => closeMeetingCommitment(closed, { meetingId: "M-2", evidenceIds: ["X"] }), /ALREADY_CLOSED/);
console.log("C052 commitment carry-forward and closure evidence: PASS");
