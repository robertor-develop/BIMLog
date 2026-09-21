# Build 175 source acceptance

Date: 2026-09-21

## Scope

Builds 171–175 complete post-120 Block 35, the Job Intake workspace decomposition block.

- Build 171 moves the canonical blank schema, stages, setup mode, active section, and browser-recovery contracts out of the 2,900-line workspace.
- Build 172 centralizes upload revision binding, spreadsheet mapping defaults, normalized mapping requests, and document-assistance classification.
- Build 173 makes the zero-credit deterministic spreadsheet path and manual-only PDF/Word boundary visible, and fail-closes any future AI operation unless funding, estimate, and confirmation are all visible.
- Build 174 permanently tests partial recovery, equal/stale revision handling, upload-failure preservation, denial/error state retention, deterministic mapping, and the AI cost gate.
- Build 175 binds Block 35 into the complete pre-push gate and pushes the exact accepted source.

## Acceptance

- Focused Block 35 regression: `POST120_BLOCK35=PASS`.
- Frontend strict typecheck: PASS.
- Complete exact-head pre-push gate: required before push.

## Boundaries

- No database/schema, customer data, provider configuration, Native source, installer, package, or bridge protocol changes are included.
- Deterministic spreadsheet inspection continues to use zero AI credits. PDF/Word remain manual-review evidence; no AI provider call was added.
- Native and installers are unchanged, so focused Navisworks smoke is not retriggered.
- This is a push-only five-build boundary. Publication and authenticated visible-Chrome smoke remain scheduled after Build 180, within the ten-build ceiling.

## Next block

Builds 176–180 decompose Submittals and end at the next push/publication/authenticated-smoke boundary.
