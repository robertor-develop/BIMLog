import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LENS_NEXT_CONNECTION_TELEMETRY_INVARIANTS,
  LensNextConnectionTelemetryView,
  type LensNextConnectionTelemetryState,
  type LensNextTelemetryReason,
} from "../../src/features/lens-next/LensNextConnectionTelemetryView";

const states: LensNextConnectionTelemetryState[] = [
  "connected",
  "refreshing",
  "saved",
  "offline_retry",
  "conflict_blocked",
  "action_blocked",
];

const reason: Record<
  LensNextConnectionTelemetryState,
  LensNextTelemetryReason
> = {
  connected: "NONE",
  refreshing: "NONE",
  saved: "NONE",
  offline_retry: "NETWORK_OFFLINE",
  conflict_blocked: "STALE_REFRESH_RESPONSE",
  action_blocked: "IMMUTABLE_IDENTITY_MISMATCH",
};

let renders = 0;
for (const locale of ["en", "es"] as const) {
  for (const state of states) {
    const markup = renderToStaticMarkup(
      <LensNextConnectionTelemetryView
        locale={locale}
        state={state}
        identity={{
          projectId: 26,
          issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
          serverId: 101,
          viewpointId: "vp-immutable-001",
          lifecycleStatus: "active",
          revisionNumber: 4,
        }}
        modelId="navis-model-immutable-001"
        modelVersionFingerprint={"a".repeat(64)}
        version={7}
        lastAttemptAt="2026-08-12T20:00:00.000Z"
        lastSuccessAt="2026-08-12T19:59:55.000Z"
        retryAttempt={2}
        retryDelayMs={3_000}
        reason={reason[state]}
        onRequestRefresh={() => undefined}
      />,
    );
    renders += 1;
    assert.match(markup, new RegExp(`data-connection-state="${state}"`));
    assert.match(
      markup,
      /data-workflow-state="(saved|refreshing|offline|conflict|action_blocked)"/,
    );
    assert.match(markup, /aria-live="(polite|assertive)"/);
    assert.match(markup, /123e4567-e89b-42d3-a456-426614174000/);
    assert.match(markup, /navis-model-immutable-001/);
    assert.match(markup, /2 \/ 4 \/ 3000 ms/);
    assert.match(markup, /500 (issues|asuntos)/);
    assert.equal((markup.match(/<button/g) ?? []).length, 1);
    assert.match(markup, /type="button"/);
    assert.match(markup, /mobile-280px-single-column/);
    assert.doesNotMatch(markup, /session-token-secret|<input\b|<form\b|<a\b/);
    assert.doesNotMatch(markup, /onClick|onclick|localStorage|indexedDB/);
    if (state === "conflict_blocked" || state === "action_blocked")
      assert.match(markup, /role="alert"/);
    else assert.match(markup, /role="status"/);
    if (state === "refreshing") {
      assert.match(markup, /aria-busy="true"/);
      assert.match(markup, /disabled=""/);
    }
    if (locale === "en") {
      assert.match(markup, /Request read-only refresh/);
      assert.match(markup, /never exposes a session token/);
    } else {
      assert.match(markup, /Solicitar actualización de solo lectura/);
      assert.match(markup, /nunca expone un token de sesión/);
    }
  }
}

assert.deepEqual(LENS_NEXT_CONNECTION_TELEMETRY_INVARIANTS, {
  minimumWidthPx: 280,
  maximumIssues: 500,
  maximumRetries: 4,
  maximumRetryDelayMs: 8_000,
  sessionTokenRendered: false,
  callbackDispatchesNetwork: false,
  mutationAllowed: false,
  actionDraftBehavior: false,
  storageBehavior: false,
  persistenceBehavior: false,
  visualMutationAllowed: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    states: states.length,
    locales: 2,
    renders,
    nativeRefreshButtons: 1,
    maximumIssues: 500,
    sessionTokenRendered: false,
    callbackDispatchesNetwork: false,
    mutationAllowed: false,
    storageBehavior: false,
    visualMutationAllowed: false,
  }),
);
