import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LENS_NEXT_WORKFLOW_BANNER_INVARIANTS,
  LensNextWorkflowStateBanner,
  type LensNextWorkflowBannerState,
} from "../../src/features/lens-next/LensNextWorkflowStateBanner";

const states: LensNextWorkflowBannerState[] = [
  "saving",
  "saved",
  "offline",
  "refreshing",
  "conflict",
  "action_blocked",
];

const expectedEnglish = [
  "Saving",
  "Saved",
  "Offline",
  "Refreshing",
  "Conflict detected",
  "Action blocked for safety",
];
const expectedSpanish = [
  "Guardando",
  "Guardado",
  "Sin conexión",
  "Actualizando",
  "Conflicto detectado",
  "Acción bloqueada por seguridad",
];

let renderedStates = 0;
for (const [index, state] of states.entries()) {
  const english = renderToStaticMarkup(
    <LensNextWorkflowStateBanner state={state} />,
  );
  const spanish = renderToStaticMarkup(
    <LensNextWorkflowStateBanner state={state} locale="es" />,
  );
  assert.match(english, new RegExp(`data-lens-next-workflow-state="${state}"`));
  assert.ok(english.includes(expectedEnglish[index]));
  assert.ok(spanish.includes(expectedSpanish[index]));
  assert.match(english, /aria-live="(polite|assertive)"/);
  assert.match(english, /aria-atomic="true"/);
  assert.match(english, /data-responsive-contract="narrow-280px-wrap"/);
  assert.doesNotMatch(english, /<svg[^>]*aria-label=/);
  assert.doesNotMatch(english, /<a\b/);
  renderedStates += 1;
}

for (const state of ["conflict", "action_blocked"] as const) {
  const markup = renderToStaticMarkup(
    <LensNextWorkflowStateBanner state={state} retryAvailable />,
  );
  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-live="assertive"/);
  assert.match(markup, /Nothing was resolved automatically|without changing/);
}

const actions = renderToStaticMarkup(
  <LensNextWorkflowStateBanner
    state="offline"
    locale="es"
    retryAvailable
    cancelAvailable
    onRetry={() => undefined}
    onCancel={() => undefined}
  />,
);
assert.equal((actions.match(/<button/g) ?? []).length, 2);
assert.equal((actions.match(/type="button"/g) ?? []).length, 2);
assert.ok(actions.includes("Reintentar"));
assert.ok(actions.includes("Cancelar"));
assert.doesNotMatch(actions, /onclick=/i);

const detail = renderToStaticMarkup(
  <LensNextWorkflowStateBanner
    state="action_blocked"
    detail="Exact immutable identity could not be confirmed."
  />,
);
assert.ok(detail.includes("Exact immutable identity could not be confirmed."));

assert.deepEqual(LENS_NEXT_WORKFLOW_BANNER_INVARIANTS, {
  minimumSupportedWidthPx: 280,
  networkBehavior: false,
  storageBehavior: false,
  writeBehavior: false,
  automaticConflictResolution: false,
  visualStateMutation: false,
});

console.log(
  JSON.stringify({
    result: "PASS",
    renderedStates,
    locales: 2,
    urgentAlerts: 2,
    nativeButtons: 2,
    minimumWidthPx: 280,
    networkBehavior: false,
    storageBehavior: false,
    writeBehavior: false,
    automaticConflictResolution: false,
    visualStateMutation: false,
  }),
);
