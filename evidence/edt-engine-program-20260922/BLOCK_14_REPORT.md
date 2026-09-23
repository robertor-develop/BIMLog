# EDT Engine Block 14 — Builds 341–345

## Exact scope and safety boundary

This second five-build block prepares a governed EDT projection request and approval from an **already activated**, saved Intake. It does not reactivate Intake, accept browser-authored EDT nodes, approve financial amounts, transition time entries, or change Lens Next Native/installers. The four public EDT mutation routes remain closed while BIMLog's actual project-role directory lacks an assignable Operations Director role. Mapping Project Administrator, PMO or CEO to that approval without the approved role-governance authority would be a permission escalation. No production database or customer record was changed by the builds.

| Build | Commit | Verified change |
| --- | --- | --- |
| 341 | `dd5d2a87ebae22256896b7eb5c77677879336bbc` | Bind the candidate request fingerprint to the full frozen source, including canonical Contract and Delivery Workflow content identities; changed source invalidates the candidate. |
| 342 | `2d3da351e5cd9c0efae3f31b007f17280741bd41` | Prepare a scoped, idempotent request transaction that reloads the server candidate and accepts only a bounded reason, key and previously observed fingerprint. |
| 343 | `fbafc852d36c8a33b652c9a36dc060a5978c78f0` | Prepare an independent approval transaction that reloads the source, validates saved Work Item coverage, writes nodes and identities atomically and records an immutable decision. |
| 344 | `2927fe59a917508814804598329a3a5ede3de3d2` | Prove positive request/approval/replay and negative stale-source, cross-scope, permission and self-approval behavior through a transaction-host fixture. |
| 345 | `6f7b8ec1632e48c46d4aaf8916948318ee39b004` | Compile the four exact production write statements against the isolated PostgreSQL schema with read-only `EXPLAIN`; run the combined Block 14 gate and API typecheck. |

Focused acceptance: `pnpm run test:edt-engine-block14` passed using `bimlog_rfi_test` on loopback. API TypeScript typecheck passed. The Build 345 SQL test plans writes but never executes them; the Build 344 transaction host is synthetic and cannot be represented as a real database approval.

## Release and live regression receipt — 2026-09-23

- Full local `pnpm run gate:pre-push` passed at source `e3a8626014260da5dd485e6cfb25ebd6187f0a6c`, including production-artifact closure, secret exposure, database-source safety, Living Brief integrity and all workspace builds. The first gate attempt found a generated Living Brief state mismatch after the report was committed; the state was regenerated and the **complete** gate rerun passed.
- GitHub `master` advanced by normal non-force push from `a3c503c193f02b8e0f6b0f77acb8fd4b0a786625` to `e3a8626014260da5dd485e6cfb25ebd6187f0a6c`.
- Replit Shell preserved the preceding empty publish marker `cde1c9a1` on `replit-publish-marker-build335-20260923`, fetched the pushed master, and aligned its clean `master` to `e3a86260`. Publication-source attestation passed with source tree `e8a9f14b8adf12c00bd9cf6ceef7f630ace25346`; checkout readiness, Replit production build and tracked-secret scan passed.
- Read-only Replit schema correspondence passed before and after publishing: 251 tables, 1,518 constraints, 659 indexes and 3,449 columns in the exact source/production check; development parity reported 251 tables and 312 declared indexes. No schema files changed from the preceding published source. Replit's development-to-production database copy checkbox was off. No production schema operation or data copy was requested. Replit reported successful publication and created empty marker `ee70a45e5344fb8f8a8a139ab6071a22094ae3af` with the same tree.
- Live `https://bimlog.app/api/v1/healthz` returned `status=ok`, `identityBound=true`, and exact `sourceCommit=e3a8626014260da5dd485e6cfb25ebd6187f0a6c`. Authenticated Chrome remained signed in as Roberto. Headquarters search produced a correct 0/1 empty state and reset to 1/1. QA project 53 Intake reloaded with its prior work item, task, resource assignment and 40/40 planned hours. Operations showed the same task plus 2 actual hours and 25% progress after refresh; Warning risk filter produced 0/1 and disabled exports, then All restored 1/1. EDT readiness returned the expected guarded message that this historical Intake lacks a verifiable canonical Contract version, without a visible crash or mutation. Company Catalogs, Delivery Workflows, Workflow Governance, Pricing Templates, Total Control, Project Budget, Contracts and Cost & Value Planner loaded under the authenticated account; blank Pricing preview correctly requested a template name. Chrome console error log was empty.
- This is a broad authenticated release regression, **not** positive end-to-end EDT activation or every-platform-workflow acceptance. The QA fixture has no canonical Contract/APU records, and the public request/approval routes intentionally remain closed. Native/installer files did not change, so focused Navisworks smoke was not required.

## Remaining implementation gap

The canonical Operations Director role needs an actual governed assignable identity and negative permission tests before the request/approval HTTP routes can open. Economic Plans, time-impact calculation and complete operational UI are still unfinished. Existing Intake activation and Operations remain the working customer path. This block is **not** end-to-end EDT acceptance.
