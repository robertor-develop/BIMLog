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
- The first P34 provider promotion (`443e0a80`) exposed an actual release defect: the live health contract reported `sourceCommit=unbound`, `packageId=unbound`, and `identityBound=false`. The failed candidate remains evidence and was not accepted.
- Corrective Build 040 metadata now embeds the exact Git source, a SHA-256 inventory of tracked client/API-contract assets, a deterministic package identifier, and a SHA-256-derived database migration contract into the built artifact. Runtime variables cannot override those immutable values.
- The acceptance validator now compares the live source commit and asset-manifest digest exactly with the reviewed candidate and requires concrete package/database identities; a bare `identityBound=true` is insufficient.
- No schema or customer-data mutation is required.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Acceptance contract self-test | PASS | `pnpm run test:authenticated-release-acceptance` |
| Immutable metadata focused test | PASS | `pnpm --filter @workspace/api-server run test:release-metadata` |
| Block 08 focused regressions | PASS | Builds 036-040 focused suites |
| Navisworks 2021 package smoke | PASS | Core `132/132`; Native `57/57`; package-only installer PASS; ZIP SHA-256 `3247637445C3EF25773AB2900BB729EBE0B972E4B29FD386B2F452DC98A66E5A` |
| Navisworks 2025 package smoke | PASS | Core `132/132`; Native `57/57`; package-only installer PASS; ZIP SHA-256 `9822C0E2F3E923ABA4A114F2B7666465EA87C62A44E8CA09F5BA99EA13FEA456` |
| First P34 publication | FAIL acceptance | Replit receipt `443e0a80`; live identity unbound |
| Corrective full clean local release gate | PENDING final clean committed head | External receipt required before corrective push |
| Corrective publication/live Chrome | PENDING | Republish and repeat the complete authenticated smoke |

## Position

- Completed builds: `40 of 120` after exact-head gate and publication acceptance
- Remaining builds: `80`
- Unpublished builds: `10 of maximum 10` until this milestone publishes
- Next build after successful publication: `041 - global UX shell`
- Next push: `Build 045`
- Next publication and authenticated Chrome smoke: `Build 050`
- Focused Navisworks smoke required: `YES - release identity and package metadata changed; package-only 2021/2025 smoke, no installation`
- Blocker: `NONE`
