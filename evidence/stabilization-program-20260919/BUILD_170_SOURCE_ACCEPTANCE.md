# Build 170 source acceptance

Date: 2026-09-21

## Scope

Builds 166–170 complete post-120 Block 34, the meeting-minutes backend block.

- Build 166 separates bounded command, current-view query, and report presentation contracts from the route.
- Build 167 centralizes participant and action-assignee identity normalization and rejects duplicate participant identities.
- Build 168 makes the live register, action list, PDF, native XLSX, and activity history consume one project-scoped filter contract.
- Build 169 serializes retried create commands with a durable activity receipt and advisory lock, reuses the browser idempotency key across retries, and makes update version checks atomic.
- Build 170 binds the permanent Block 34 regression into the complete pre-push gate, pushes the exact head, publishes through the established Replit Shell route, and performs authenticated meeting lifecycle acceptance.

## Acceptance

- Focused Block 34 regressions: `POST120_BUILD166=PASS`, `POST120_BUILD167=PASS`, `POST120_BUILD168=PASS`, and `POST120_BUILD169=PASS`.
- API and frontend strict typechecks: PASS.
- Complete exact-head pre-push gate: required before push.
- Publication database correspondence and provider preview: required before promotion.
- Authenticated visible-Chrome acceptance: create, edit, stale-write denial, list, PDF, XLSX, reload, and activity history.

## Boundaries

- No schema, migration, Native source, installer, package, bridge protocol, or customer-data copy is included.
- Native and installers are unchanged, so focused Navisworks smoke is not retriggered.
- This is the ten-build publication boundary covering Builds 161–170. Provider and live receipts remain external to the immutable source candidate.

## Next block

Builds 171–175 decompose the job-intake workspace and end at the next push-only boundary.
