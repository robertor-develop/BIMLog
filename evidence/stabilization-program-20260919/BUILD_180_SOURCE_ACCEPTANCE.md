# Build 180 source acceptance

Date: 2026-09-21

## Scope

Builds 176–180 complete post-120 Block 36, the Submittals decomposition and publication block.

- Build 176 separates normalized search/status/type state, filtering, counts, and deep-link resolution from the routed page.
- Build 177 centralizes editor initialization plus update/review request construction, removing duplicated form-state mapping.
- Build 178 binds current-view exports and item history/report actions to explicit project and visible-submittal identity scopes.
- Build 179 rejects stale edits and reviews with HTTP 409, preserves project identity in mutations, localizes structured upload errors, and verifies storage compensation after failed attachment persistence.
- Build 180 binds the focused regression into the complete pre-push gate and reaches the ten-build publication boundary.

## Acceptance

- Focused Block 36 regression: `POST120_BLOCK36=PASS`.
- Frontend and API strict typechecks: PASS.
- Complete exact-head pre-push gate: required before push.
- Replit publication and authenticated visible-Chrome lifecycle smoke: required after push.

## Boundaries

- No database/schema, customer data, Native source, installer, package, bridge protocol, or provider configuration changes are included.
- Existing submittal clients must provide the record's `updatedAt` value for editor, attachment, and review mutations; stale or missing versions fail closed instead of overwriting newer work.
- Native and installers are unchanged, so focused Navisworks smoke is not retriggered.

## Next block

Builds 181–185 generate and reconcile the route/interconnection ownership graph. They start only after Build 180 is published and the authenticated production smoke passes.
