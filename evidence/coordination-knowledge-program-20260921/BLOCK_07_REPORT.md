# Coordination Knowledge Library — Block 7 source acceptance

Date: 2026-09-22  
Builds: 256–260  
Boundary: push-only; publication is due at Build 265

## Accepted scope

- Build 256: additive Resolution Record identity and immutable revision contract; canonical company/project/Lens issue binding; approved-method validation; draft and completion persistence; optimistic concurrency and audit events.
- Build 257: before/after/supporting project-file evidence with exact resolution-revision binding, structured metadata, model/view references, company/project/file isolation, and immutable custody.
- Build 258: Lens Next Resolution tab with method selection, actual outcome, trade/discipline, RFI and drawing/submittal references, draft save, guarded completion, refresh restoration, and immutable history.
- Build 259: independent verification, resolver/verifier separation, server-authored actor/date truth, reason-required reopening, retained prior revisions/evidence, and permission-aware UI actions.
- Build 260: direct-completion recovery, bounded evidence metadata, project-attachment evidence linking, previous-block regression repair, consolidated Block 7 gate, and Living Brief reconciliation.

## Safety boundaries

- The migration is additive and idempotent. It contains no DROP, TRUNCATE, destructive rename, replacement, or customer-row rewrite.
- The canonical issue remains `lens_viewpoints`; the Resolution Record is an outcome/history object and never becomes a second issue authority.
- No Native, bridge protocol, camera, installer, package, Autodesk load path, or Navisworks-facing code changed. Focused Navisworks smoke is therefore not applicable.
- Production publication, schema execution, and authenticated live Chrome acceptance are not performed at this push-only boundary; they remain due at Build 265.

## Verification

- `pnpm run test:coordination-knowledge-block7`: PASS.
- `pnpm run test:coordination-knowledge-block6`: PASS after updating its exact tab-order assertion for the new Resolution tab.
- API TypeScript: PASS.
- BIMLog web TypeScript: PASS.
- Complete clean pre-push gate and exact remote push are recorded by the terminal Build 260 execution, not pre-claimed here.
