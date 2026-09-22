# BIMLog EDT and Engine Templates — Block 3 acceptance

Date: 2026-09-22

Builds: 286–290

Result: `PASS_LOCAL`

Push boundary: due after Build 290

Publication boundary: not due until Build 295

## Accepted builds

- Build 286 adds the canonical Project/Contract/Deliverable/Location EDT hierarchy, additive Work Item identity fields, deterministic active code uniqueness and historical code aliases.
- Build 287 adds exact-revision activation requests/decisions and typed governed-change requests/decisions with optimistic concurrency, idempotency, reasons, evidence and immutable decision rows.
- Build 288 adds immutable Work Item Economic Plans, the append-only budget ledger and additive time-entry lifecycle fields without silently reclassifying historical entries.
- Build 289 adds exact Work Item R/V issuances, issuance-bound QC decisions and governed `Result` worksheet import batches/rows with original-file hashes and row-level validation evidence.
- Build 290 proves Drizzle/runtime migration correspondence for all 12 new tables, startup wiring, zero-drop SQL and the protected Native boundary.

## Scope truth

- Product behavior changed: `NO` — this block establishes additive persistence authority only.
- Database/schema source changed: `YES`
- Production database touched: `NO`
- Migration executed against production: `NO`
- Lens Next Native changed: `NO`
- Installer changed: `NO`
- Focused Navisworks smoke required: `NO`
- Publication due: `NO`

## Build commits

- Build 286: `6b2889ad0901153175aff7cb7eb6a543885ce726`
- Build 287: `e7955831036ff3939ffbe418fb181073feb432fd`
- Build 288: `280f5aa9d0e84a3dfa4433b7af632c61be5656e4`
- Build 289: `3ed82a389af40f9e9dbe2b8357f025cf9cab0f5e`
- Build 290: `SELF_BLOCK_END_COMMIT`

## Verification

Run `pnpm run test:edt-engine-block03`, API TypeScript, database package TypeScript, mojibake and Living Brief integrity. The next controlled production migration preview and publication remain scheduled at the ten-build boundary after Build 295.
