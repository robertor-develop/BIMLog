import assert from "node:assert/strict";
import {
  LENS_NEXT_OFFLINE_QUEUE_INVARIANTS,
  createLensNextOfflineQueue,
  enqueueLensNextDraft,
  markLensNextQueueHeadRetry,
  reconfirmLensNextQueueHead,
  setLensNextQueueConnectivity,
} from "../../src/features/lens-next/lens-next-offline-queue";
import { createLensNextActionDraft } from "../../src/features/lens-next/lens-next-action-draft";

const actorId = "123e4567-e89b-42d3-a456-426614174000";
const familyId = "223e4567-e89b-42d3-a456-426614174000";
const digest = "a".repeat(64);
const receiptSha = "b".repeat(64);

function draft(index: number) {
  const decision = createLensNextActionDraft({
    contractVersion: "lens-next-action-draft.v1",
    action: "comment",
    actorId,
    nonce: `nonce:injected:${String(index).padStart(4, "0")}`,
    identity: {
      projectId: 26,
      issueFamilyId: familyId,
      serverId: 101,
      viewpointId: "vp-immutable-001",
      lifecycleStatus: "active",
      revisionNumber: 4,
    },
    preconditions: {
      issueFamilyId: familyId,
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
    },
    payload: { body: `Offline comment ${index}` },
    confirmation: { confirmed: true, reason: null },
    capability: {
      action: "comment",
      contractReady: true,
      enabled: true,
      dispatchAllowed: true,
      mutationAllowed: false,
      serverExecutorBound: true,
      visualMutationAllowed: false,
      persistentTokenStoreAllowed: false,
      conflictAutoResolutionAllowed: false,
    },
    visualState: { digestBefore: digest, digestAfter: digest },
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) throw new Error("expected draft");
  return {
    draft: decision.draft,
    executorBinding: {
      receiptId: "executor:comment:receipt-001",
      receiptSha256: receiptSha,
      action: "comment" as const,
      actorId,
      projectId: 26,
      serverId: 101,
      revisionNumber: 4,
      current: true as const,
      expiresAt: "2026-08-13T00:00:00.000Z",
    },
  };
}

let queue = createLensNextOfflineQueue();
for (let index = 0; index < 100; index += 1) {
  const result = enqueueLensNextDraft(queue, draft(index), 1000 + index);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected enqueue success");
  assert.equal(result.duplicate, false);
  queue = result.state;
}
assert.equal(queue.items.length, 100);
assert.equal(
  (queue.items[0].draft.payload as { body: string }).body,
  "Offline comment 0",
);
assert.equal(
  (queue.items[99].draft.payload as { body: string }).body,
  "Offline comment 99",
);
assert.equal(queue.persistentStorageAllowed, false);
assert.equal(queue.dispatchPerformed, false);

const duplicate = enqueueLensNextDraft(queue, draft(0), 2000);
assert.equal(duplicate.ok, true);
if (!duplicate.ok) throw new Error("expected duplicate replay");
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.state.items.length, 100);

const overflow = enqueueLensNextDraft(queue, draft(100), 2000);
assert.equal(overflow.ok, false);
if (overflow.ok) throw new Error("expected overflow");
assert.equal(overflow.code, "QUEUE_CAPACITY_EXCEEDED");

const mismatchInput = draft(0);
mismatchInput.draft.payload = { body: "Conflicting duplicate" };
const mismatch = enqueueLensNextDraft(queue, mismatchInput, 2000);
assert.equal(mismatch.ok, false);
if (mismatch.ok) throw new Error("expected mismatch");
assert.equal(mismatch.code, "QUEUE_DUPLICATE_MISMATCH");

