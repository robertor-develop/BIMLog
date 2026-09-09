import assert from "node:assert/strict";
import {
  createImmutableAuditEvent,
  projectLegacyAction,
  unifiedActionSchema,
} from "./unified-action-contract";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const owner = { kind: "user" as const, id: "17", displayName: "Owner", email: null };

const action = projectLegacyAction({
  module: "meetings",
  sourceType: "action_item",
  sourceRecordId: 42,
  projectId: 9,
  companyId: 3,
  tradeId: 7,
  owner,
  assignee: { kind: "contact", id: "88", displayName: "Trade lead", email: "lead@example.test" },
  title: "Confirm coordinated ceiling elevation",
  dueAt: "2026-09-10T15:00:00Z",
  status: "open",
  sourceSnapshotDigest: hashA,
  createdAt: "2026-09-08T12:00:00Z",
  updatedAt: "2026-09-08T12:00:00Z",
});
assert.equal(action.actionId, "meetings:action_item:42");
assert.equal(action.source.recordId, "42");
assert.equal(action.companyId, 3);
assert.equal(action.tradeId, 7);

assert.throws(() => unifiedActionSchema.parse({ ...action, owner: null }));
assert.throws(() => unifiedActionSchema.parse({ ...action, visibility: "external", assignee: null }));
assert.throws(() => unifiedActionSchema.parse({ ...action, sourceSnapshotDigest: "not-a-digest" }));

const event = createImmutableAuditEvent({
  contractVersion: "1.0",
  immutable: true,
  eventId: "evt-1",
  eventType: "status_changed",
  occurredAt: "2026-09-08T13:00:00Z",
  actor: owner,
  projectId: 9,
  companyId: 3,
  tradeId: 7,
  source: action.source,
  actionId: action.actionId,
  previousSnapshotDigest: hashA,
  resultingSnapshotDigest: hashB,
  reasonCode: "WORK_CONFIRMED",
  evidenceRefs: ["evidence:100"],
});
assert.equal(Object.isFrozen(event), true);
assert.equal(Object.isFrozen(event.source), true);
assert.equal(Object.isFrozen(event.evidenceRefs), true);
assert.throws(() => { (event as { eventType: string }).eventType = "created"; });

console.log("unified action and audit contract behavior: PASS");
