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

Focused acceptance: `pnpm run test:edt-engine-block14` passed using `bimlog_rfi_test` on loopback. API TypeScript typecheck passed. The Build 345 SQL test plans writes but never executes them; the Build 344 transaction host is synthetic and cannot be represented as a real database approval. The full production-artifact gate, exact push, Replit Shell synchronization, zero-drop preview, publication and authenticated Chrome smoke are the release gates for this ten-build boundary and must be recorded separately after execution.

## Remaining implementation gap

The canonical Operations Director role needs an actual governed assignable identity and negative permission tests before the request/approval HTTP routes can open. Economic Plans, time-impact calculation and complete operational UI are still unfinished. Existing Intake activation and Operations remain the working customer path. This block is **not** end-to-end EDT acceptance.
