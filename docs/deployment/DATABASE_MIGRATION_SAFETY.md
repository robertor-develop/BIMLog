# Database publication safety gate

## Safety decision

**Status: human-gated; Replit-managed database migration authority is not proven
removable.**

Replit's current documentation says that every Replit App has development and
production databases and that structural development changes, including deleted
columns or tables, are applied to production at Publish:

- <https://docs.replit.com/features/data-and-storage/development-and-production>
- <https://docs.replit.com/features/project-setup/configuration>

The supported `.replit` configuration reference documents deployment build/run
commands but no setting that disables database schema propagation. BIMLog's
`[[artifacts]]` entries contain opaque IDs only; their type and database authority
cannot be safely inferred or changed from repository configuration. Removing either
entry is therefore unsupported and prohibited without separate Replit confirmation
and a disposable proof.

The preferred architecture remains compute-only Replit publishing with schema
authority exclusively in governed BIMLog migrations. That architecture is not
currently proven available. Until it is, every Publish is a human-gated database
operation. Replit may apply schema before the repository build runs, so a passing
root build cannot stop a Publish that has already begun.

## Source-authority incident

The July 23, 2026 read-only audit found that Replit deployed stale source
`2c1ffc4b5c08618610cdb70b42fcb08556726f1c` while accepted work had advanced on
`refs/heads/master`. The repository's remote default still points to older `main`.
The stale workspace consequently saw only 97 Drizzle table declarations and
proposed 33 `DROP TABLE ... CASCADE` statements. Accepted master already declares
132 tables and 140 indexes and reconciles all 92 startup-created tables. Do not add
duplicate declarations for the 33 stale-source findings.

The exact mechanism that left Replit stale is not independently verified. The
evidence is consistent with a workspace or deployment snapshot that was never
advanced to authoritative `master`, while the remote default remained `main`.
Publishing is blocked until the source chain below passes.

## Non-destructive Replit source repair

Run these steps in the Replit Shell before any database sync or Publish. Do not print
credential-bearing remote URLs.

1. Record `git status --short --branch`, current branch/detached state, `HEAD`,
   `origin/master`, `origin/main`, and a sanitized repository identity.
2. Inventory every tracked modification and untracked workspace-only file. Hash and
   preserve reviewed workspace-only material outside the checkout. If any item is
   not understood, stop.
3. Read `refs/heads/master` and `refs/heads/main` with `git ls-remote --symref
   origin`. The advertised default must not be treated as BIMLog authority.
4. Fetch `master` explicitly: `git fetch origin
   refs/heads/master:refs/remotes/origin/master`.
5. If the workspace is clean and its commit is an ancestor of `origin/master`,
   switch to local `master` and run `git merge --ff-only origin/master`. If a local
   master does not exist, create it tracking `origin/master`.
6. If the checkout is detached, divergent, dirty, or contains unreviewed files, stop
   and preserve it on a review branch. Do not reset, force checkout, delete files,
   or overwrite the workspace.
7. Require exact equality among `HEAD`, local `master`, `origin/master`, and the
   freshly read remote `refs/heads/master`, then require a clean status.
8. Run `pnpm run attest:publication-source`. It independently reads remote
   `master`, rejects the older default branch, verifies the sanitized repository
   identity, requires a clean `master`, and binds the schema contract to that commit.

No cached snapshot, detached stale commit, or remote `main` is an acceptable
deployment source.

## Enforced repository gates

Run `pnpm run gate:pre-push` before pushing. The normal root build runs
`check:database-safety`. The gate:

- rejects destructive production migration sources;
- rejects `DROP`, `TRUNCATE`, `CASCADE`, RLS-disable, policy, constraint, and index
  removal in a complete preview, including comment-separated keyword variants;
- verifies that all Drizzle schema files containing tables are exported;
- reconciles every startup-created table with the Drizzle contract.

Direct `push-force` is disabled.

## Guarded Helium synchronization

Only after exact source attestation and separate authorization to mutate the
disposable Replit development database, run:

```bash
BIMLOG_SCHEMA_TARGET=development pnpm --filter @workspace/db run sync-development
```

The command fails closed unless:

1. the target is explicitly `development`;
2. both database URL variables are present;
3. the development hostname identifies Replit Helium;
4. development and production identities differ;
5. authoritative remote master, `origin/master`, clean local master, and `HEAD`
   match exactly.

It then synchronizes Helium and performs a read-only table/index parity check. It
never synchronizes production. The current review did not run this command and did
not access either database.

## Complete preview and additive inventory

After guarded Helium parity, regenerate the Replit deployment preview. It may be
empty or contain only explicitly inventoried additive statements required by the
accepted master. It must contain:

- zero `DROP`;
- zero `CASCADE`;
- zero `TRUNCATE`;
- zero RLS disable;
- zero unexplained constraint, policy, column, table, or index removal.

Copy the complete SQL to a file. Create an external JSON inventory with:

- `completePreview: true`;
- exact `acceptedCommit`;
- `sourceContractSha256`;
- `previewSha256`;
- ordered `additiveStatementSha256` values;
- `backupRestorePointVerified: true`;
- SHA-256 of the exact pre-publication affected-table record-count manifest;
- `postRecordCountVerificationRequired: true`.

Then run:

```bash
node scripts/check-database-safety.mjs \
  --preview generated-migration.sql \
  --complete-preview \
  --additive-inventory generated-migration.inventory.json
```

An empty complete preview needs no additive inventory. A missing, partial, truncated,
or unhashable preview or deployment log blocks Publish. Every non-empty statement
must be additive and match the inventory byte-for-byte. There is no
approval-by-warning.

## Mandatory production controls

Before a schema Publish, the owner must explicitly approve the exact accepted
commit and:

1. verify a restorable backup/restore point;
2. create a read-only exact pre-publication record-count manifest for every affected
   production table;
3. archive the commit-bound source, Helium parity, complete-preview, and additive
   inventory evidence;
4. use a deployment preview for bounded product validation;
5. approve Publish only after zero destructive or unexplained statements are proven.

After Publish, archive the complete deployment log, attest the deployed commit, and
create the exact post-publication record-count manifest for the same tables. Any
count change must be explained by an approved additive migration or the release is
an incident. If the complete generated SQL or complete deployment log cannot be
obtained, do not Publish.
