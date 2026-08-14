import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LENS_NEXT_OFFLINE_QUEUE_VIEW_INVARIANTS,
  LensNextOfflineQueueView,
} from "../../src/features/lens-next/LensNextOfflineQueueView";
import type { LensNextOfflineQueueState } from "../../src/features/lens-next/lens-next-offline-queue";

const actorId = "123e4567-e89b-42d3-a456-426614174000";
const familyId = "223e4567-e89b-42d3-a456-426614174000";
const digest = "a".repeat(64);

function state(count: number): LensNextOfflineQueueState {
  const items = Array.from({ length: count }, (_, index) => ({
    draft: {
      contractVersion: "lens-next-phase2-mutation-draft.v1" as const,
      action: "comment" as const,
      actorId,
      idempotencyId: `${actorId}:comment:26:101:4:nonce:${String(index).padStart(4, "0")}`,
      identity: {
        projectId: 26,
        issueFamilyId: familyId,
        serverId: 101,
        viewpointId: "vp-immutable-001",
        lifecycleStatus: "active" as const,
        revisionNumber: 4,
      },
      preconditions: {
        issueFamilyId: familyId,
        expectedStatus: "open" as const,
        expectedVersion: 7,
        expectedRevisionNumber: 4,
      },
      payload: { body: `Draft ${index + 1}` },
      confirmationReason: null,
      visualStateDigest: digest,
    },
    executorBinding: {
      receiptId: "executor:comment:receipt-001",
      receiptSha256: "b".repeat(64),
      action: "comment" as const,
      actorId,
      projectId: 26,
      serverId: 101,
      revisionNumber: 4,
      current: true as const,
      expiresAt: "2026-08-13T00:00:00.000Z",
    },
    queuedAtMs: 1000 + index,
    attempts: 0,
    nextRetryAtMs: null,
    reconfirmedAtMs: null,
    reconfirmationNonce: null,
    fingerprint: `fnv1a32:${String(index).padStart(8, "0")}`,
    byteLength: 900,
  }));
  return {
    mode: items.length ? "queued" : "idle",
    connectivity: "offline",
    items,
    totalBytes: items.length * 900,
    reason: null,
    persistentStorageAllowed: false,
    dispatchPerformed: false,
  };
}

const idle = renderToStaticMarkup(
  <LensNextOfflineQueueView state={state(0)} nowMs={2000} />,
);
assert.match(idle, /data-queue-view-mode="idle"/);
assert.match(idle, /No request drafts are queued/);
assert.doesNotMatch(idle, /<button/);

const queuedState = state(100);
const queued = renderToStaticMarkup(
  <LensNextOfflineQueueView state={queuedState} nowMs={2000} />,
);
assert.match(queued, /data-queue-view-mode="queued"/);
assert.equal((queued.match(/<li/g) ?? []).length, 100);
assert.equal((queued.match(/<button/g) ?? []).length, 100);
assert.equal((queued.match(/type="button"/g) ?? []).length, 100);
assert.match(queued, /123e4567-e89b-42d3-a456-426614174000:comment:26:101:4/);
assert.match(queued, /data-render-limit="100"/);
assert.match(queued, /mobile-280px-single-column/);

const onlineState = { ...state(2), connectivity: "online" as const };
const reconnect = renderToStaticMarkup(
  <LensNextOfflineQueueView
    state={onlineState}
    locale="es"
    nowMs={2000}
    onReconfirm={() => undefined}
    onDiscard={() => undefined}
  />,
);
assert.match(
  reconnect,
  /data-queue-view-mode="reconnect_confirmation_required"/,
);
assert.match(reconnect, /Se recuperó la conexión/);
assert.equal((reconnect.match(/Volver a confirmar borrador/g) ?? []).length, 1);
assert.equal((reconnect.match(/Descartar borrador/g) ?? []).length, 2);
assert.doesNotMatch(reconnect, /onclick=/i);

const retryState = state(1);
retryState.items = [
  { ...retryState.items[0], attempts: 2, nextRetryAtMs: 5000 },
];
const retry = renderToStaticMarkup(
  <LensNextOfflineQueueView state={retryState} nowMs={2000} />,
);
assert.match(retry, /data-queue-view-mode="retry_wait"/);
assert.match(retry, /bounded retry window/);

const blockedState = {
  ...state(1),
  mode: "blocked" as const,
  reason: "DRAFT_STALE",
};
const blocked = renderToStaticMarkup(
  <LensNextOfflineQueueView state={blockedState} nowMs={2000} />,
);
assert.match(blocked, /data-queue-view-mode="blocked"/);
assert.match(blocked, /role="alert"/);

const overflowState = {
  ...state(100),
  mode: "blocked" as const,
  reason: "QUEUE_CAPACITY_EXCEEDED",
};
const overflow = renderToStaticMarkup(
  <LensNextOfflineQueueView state={overflowState} nowMs={2000} />,
);
assert.match(overflow, /data-queue-view-mode="overflow"/);
assert.match(overflow, /Queue capacity was reached/);
assert.match(overflow, /aria-live="assertive"/);

for (const markup of [idle, queued, reconnect, retry, blocked, overflow]) {
  assert.match(markup, /Nothing is sent|Esta vista no envía nada/);
  assert.doesNotMatch(markup, /<a\b/);
  assert.doesNotMatch(
    markup,
    /localStorage|sessionStorage|indexedDB|serviceWorker/,
  );
}

assert.deepEqual(LENS_NEXT_OFFLINE_QUEUE_VIEW_INVARIANTS, {
  maximumRenderedItems: 100,
  minimumWidthPx: 280,
  dispatchBehavior: false,
  networkBehavior: false,
  storageBehavior: false,
  serviceWorkerBehavior: false,
  automaticConflictResolution: false,
  visualStateMutation: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    modes: 6,
    locales: 2,
    renderedItems: 100,
    reconfirmButtons: 1,
    discardButtons: 100,
    dispatchBehavior: false,
    networkBehavior: false,
    storageBehavior: false,
    automaticConflictResolution: false,
    visualStateMutation: false,
  }),
);
