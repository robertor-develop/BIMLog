import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LENS_NEXT_CONFLICT_REVIEW_VIEW_INVARIANTS,
  LensNextConflictReviewView,
  type LensNextConflictReviewKind,
  type LensNextConflictSnapshot,
} from "../../src/features/lens-next/LensNextConflictReviewView";

const kinds: LensNextConflictReviewKind[] = [
  "stale_identity",
  "divergent_revision_version",
  "receipt_expired",
  "offline_queue_mismatch",
  "visual_digest_mismatch",
];

const snapshot = (revisionNumber: number): LensNextConflictSnapshot => ({
  identity: {
    projectId: 26,
    issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
    serverId: 101,
    viewpointId: "vp-immutable-001",
    lifecycleStatus: "active",
    revisionNumber,
  },
  status: revisionNumber === 4 ? "open" : "follow_up",
  version: revisionNumber === 4 ? 7 : 8,
  visualStateDigest: (revisionNumber === 4 ? "a" : "b").repeat(64),
  executorReceiptSha256: "c".repeat(64),
  executorReceiptExpiresAt: "2026-08-13T00:00:00.000Z",
  queueFingerprint: "fnv1a32:1234abcd",
});

let renders = 0;
for (const locale of ["en", "es"] as const) {
  for (const kind of kinds) {
    const markup = renderToStaticMarkup(
      <LensNextConflictReviewView
        locale={locale}
        kind={kind}
        expected={snapshot(4)}
        current={snapshot(5)}
        onRequestRefresh={() => undefined}
        onDiscardDraft={() => undefined}
      />,
    );
    renders += 1;
    assert.match(markup, new RegExp(`data-conflict-kind="${kind}"`));
    assert.match(markup, /role="alert"/);
    assert.match(markup, /aria-live="assertive"/);
    assert.match(markup, /<dl>/);
    assert.match(markup, /123e4567-e89b-42d3-a456-426614174000/);
    assert.match(markup, /vp-immutable-001/);
    assert.match(markup, /a{64}/);
    assert.match(markup, /b{64}/);
    assert.match(markup, /type="button"/);
    assert.equal((markup.match(/<button/g) ?? []).length, 2);
    assert.equal((markup.match(/<svg/g) ?? []).length >= 3, true);
    assert.match(markup, /mobile-280px-single-column/);
    assert.doesNotMatch(markup, /<a\b|<input\b|<form\b/);
    assert.doesNotMatch(markup, /onClick|onclick|localStorage|indexedDB/);
    if (locale === "en") {
      assert.match(markup, /Request a read-only refresh/);
      assert.match(markup, /Discard local draft/);
      assert.match(markup, /No visual state is changed/);
    } else {
      assert.match(markup, /Solicitar actualización de solo lectura/);
      assert.match(markup, /Descartar borrador local/);
      assert.match(markup, /No se cambia el estado visual/);
    }
  }
}

const boundedMarkup = renderToStaticMarkup(
  <LensNextConflictReviewView
    locale="en"
    kind="stale_identity"
    expected={{ ...snapshot(4), status: "x".repeat(500) }}
    current={snapshot(5)}
    onRequestRefresh={() => undefined}
    onDiscardDraft={() => undefined}
  />,
);
assert.doesNotMatch(boundedMarkup, new RegExp(`x{65}`));
assert.match(boundedMarkup, new RegExp(`x{63}…`));

assert.deepEqual(LENS_NEXT_CONFLICT_REVIEW_VIEW_INVARIANTS, {
  minimumWidthPx: 280,
  maximumBoundValueCharacters: 160,
  automaticResolutionAllowed: false,
  acceptMergeOverwriteControlsAllowed: false,
  sendBehavior: false,
  networkBehavior: false,
  storageBehavior: false,
  writeBehavior: false,
  visualMutationAllowed: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    kinds: kinds.length,
    locales: 2,
    renders,
    nativeButtons: 2,
    boundedValues: true,
    automaticResolutionAllowed: false,
    sendBehavior: false,
    networkBehavior: false,
    storageBehavior: false,
    writeBehavior: false,
    visualMutationAllowed: false,
  }),
);
