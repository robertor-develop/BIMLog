# Database publication safety gate

## Current verified publication state — 2026-09-19

Build 020 synchronized exact reviewed source `be902808b59c264d31480f5d76424f8fdaff5cbe` through Replit Shell and ran the read-only publication database operator before Publish. Development and production matched exactly, `schemaAction=NONE`, `publishable=true`, and `developmentDataCopy=OFF_REQUIRED`. Replit receipt `e89dc3b4` passed Security, Build, Bundle, and Promote. Production rows and schema objects were unchanged.

This is the proven BIMLog path: exact GitHub `master` source, clean Replit Shell synchronization, source attestation, read-only development/production correspondence, no destructive SQL, development-data copy off, one controlled Publish, then live identity, health/readiness, and authenticated Chrome verification. Replit Agents are prohibited.

## Safety decision

**Status: Roberto's September 17 rule is exact development/production schema
correspondence and no destructive database changes. A provider SQL preview is not
a mandatory prerequisite when Replit does not offer one.**

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

Replit may apply schema before the repository build runs, so a passing root build
cannot stop a Publish that has already begun. Require exact source identity,
read-only schema correspondence, and the existing destructive-SQL source gate
before each Publish. Keep development-data copying off.

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
At the time of that incident, publishing was blocked until the source chain below passed. Build 020 later proved that chain and published successfully; future publications must repeat it against their own exact candidate.

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

### Explicit named release branch

A reviewed release branch may be attested only when both bindings are explicit:
`BIMLOG_ACCEPTED_BRANCH` must be its exact short branch name and
`BIMLOG_ACCEPTED_COMMIT` must be its full lowercase 40-character commit. Full refs,
detached commits, current-branch inference, advertised-default inference, and
fallback to `master` are rejected.

Because the attestation requires equality with the live remote branch, run it after
the exact commit has been pushed normally to that named branch and the corresponding
`refs/remotes/origin/<branch>` has been refreshed. Then require exact equality among
`HEAD`, `refs/heads/<branch>`, `refs/remotes/origin/<branch>`, the live
`refs/heads/<branch>`, and `BIMLOG_ACCEPTED_COMMIT`, plus a clean status including
untracked files. For example:

```sh
export BIMLOG_ACCEPTED_BRANCH=recovery/platform-print-pdf-successor-20260728
export BIMLOG_ACCEPTED_COMMIT=<full-lowercase-40-character-commit>
pnpm run attest:publication-source
```

This named-branch attestation is post-push source verification, not permission to
publish or deploy. A failed equality check stops the release.

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

## Exact schema correspondence and no-drop release check

From the exact clean source in Replit Shell, run the read-only
`BIMLOG_SCHEMA_TARGET=development pnpm --filter @workspace/db run check:parity`.
It must compare both directions for all public tables, columns, indexes, and
constraints, including constraint validation state. Counts alone do not pass.
Run the existing database-safety source check and verify the release introduces
no `DROP`, `CASCADE`, `TRUNCATE`, RLS disable, or unexplained object removal in
production migration paths. Do not copy development data to production.

If Replit actually presents migration SQL or a destructive-operation warning,
inspect it and stop on any DROP or unexplained change. Do not invent a preview
artifact or block an otherwise passing code-only release because Replit did not
offer one. A proposed standalone Drizzle plan is diagnostic evidence, not an
assertion about the provider's action.

## Mandatory production controls

After Publish, verify exact live source identity, health, representative
authenticated behavior, and read-only production schema correspondence again.
If the provider reports an unexpected schema change, stop further releases and
investigate it without approving destructive repair.

## September 16, 2026 publication incident and verified lessons

The Replit Shell `DATABASE_URL` targeted the separate Helium development database.
`PROD_DATABASE_URL` resolved to the same Neon host and database shown in Replit's
managed Production Database connection details. That target was BIMLog's live
production database, not disposable preview data. Read-only comparison found 211
public tables, 2,927 columns, 1,161 constraints, and 542 indexes in each database.
The column-name/type/default/nullability and index definitions matched, but six
constraints with matching definitions were `NOT VALID` in production and valid in
development. Equal object counts therefore did not establish exact schema parity.

A separate Drizzle source-to-production preview proposed 128 `DROP CONSTRAINT`
and eight `DROP INDEX` statements. That output was **not** Replit's provider
Publish plan and could neither prove a destructive provider migration nor approve
publication. A Publish action in the Replit UI was not preview-only: the first
click prepared, built, and promoted the release automatically. A complete provider
migration SQL preview was not obtained before that click. The historical preview
requirement was superseded by Roberto's September 17 instruction: exact database
schema correspondence and no drops, without an invented preview prerequisite.
Do not assume that click is a harmless way to obtain a migration preview. Keep Replit's
"Copy your development database to production database" option off unless
Roberto expressly authorizes replacing production data.

The published source tree was the already-pushed GitHub `origin/master` commit
`8ee7bb16193995380d4886d66b2e28f94d276f71`; the Replit deployment receipt
was `c1aca811`. Replit also created an empty local publication commit, but its
GitHub push failed authentication. The source commit was already on GitHub; the
publication receipt commit was not proven pushed. Live `/api/v1/healthz` returned
`{"status":"ok"}`; authenticated Chrome loaded the dashboard, an existing QA
project's analytics, and company master-catalog data. Post-publication production
schema counts remained 211/2,927/1,161/542. The visible application label still
showed `v1.05.N17-P31`; report the deployment receipt and exact source identity
separately from a stale display label. Equal post-publication object counts and
visible records are bounded checks, not the affected-table record-count manifest
required above and not proof that all production data was preserved. These checks
also do not prove every user workflow or customer acceptance.

For future releases, establish the exact source, runtime, database identities,
and schema/object differences before a provider action; do not substitute a
Drizzle preview for the provider's actual action or infer safety from counts
alone. Use Replit Shell for read-only inspection and build/source verification,
not as a workaround for a denied safety action. After publication, verify the
deployment identity, live health, authenticated representative workflows, and
production data/schema preservation. No Replit Agent was used in this incident.
Before the next release, rerun exact source, schema-correspondence, and no-drop
checks on the current candidate. Do not treat an unavailable provider preview as
a separate stop condition.
