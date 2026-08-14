import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LensNextOfflineQueueState } from "../../src/features/lens-next/lens-next-offline-queue";
import type { LensNextTimelineState } from "../../src/features/lens-next/lens-next-activity-timeline";
import {
  LENS_NEXT_PHASE2_WORKFLOW_SHELL_INVARIANTS,
  LensNextPhase2WorkflowShell,
  type LensNextPhase2WorkflowSection,
  type LensNextPhase2WorkflowShellProps,
} from "../../src/features/lens-next/LensNextPhase2WorkflowShell";

const identity = {
  projectId: 26,
  issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
  serverId: 101,
  viewpointId: "vp-immutable-001",
  revisionNumber: 4,
  modelId: "navis-model-immutable-001",
  modelVersionFingerprint: "a".repeat(64),
};

const timeline = (
  mode: LensNextTimelineState["mode"],
): LensNextTimelineState => ({
  mode,
  identity: { ...identity, lifecycleStatus: "active" },
  historyVersion: 7,
  visualStateDigest: "b".repeat(64),
  events: [],
  nextCursor: null,
  reason: mode === "blocked" ? "IDENTITY_BLOCKED" : null,
});

const queueItem = {
  draft: {
    actorId: "actor-immutable-001",
    action: "status",
    identity: { projectId: 26, serverId: 101, revisionNumber: 4 },
    idempotencyId: "actor-immutable-001:status:26:101:4:nonce-immutable-001",
  },
  queuedAtMs: 1,
  attempts: 0,
  nextRetryAtMs: null,
  reconfirmedAtMs: null,
  reconfirmationNonce: null,
  fingerprint: "fnv1a32:1234abcd",
  byteLength: 256,
} as LensNextOfflineQueueState["items"][number];

function queue(
  mode:
    | "idle"
    | "queued"
    | "reconnect_confirmation_required"
    | "retry_wait"
    | "blocked"
    | "overflow",
): LensNextOfflineQueueState {
  if (mode === "idle")
    return {
      mode: "idle",
      connectivity: "offline",
      items: [],
      totalBytes: 0,
      reason: null,
      persistentStorageAllowed: false,
      dispatchPerformed: false,
    };
  if (mode === "blocked" || mode === "overflow")
    return {
      mode: "blocked",
      connectivity: "offline",
      items: [],
      totalBytes: 0,
      reason: mode === "overflow" ? "QUEUE_CAPACITY_EXCEEDED" : "DRAFT_STALE",
      persistentStorageAllowed: false,
      dispatchPerformed: false,
    };
  return {
    mode: "queued",
    connectivity:
      mode === "reconnect_confirmation_required" ? "online" : "offline",
    items: [
      mode === "retry_wait"
        ? { ...queueItem, nextRetryAtMs: 2_000 }
        : queueItem,
    ],
    totalBytes: 256,
    reason: null,
    persistentStorageAllowed: false,
    dispatchPerformed: false,
  };
}

const baseProps: Omit<
  LensNextPhase2WorkflowShellProps,
  "locale" | "activeSection"
> = {
  onSectionChange: () => undefined,
  identity,
  connection: {
    state: "connected",
    identity: { ...identity, lifecycleStatus: "active" },
    modelId: identity.modelId,
    modelVersionFingerprint: identity.modelVersionFingerprint,
    version: 7,
    lastAttemptAt: "2026-08-12T20:00:00.000Z",
    lastSuccessAt: "2026-08-12T19:59:55.000Z",
    retryAttempt: 0,
    retryDelayMs: null,
    reason: "NONE",
    onRequestRefresh: () => undefined,
  },
  workflow: { state: "saved" },
  draft: {
    action: "status",
    viewState: "invalid",
    identity,
    preconditions: {
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
    },
    capability: {
      contractReady: true,
      dispatchAllowed: false,
      mutationAllowed: false,
      serverExecutorBound: false,
    },
  },
  activity: { state: timeline("empty") },
  queue: { state: queue("idle"), nowMs: 1_000 },
  conflict: {
    kind: "stale_identity",
    expected: {
      identity: { ...identity, lifecycleStatus: "active" },
      status: "open",
      version: 7,
      visualStateDigest: "b".repeat(64),
      executorReceiptSha256: "c".repeat(64),
      executorReceiptExpiresAt: "2026-08-13T00:00:00.000Z",
      queueFingerprint: "fnv1a32:1234abcd",
    },
    current: {
      identity: { ...identity, lifecycleStatus: "active", revisionNumber: 5 },
      status: "follow_up",
      version: 8,
      visualStateDigest: "d".repeat(64),
      executorReceiptSha256: "c".repeat(64),
      executorReceiptExpiresAt: "2026-08-13T00:00:00.000Z",
      queueFingerprint: "fnv1a32:1234abcd",
    },
    onRequestRefresh: () => undefined,
    onDiscardDraft: () => undefined,
  },
};

