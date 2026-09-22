# Build 277 — repository and release-state reconciliation

Date: 2026-09-22

Result: `PASS_SOURCE_BASELINE`

## Authoritative implementation lineage

| Boundary | Verified value | Evidence state |
|---|---|---|
| Canonical Git repository | `F:\BIMLog\Repositories\bimlog` | Verified with Git metadata. |
| Authorized EDT worktree | `F:\BIMLog\Worktrees\bimlog-edt-engine-block01-20260922` | Clean isolated worktree created from the accepted successor. |
| Program branch | `codex/bimlog-edt-engine-block01-20260922` | Isolated from unrelated historical worktrees. |
| Pre-program accepted source | `c97efd491f15d393f7c432419f2e2d908cd574a8` | Matched the local `origin/master` tracking ref before Build 276. |
| Build 276 | `ca399ae03d87435c5f24ece52f8f6e48e426d857` | Package/requirements register only. |
| Prior program boundary | Builds 226–275 | Coordination Knowledge program; preserved and not reopened. |

The stale canonical checkout at `F:\BIMLog\Repositories\bimlog` is not an implementation or
release source. All EDT program work proceeds from the isolated worktree above. Historical
worktrees remain untouched.

## Current release contract

`contracts/release-identity.json` declares `v1.05.N18-P36` / binary `1.5.18.36`. The current
Living Brief state is reconciled through `ee0e684e307b2d3f28d653533f14b533f1387349`, with the
later documentation reconciliation at `c97efd491f15d393f7c432419f2e2d908cd574a8` forming the
pre-program source boundary.

This build does not claim that the local release contract alone proves current deployment. Exact
Replit source, package, runtime version, health/readiness, production database and authenticated
behavior will be re-observed at the authorized publication boundary after Build 285. Push success
and deployment success remain separate facts.

## Database boundary

- No production database connection was opened.
- No development or production migration was run.
- Existing schema and startup migrations remain unchanged.
- Future EDT changes must be additive in both Drizzle schema and idempotent startup migration.
- Every future production migration requires a separately observed zero-drop preview and explicit
  production authorization.

## Protected surfaces

The EDT program must preserve:

- canonical BIMLog issue, project, company, file, RFI, Submittal, Transmittal, Change Order and
  Schedule identities;
- tenant/company/project authorization and direct-endpoint denial;
- current Intake, Commercial APU, Operations and financial history;
- Coordination Knowledge Builds 226–275;
- Pulse-only shared bundle, Lens Next-only product direction and retired Original/Legacy Lens;
- Native C#, loopback bridge, installers and plugin packages unless this program itself causes a
  proven regression;
- customer records and historical QA evidence.

## Release cadence bound to this program

- One bounded commit per build.
- Push after each five-build block.
- Publish after every second block, beginning after Build 285, only from an accepted exact commit.
- Authenticated Chrome smoke follows each publication.
- Navisworks smoke is triggered only by an actual Native or installer change.
- No more than ten accepted builds may remain unpublished.

## Acceptance

- Worktree base equals the verified pre-program `origin/master` tracking ref.
- No unrelated worktree was modified.
- Source, remote-tracking, release-contract, Living Brief and deployment evidence are recorded as
  distinct boundaries rather than reported as equivalent.
- No publication, provider action or database mutation occurred.
