# BIMLog EDT and Engine Templates — Block 4 acceptance

Date: 2026-09-22

Builds: 291–295

Result: `PASS_LOCAL`

Push boundary: due after Build 295

Publication boundary: due after Build 295

## Accepted builds

- Build 291 adds explicit activation permissions, a serializable transaction boundary, exact-fingerprint activation requests and deterministic EDT/Work Item activation writes.
- Build 292 adds typed governed-change requests and separation-of-duties decisions, including transactional visible-code correction with preserved aliases.
- Build 293 freezes immutable Work Item Economic Plans and implements submitted/approved/rejected time transitions with append-only Committed/Pending, Released and Approved/Consumed ledger entries.
- Build 294 adds exact R/V issuance submission, conflict-safe QC decisions and fingerprint-bound `Result` import previews with row-level validation evidence.
- Build 295 proves transaction rollback, authorization boundaries, source-level idempotency, zero-drop migration safety, API type compatibility and the protected Native boundary.

## Scope truth

- Product behavior changed: `YES` — callable backend service layer only; UI and public routes remain later blocks.
- Database/schema source changed: `NO` in this block; the additive Block 3 migration remains the required runtime foundation.
- Production database touched locally: `NO`
- Lens Next Native or installers changed: `NO`
- Focused Navisworks smoke required: `NO`
- Publication due: `YES`, only after push, zero-drop provider preview and exact source alignment.

## Verification

Run `pnpm run test:edt-engine-block04`, API TypeScript, root build, mojibake and Living Brief integrity. Provider publication must be canceled if the Replit preview contains any destructive operation.
