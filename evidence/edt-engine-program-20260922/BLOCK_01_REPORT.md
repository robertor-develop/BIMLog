# BIMLog EDT and Engine Templates — Block 1 acceptance

Date: 2026-09-22

Builds: 276–280

Result: `PASS_LOCAL`

Push boundary: due after Build 280

Publication boundary: not due until Build 285

## Accepted builds

- Build 276 verified all 12 package hashes and registered source precedence, approved requirements
  and explicit exclusions.
- Build 277 established the exact current source/worktree/release boundaries without equating a
  Git push, release contract or historical report with deployment proof.
- Build 278 classified existing Catalog, Workflow, Governance, Pricing, Intake, Operations,
  Schedule, Change Order and budget capabilities and defined extend-not-duplicate decisions.
- Build 279 defined the additive EDT schema, zero-drop migration sequence, rollback boundary and
  dual Drizzle/runtime-migration requirement without connecting to a database.
- Build 280 added the deterministic Block 1 evidence harness and ledger.

## Scope truth

- Product behavior changed: `NO`
- Database/schema changed: `NO`
- Production database touched: `NO`
- Lens Next Native changed: `NO`
- Installer changed: `NO`
- Focused Navisworks smoke required: `NO`
- Publication due: `NO`

## Verification

Run `pnpm run test:edt-engine-block01`. The harness checks the package/register boundaries, current
canonical authorities, classified gaps, additive migration prohibitions and the explicit current
Governance execution gap.

Block 2 may begin only after the accepted Block 1 branch is pushed. Production publication remains
scheduled after Block 2 / Build 285, followed by authenticated Chrome smoke.
