# EDT Engine Block 8 — Builds 311–315

Five bounded commits:

- 311 `a7563adec87c6e42ef7be42dac3d460a8c73da1a`: approved activation retries require a matching immutable decision.
- 312 `22a9f7ec11e5a50552b6ac15a81f1c2f368c568f`: ordered acyclic EDT hierarchy with unique sibling sequence validation.
- 313 `aeafd6e97955fc3bbf2472f75749b91220af8315`: reject duplicate and incomplete Work Item plans before mutation.
- 314 `647f82a8630bd9be911c0911b36a48f8b4cd6450`: economic plan verifies activated Intake, contract currency and per-contract APU binding.
- 315 `909604f45caa0dd9b376e3c0ba3e782e339213d4`: time decisions must match the stored submitted ledger commitment.

Focused Block 8 checks and API TypeScript typecheck passed. An older Build 293 fixture was corrected to reflect the same-Intake account check added in Build 309; the Block 4 suite then passed. Full release gate, push, publication and live smoke are separately receipted when completed.

Scope: backend integrity only. Four EDT mutation routes remain fail-closed. No Lens Next Native or installer changes. No production database action occurred in the five build commits.

Post-publication acceptance defect: the authenticated Project Budget “Back to project” link resolved to `/projects/:id/dashboard`, a 404 because the Project Detail landing tab is `analytics`. A separate release hotfix updates the Budget, Intake and shared shell links to `/analytics` and retains a compatibility alias for old `/dashboard` links. The project-route regression and frontend typecheck pass; final gate, republish and live recheck must complete before Block 8 is accepted.
