import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LENS_NEXT_ACTION_DRAFT_VIEW_INVARIANTS,
  LensNextActionDraftView,
  type LensNextActionDraftViewProps,
  type LensNextActionDraftViewState,
} from "../../src/features/lens-next/LensNextActionDraftView";

const identity = {
  projectId: 26,
  issueFamilyId: "123e4567-e89b-42d3-a456-426614174000",
  serverId: 101,
  viewpointId: "vp-immutable-001",
  revisionNumber: 4,
};
const base = {
  identity,
  preconditions: {
    expectedStatus: "open" as const,
    expectedVersion: 7,
    expectedRevisionNumber: 4,
  },
  capability: {
    contractReady: true,
    dispatchAllowed: true,
    mutationAllowed: false as const,
    serverExecutorBound: true,
  },
  decision: {
    ok: true as const,
    status: "REQUEST_DRAFT_ONLY" as const,
    dispatchPerformed: false as const,
    productionWriteAllowed: false as const,
    authorityGranted: false as const,
    mutationAllowed: false as const,
    draft: {
      contractVersion: "lens-next-phase2-mutation-draft.v1" as const,
      action: "status" as const,
      actorId: "223e4567-e89b-42d3-a456-426614174000",
      idempotencyId: "actor:status:26:101:4:nonce",
      identity: { ...identity, lifecycleStatus: "active" as const },
      preconditions: {
        expectedStatus: "open" as const,
        expectedVersion: 7,
        expectedRevisionNumber: 4,
        issueFamilyId: identity.issueFamilyId,
      },
      payload: { nextStatus: "resolved" as const },
      confirmationReason: "Confirmed",
      visualStateDigest: "a".repeat(64),
    },
  },
};

for (const action of ["status", "comment", "assignment"] as const) {
  const props: LensNextActionDraftViewProps = {
    ...base,
    action,
    viewState: "valid",
    commentValue: "Coordination review complete.",
    reasonValue: "Confirmed coordination action.",
    assignmentOptions: Array.from({ length: 120 }, (_, index) => ({
      id: `user-${index}`,
      label: `User ${index}`,
    })),
    companyOptions: Array.from({ length: 120 }, (_, index) => ({
      id: `company-${index}`,
      label: `Company ${index}`,
    })),
    onCreateDraft: () => undefined,
    onConfirmDraft: () => undefined,
    onCancelDraft: () => undefined,
  };
  const markup = renderToStaticMarkup(<LensNextActionDraftView {...props} />);
  assert.match(markup, new RegExp(`data-draft-action="${action}"`));
  assert.match(markup, /<fieldset/);
  assert.match(markup, /<legend/);
  assert.equal((markup.match(/<button/g) ?? []).length, 3);
  assert.equal((markup.match(/type="button"/g) ?? []).length, 3);
  assert.match(markup, /Authority granted: False/);
  assert.match(markup, /Production write allowed: False/);
  assert.match(markup, /UI mutation authority: False/);
  assert.match(markup, /123e4567-e89b-42d3-a456-426614174000/);
  assert.match(markup, /open:7:4/);
  assert.match(markup, /mobile-280px-single-column/);
  assert.doesNotMatch(markup, /onclick=/i);
}

const states: LensNextActionDraftViewState[] = [
  "valid",
  "invalid",
  "confirmation_required",
  "executor_unbound",
  "offline",
  "conflict",
];
for (const viewState of states) {
  const english = renderToStaticMarkup(
    <LensNextActionDraftView {...base} action="status" viewState={viewState} />,
  );
  const spanish = renderToStaticMarkup(
    <LensNextActionDraftView
      {...base}
      action="status"
      viewState={viewState}
      locale="es"
    />,
  );
  assert.match(english, new RegExp(`data-draft-view-state="${viewState}"`));
  assert.match(english, /never sends a request/);
  assert.match(spanish, /Nunca envía una solicitud/);
  assert.match(english, /aria-live="(polite|assertive)"/);
  assert.doesNotMatch(english, /<a\b/);
}

const comment = renderToStaticMarkup(
  <LensNextActionDraftView
    {...base}
    action="comment"
    viewState="confirmation_required"
    commentValue="Draft"
  />,
);
assert.match(comment, /maxLength="4000"/);
const assignment = renderToStaticMarkup(
  <LensNextActionDraftView
    {...base}
    action="assignment"
    viewState="valid"
    reasonValue="Confirmed"
  />,
);
assert.match(assignment, /maxLength="500"/);
assert.match(assignment, /required=""/);

assert.deepEqual(LENS_NEXT_ACTION_DRAFT_VIEW_INVARIANTS, {
  maximumCommentCharacters: 4000,
  maximumReasonCharacters: 500,
  maximumAssignmentOptions: 100,
  minimumWidthPx: 280,
  dispatchBehavior: false,
  networkBehavior: false,
  storageBehavior: false,
  writeBehavior: false,
  authorityGranted: false,
  productionWriteAllowed: false,
  mutationAllowed: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    actions: 3,
    states: states.length,
    locales: 2,
    nativeControls: true,
    maximumOptions: 100,
    dispatchBehavior: false,
    networkBehavior: false,
    storageBehavior: false,
    writeBehavior: false,
    authorityGranted: false,
    productionWriteAllowed: false,
    mutationAllowed: false,
  }),
);
