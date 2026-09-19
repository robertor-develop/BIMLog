# Build 040 - Authenticated browser release gate

Date: 2026-09-19  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `e178670d`  
Result: `PASS_LOCAL_RELEASE_GATE_PENDING_PUBLICATION`

## Objective

Make exact live identity, deployed session assets, canonical Super Administrator authority, scoped-user denial, reload restoration, stale-response protection, and two-tab continuity mandatory evidence for every authenticated release acceptance.

## Changes

- Added a machine-validated external authenticated-release receipt contract.
- Acceptance fails on stale release identity, unbound live identity, package/served asset mismatch, wrong roles, excessive scoped-user authority, broken reload/two-tab continuity, stale-response overwrite, hidden-browser substitution, or browser errors.
- Advanced Platform release identity to `v1.05.N18-P34`; Native remains `N18`, while package manifests and installers now bind the exact P34 release identity.
- Provider receipt and live Chrome evidence remain external so they cannot mutate the exact deployed source candidate.
- No schema or customer-data mutation is required.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Acceptance contract self-test | PASS | `pnpm run test:authenticated-release-acceptance` |
| Block 08 focused regressions | PASS | Builds 036-040 focused suites |
| Navisworks 2021 package smoke | PASS | Core `132/132`; Native `57/57`; package-only installer PASS; ZIP SHA-256 `3247637445C3EF25773AB2900BB729EBE0B972E4B29FD386B2F452DC98A66E5A` |
| Navisworks 2025 package smoke | PASS | Core `132/132`; Native `57/57`; package-only installer PASS; ZIP SHA-256 `9822C0E2F3E923ABA4A114F2B7666465EA87C62A44E8CA09F5BA99EA13FEA456` |
| Full clean local release gate | PENDING final clean committed head | External receipt required before push |
| Push/publication/live Chrome | PENDING | Per cadence, performed after exact-head local gate |

## Position

- Completed builds: `40 of 120` after exact-head gate and publication acceptance
- Remaining builds: `80`
- Unpublished builds: `10 of maximum 10` until this milestone publishes
- Next build after successful publication: `041 - global UX shell`
- Next push: `Build 045`
- Next publication and authenticated Chrome smoke: `Build 050`
- Focused Navisworks smoke required: `YES - release identity and package metadata changed; package-only 2021/2025 smoke, no installation`
- Blocker: `NONE`
