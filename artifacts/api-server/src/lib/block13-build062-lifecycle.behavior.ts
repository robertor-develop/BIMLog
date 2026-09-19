import assert from "node:assert/strict";
import { transitionCoordinationRecord, type CoordinationRecordIdentity } from "./construction-coordination-records";

const at = "2026-09-19T22:15:00.000Z";
const actorUserId = 11;
const rfi: CoordinationRecordIdentity = { projectId: 53, type: "rfi", id: 20, version: 1 };
let state = transitionCoordinationRecord({ identity: rfi, status: "draft", action: "submit", actorUserId, occurredAt: at });
state = transitionCoordinationRecord({ identity: rfi, status: state.status, action: "respond", actorUserId: 12, occurredAt: at, history: state.history });
state = transitionCoordinationRecord({ identity: rfi, status: state.status, action: "close", actorUserId, occurredAt: at, history: state.history });
state = transitionCoordinationRecord({ identity: rfi, status: state.status, action: "reopen", reason: "Response needs correction", actorUserId, occurredAt: at, history: state.history });
assert.equal(state.status, "open");
assert.equal(state.history.length, 4);
assert.deepEqual(state.history.map((entry) => entry.sequence), [1, 2, 3, 4]);
assert.equal(state.history[3].reason, "Response needs correction");

assert.throws(() => transitionCoordinationRecord({ identity: rfi, status: "draft", action: "close", actorUserId, occurredAt: at }), /not allowed/);
assert.throws(() => transitionCoordinationRecord({ identity: rfi, status: "closed", action: "reopen", actorUserId, occurredAt: at }), /requires a reason/);
assert.throws(() => transitionCoordinationRecord({ identity: { ...rfi, type: "submittal" }, status: "under_review", action: "reject", actorUserId, occurredAt: at }), /requires a reason/);

const matrix = [
  [{ ...rfi, type: "issue" as const }, "open", "resolve", "resolved"],
  [{ ...rfi, type: "submittal" as const }, "under_review", "approve", "approved"],
  [{ ...rfi, type: "transmittal" as const }, "sent", "acknowledge", "acknowledged"],
  [{ ...rfi, type: "meeting" as const }, "draft", "issue", "issued"],
  [{ ...rfi, type: "schedule" as const }, "in_progress", "complete", "complete"],
  [{ ...rfi, type: "change_order" as const }, "submitted", "approve", "approved"],
] as const;
for (const [identity, status, action, expected] of matrix) {
  assert.equal(transitionCoordinationRecord({ identity, status, action, actorUserId, occurredAt: at }).status, expected);
}

console.log("block 13 build 062 lifecycle matrix: PASS");