const sections: LensNextPhase2WorkflowSection[] = [
  "connection",
  "workflow",
  "draft",
  "activity",
  "queue",
  "conflict",
];

function render(
  locale: "en" | "es",
  activeSection: LensNextPhase2WorkflowSection,
  overrides: Partial<typeof baseProps> = {},
) {
  return renderToStaticMarkup(
    <LensNextPhase2WorkflowShell
      {...baseProps}
      {...overrides}
      locale={locale}
      activeSection={activeSection}
    />,
  );
}

let renders = 0;
for (const locale of ["en", "es"] as const) {
  for (const section of sections) {
    const markup = render(locale, section);
    renders += 1;
    assert.match(markup, /data-lens-next-phase2-shell="true"/);
    assert.match(markup, new RegExp(`data-active-section="${section}"`));
    assert.match(markup, new RegExp(`data-phase2-section="${section}"`));
    assert.match(markup, /role="tablist"/);
    assert.equal((markup.match(/role="tab"/g) ?? []).length, 6);
    assert.equal((markup.match(/aria-selected="true"/g) ?? []).length, 1);
    assert.match(markup, /role="tabpanel"/);
    assert.match(markup, /123e4567-e89b-42d3-a456-426614174000/);
    assert.match(markup, /navis-model-immutable-001/);
    assert.match(markup, /100/);
    assert.match(markup, /500/);
    assert.match(markup, /mobile-280px-tab-wrap/);
    assert.doesNotMatch(
      markup,
      /session-token-secret|localStorage|sessionStorage|indexedDB|serviceWorker/,
    );
  }
}

const telemetryStates = [
  "connected",
  "refreshing",
  "saved",
  "offline_retry",
  "conflict_blocked",
  "action_blocked",
] as const;
for (const state of telemetryStates) {
  const markup = render("en", "connection", {
    connection: { ...baseProps.connection, state },
  });
  assert.match(markup, new RegExp(`data-connection-state="${state}"`));
  renders += 1;
}

const workflowStates = [
  "saving",
  "saved",
  "offline",
  "refreshing",
  "conflict",
  "action_blocked",
] as const;
for (const state of workflowStates) {
  assert.match(
    render("es", "workflow", { workflow: { state } }),
    new RegExp(`data-lens-next-workflow-state="${state}"`),
  );
  renders += 1;
}

const draftStates = [
  "valid",
  "invalid",
  "confirmation_required",
  "executor_unbound",
  "offline",
  "conflict",
] as const;
for (const viewState of draftStates) {
  assert.match(
    render("en", "draft", {
      draft: { ...baseProps.draft, viewState },
    }),
    new RegExp(`data-draft-view-state="${viewState}"`),
  );
  renders += 1;
}

const activityStates = [
  "loading",
  "empty",
  "ready",
  "offline",
  "error",
  "blocked",
] as const;
for (const state of activityStates) {
  const markup = render("es", "activity", {
    activity: {
      state: timeline(state === "loading" ? "empty" : state),
      loading: state === "loading",
    },
  });
  if (state === "ready") assert.match(markup, /<ol/);
  else assert.match(markup, new RegExp(`data-timeline-state="${state}"`));
  renders += 1;
}

const queueStates = [
  "idle",
  "queued",
  "reconnect_confirmation_required",
  "retry_wait",
  "blocked",
  "overflow",
] as const;
for (const state of queueStates) {
  assert.match(
    render("en", "queue", {
      queue: { state: queue(state), nowMs: 1_000 },
    }),
    new RegExp(`data-queue-view-mode="${state}"`),
  );
  renders += 1;
}

const conflictStates = [
  "stale_identity",
  "divergent_revision_version",
  "receipt_expired",
  "offline_queue_mismatch",
  "visual_digest_mismatch",
] as const;
for (const kind of conflictStates) {
  assert.match(
    render("es", "conflict", {
      conflict: { ...baseProps.conflict, kind },
    }),
    new RegExp(`data-conflict-kind="${kind}"`),
  );
  renders += 1;
}

assert.deepEqual(LENS_NEXT_PHASE2_WORKFLOW_SHELL_INVARIANTS, {
  sections,
  minimumWidthPx: 280,
  maximumQueuedDrafts: 100,
  maximumActivityEvents: 500,
  tokenDisplayAllowed: false,
  nativeBridgeBehavior: false,
  networkBehavior: false,
  storageBehavior: false,
  writeBehavior: false,
  automaticConflictResolutionAllowed: false,
  visualMutationAllowed: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    sections: sections.length,
    locales: 2,
    renders,
    telemetryStates: telemetryStates.length,
    workflowStates: workflowStates.length,
    draftStates: draftStates.length,
    activityStates: activityStates.length,
    queueStates: queueStates.length,
    conflictStates: conflictStates.length,
    maximumQueuedDrafts: 100,
    maximumActivityEvents: 500,
    networkBehavior: false,
    storageBehavior: false,
    writeBehavior: false,
    visualMutationAllowed: false,
  }),
);
