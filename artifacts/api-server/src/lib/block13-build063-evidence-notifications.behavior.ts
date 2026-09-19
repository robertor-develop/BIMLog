import assert from "node:assert/strict";
import { bindCoordinationEvidence, evidenceForCoordinationVersion, type CoordinationEvidence } from "./construction-coordination-records";

const identity = { projectId: 53, type: "rfi" as const, id: 20, version: 2 };
const attachment = {
  id: "attachment-1",
  kind: "attachment" as const,
  value: "files/answer-sketch.pdf",
  contentSha256: "a".repeat(64),
  actorUserId: 11,
  createdAt: "2026-09-19T22:30:00.000Z",
};
const first = bindCoordinationEvidence({ identity, evidence: attachment, responsibleUserIds: [12, 11, 12, 13] });
assert.equal(first.result, "created");
assert.deepEqual(first.notification?.recipients, [12, 13]);
assert.equal(first.notification?.eventKey, "53:rfi:20:v2:attachment_added:attachment-1");
assert.equal(first.evidence[0].recordVersion, 2);

const replay = bindCoordinationEvidence({ identity, evidence: attachment, existing: first.evidence, responsibleUserIds: [12] });
assert.equal(replay.result, "idempotent");
assert.equal(replay.evidence.length, 1);
assert.equal(replay.notification, null);

assert.throws(() => bindCoordinationEvidence({ identity: { ...identity, version: 3 }, evidence: attachment, existing: first.evidence }), /cannot be rebound/);
assert.throws(() => bindCoordinationEvidence({ identity, evidence: { ...attachment, id: "bad", contentSha256: null } }), /SHA-256/);

const comment = bindCoordinationEvidence({
  identity,
  evidence: { id: "comment-1", kind: "comment", value: "Formal response reviewed", contentSha256: null, actorUserId: 12, createdAt: attachment.createdAt },
  existing: first.evidence,
  responsibleUserIds: [11],
});
assert.equal(comment.notification?.event, "comment_added");
assert.equal(evidenceForCoordinationVersion(identity, comment.evidence).length, 2);
assert.equal(evidenceForCoordinationVersion({ ...identity, version: 1 }, comment.evidence).length, 0);

const evidence: CoordinationEvidence[] = comment.evidence;
assert.deepEqual(evidence.map((entry) => entry.kind), ["attachment", "comment"]);
console.log("block 13 build 063 evidence and notifications: PASS");
