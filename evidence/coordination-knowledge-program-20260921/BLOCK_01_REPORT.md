# Coordination Knowledge Library — Block 1 source acceptance

Date: 2026-09-21
Builds: 226–230
Status: `PASS_SOURCE_CANDIDATE`

## Scope delivered

- Build 226: canonical Conflict Type, Coordination Rule, Resolution Method, Project Case, Lesson Learned Proposal, Knowledge Revision, status, transition, and evidence contracts.
- Build 227: company-scoped Conflict Type identity plus immutable revisions, classification dimensions, metadata, approval, and retirement truth.
- Build 228: company-scoped Coordination Rule identity plus immutable revisions, applicability, rationale, exceptions, references, attachments through the existing `files` authority, approval, and retirement truth.
- Build 229: company-scoped Resolution Method identity plus immutable revisions, applicability, trade, constraints, pros/cons, approvals, RFI requirement, structured details, rules, cases, and many-to-many Conflict Type relationships.
- Build 230: additive Drizzle/startup migration parity, serialized startup barrier, tenant-scoped repository foundation, canonical Lens issue boundary, repeat/rollback behavior, and restored-database proof.

## Preserved authority

- No duplicate issue table or issue state machine was introduced.
- `coordination_project_cases.lens_viewpoint_id` references the existing canonical `lens_viewpoints.id`.
- Existing Lens issues remain valid without knowledge classification.
- Lesson Learned Proposals are review objects and cannot be inserted as approved organizational standards.
- No visible Lens Next UI, Native bridge, installer, plugin package, or Navisworks behavior changed in this block.

## Database proof

- Migration inventory: 12 additive tables, 4 relationship/scope indexes, and 5 immutable-history triggers.
- Destructive statements: `DROP=0`, `TRUNCATE=0`, destructive rename `=0`, canonical-table replacement `=0`.
- Startup execution is serialized by transaction-scoped advisory lock.
- Unit harness proved repeat execution, rollback on failure, and connection release.
- A controlled PostgreSQL 18 instance restored from `F:/BIMLog/TestProof/block22-build109-restore-20260920-retry/bimlog-rfi-test.backup` ran the migration twice.
- Restored project and Lens viewpoint row counts were unchanged.
- A real revision insert succeeded, a direct mutation was rejected by the immutable trigger, and the proof transaction left no synthetic knowledge row.
- The database harness is valid for both a restored fixture with existing company data and a clean declared-schema fixture; when no actor exists it creates company/user proof rows inside the same rolled-back transaction.
- The temporary restored database listener was stopped after the proof.

## Verification completed

- `pnpm --filter @workspace/api-server run test:coordination-knowledge-block1` — PASS.
- `pnpm --filter @workspace/api-server run test:coordination-knowledge-db` against the restored fixture — PASS.
- `pnpm run typecheck:libs` — PASS.
- `pnpm --filter @workspace/api-server run typecheck` — PASS.
- `pnpm run check:database-safety` — PASS.
- `pnpm run check:open-loop-dispositions` — PASS.
- `pnpm run test:post120-block38` — PASS.
- `pnpm run check:mojibake` — PASS.
- The first complete gate exposed a pre-existing route-inventory parser that absorbed unrelated imports and platform line endings. The generator now reads only the exact `@workspace/db/schema` import, normalizes EOLs, and carries a permanent no-import/no-newline table-identity assertion; the focused route graph regression passes with 605 API routes and 61 real table identities.

## Release boundary

This is the five-build push-only boundary. Publication, Replit synchronization, authenticated Chrome smoke, and any production schema application are not due until Build 235. Focused Navisworks smoke is not required because this block changes no Native/API bridge contract, installer, package, or Navisworks-facing behavior.
