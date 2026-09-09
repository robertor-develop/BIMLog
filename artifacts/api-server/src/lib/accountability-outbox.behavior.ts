import assert from "node:assert/strict";
import { AccountabilityOutboxConflict, enqueueAccountabilityIntent } from "./accountability-outbox";

const intent = { id: "intent-1", actionId: "action-1", projectId: 7, companyId: 3, recipientContactId: 30, channel: "email", templateKey: "overdue-v1", payloadDigest: "a".repeat(64), idempotencyKey: "action-1:overdue:1", approval: { required: true, approvedByUserId: 11, approvedAt: "2026-09-09T12:00:00Z" } } as const;
assert.equal(enqueueAccountabilityIntent(intent, null).result, "queued");
assert.equal(enqueueAccountabilityIntent(intent, intent).result, "idempotent");
assert.throws(() => enqueueAccountabilityIntent({ ...intent, payloadDigest: "b".repeat(64) }, intent), AccountabilityOutboxConflict);
assert.throws(() => enqueueAccountabilityIntent({ ...intent, approval: { required: true, approvedByUserId: null, approvedAt: null } }, null));
console.log("accountability outbox behavior: PASS");