let single = enqueueLensNextDraft(createLensNextOfflineQueue(), draft(0), 1000);
assert.equal(single.ok, true);
if (!single.ok) throw new Error("expected single enqueue");
const offlineReconfirm = reconfirmLensNextQueueHead(single.state, {
  nonce: "reconfirm:nonce:0001",
  nowMs: 2000,
  expectedStatus: "open",
  expectedVersion: 7,
  expectedRevisionNumber: 4,
  executorReceiptSha256: receiptSha,
  visualStateDigest: digest,
});
assert.equal(offlineReconfirm.ok, false);

let online = setLensNextQueueConnectivity(single.state, "online");
const stale = reconfirmLensNextQueueHead(online, {
  nonce: "reconfirm:nonce:0001",
  nowMs: 2000,
  expectedStatus: "resolved",
  expectedVersion: 7,
  expectedRevisionNumber: 4,
  executorReceiptSha256: receiptSha,
  visualStateDigest: digest,
});
assert.equal(stale.ok, false);
if (stale.ok) throw new Error("expected stale block");
assert.equal(stale.code, "DRAFT_STALE");

const reconfirmed = reconfirmLensNextQueueHead(online, {
  nonce: "reconfirm:nonce:0001",
  nowMs: 2000,
  expectedStatus: "open",
  expectedVersion: 7,
  expectedRevisionNumber: 4,
  executorReceiptSha256: receiptSha,
  visualStateDigest: digest,
});
assert.equal(reconfirmed.ok, true);
if (!reconfirmed.ok) throw new Error("expected reconfirmation");
online = reconfirmed.state;
assert.equal(online.items[0].reconfirmationNonce, "reconfirm:nonce:0001");
assert.equal(online.dispatchPerformed, false);

for (let attempt = 1; attempt <= 4; attempt += 1) {
  const retry = markLensNextQueueHeadRetry(online, attempt * 10_000);
  assert.equal(retry.ok, true);
  if (!retry.ok) throw new Error("expected retry metadata update");
  online = retry.state;
  assert.equal(online.items[0].attempts, attempt);
  const again = reconfirmLensNextQueueHead(online, {
    nonce: `reconfirm:nonce:${String(attempt + 1).padStart(4, "0")}`,
    nowMs: attempt * 10_000 + 9000,
    expectedStatus: "open",
    expectedVersion: 7,
    expectedRevisionNumber: 4,
    executorReceiptSha256: receiptSha,
    visualStateDigest: digest,
  });
  assert.equal(again.ok, true);
  if (!again.ok) throw new Error("expected repeated reconfirmation");
  online = again.state;
}
const exhausted = markLensNextQueueHeadRetry(online, 60_000);
assert.equal(exhausted.ok, false);
if (exhausted.ok) throw new Error("expected retry limit");
assert.equal(exhausted.code, "RETRY_LIMIT_REACHED");

const expiredInput = draft(1);
expiredInput.executorBinding.expiresAt = "2026-08-12T00:00:00.000Z";
const expired = enqueueLensNextDraft(
  createLensNextOfflineQueue(),
  expiredInput,
  Date.parse("2026-08-12T12:00:00.000Z"),
);
assert.equal(expired.ok, false);
if (expired.ok) throw new Error("expected expired receipt");
assert.equal(expired.code, "EXECUTOR_RECEIPT_STALE");

assert.deepEqual(LENS_NEXT_OFFLINE_QUEUE_INVARIANTS, {
  maximumItems: 100,
  maximumTotalBytes: 512000,
  maximumItemBytes: 16384,
  maximumAttempts: 4,
  maximumBackoffMs: 8000,
  persistentStorageAllowed: false,
  networkBehavior: false,
  writeEndpointsAllowed: false,
  automaticConflictResolutionAllowed: false,
  dispatchPerformed: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    queued: queue.items.length,
    fifo: true,
    duplicatesAdded: 0,
    overflowBlocked: true,
    mismatchBlocked: true,
    staleBlocked: true,
    reconnectRequiresConfirmation: true,
    retryAttempts: 4,
    persistentStores: 0,
    dispatches: 0,
    io: { network: false, database: false, customer: false, provider: false },
  }),
);
