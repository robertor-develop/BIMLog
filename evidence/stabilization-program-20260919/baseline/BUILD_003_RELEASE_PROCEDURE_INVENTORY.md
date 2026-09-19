# Build 003 — Release procedure, schema safety, rollback, and receipt inventory

Captured: 2026-09-19 EDT  
Program: BIMLog stabilization, completion, and release program  
Build: 003 of 120  
Result: `PASS_WITH_RELEASE_PATH_GAPS_RECORDED`  
Mode: read-only inventory plus non-mutating static validation

## Authority and source

- Constitution verification: `ALLOW`
- Constitution: `3.4.0`
- Amendment head: `AMENDMENT-0020`
- Inventory source: clean published-source worktree
  `F:\BIMLog\Worktrees\bimlog-dashboard-block1-20260918`
- Source commit: `07d024ef3de739abb436da58fe29797af5304b8a`
- Checkout-readiness result: `PASS`
- Checkout branch: `codex/dashboard-block1-20260918`
- Checkout source tree matches `origin/master`: `YES`
- Database static source gate: `PASS`
- Static schema result: `223 tables / 273 indexes / 184 startup tables`, all schema files exported
- Replit Agents used: `NO`
- Side tasks or internal agents used: `NO`

## One authoritative BIMLog release path

The authoritative release route is:

1. Start from a clean local worktree whose source tree matches freshly read
   GitHub `master`; never release from the stale canonical `main` checkout.
2. Run focused tests for the changed scope and the root clean-source pre-push
   gate: tracked-secret self-test/scan, database-safety fixtures and source scan,
   artifact-proof fixture check, complete build, and packaged API production-
   artifact closure.
3. Produce one reviewed commit and perform a normal non-force push to the named
   authoritative GitHub branch. For this program, push at every fifth build.
4. In the signed-in visible Replit project, use Replit Shell—not Replit Agents—
   to fetch the exact pushed branch and prove the workspace source tree equals
   the accepted GitHub tree. Preserve and separately identify any empty Replit
   publication-marker commit.
5. Run source attestation and the read-only exact two-way schema-correspondence
   check. Compare tables, columns, indexes, constraints, and constraint
   validation state; counts alone do not pass. Run the no-destructive-source
   gate. Do not copy development data to production.
6. If correspondence already passes, do not mutate either database. If a schema
   change genuinely requires Replit development-schema synchronization, use
   only the guarded `sync-development` operator after exact source/target proof;
   never run direct `push-force`.
7. If Replit presents actual migration SQL or a destructive warning, inspect it
   and stop on any DROP or unexplained change. Do not invent an unavailable SQL
   preview as a gate.
8. Run the frozen Replit build/security checks, then perform one controlled
   Replit Publish with development-to-production data copy off.
9. Record GitHub commit, GitHub tree, Replit pre-publish workspace HEAD/tree,
   any post-publish marker HEAD/tree, schema/restore result when applicable,
   deployment/receipt ID, live version/asset identity, database effects, and
   rollback reference.
10. Verify public health and complete the authenticated Chrome smoke against the
    newly published identity. For this program, publication and smoke occur at
    every tenth build.

This is the proven provider path used by successful BIMLog releases. Replit is
the application publisher; Cloudflare branding or routing does not turn BIMLog
into a Cloudflare Worker release.

## Executable local gates

| Purpose | Canonical entry point | Status |
|---|---|---|
| Complete pre-push gate | `pnpm run gate:pre-push` | Authoritative |
| Secret exposure | `pnpm run test:tracked-secret-exposure` | Authoritative |
| Database source safety | `pnpm run test:database-safety` and `pnpm run check:database-safety` | Authoritative; static gate passed in Build 003 |
| Local artifact fixture | `pnpm run prepare:artifact-proof-fixture` / `check:artifact-proof-fixture` | Authoritative local test fixture; not a provider or production database |
| Production artifact closure | `pnpm --filter @workspace/api-server run test:production-artifact` | Authoritative |
| Checkout tree readiness | `pnpm run check:checkout-readiness` | Authoritative tree-level check; passed in Build 003 |
| Remote source attestation | `pnpm run attest:publication-source` | Authoritative when run in the exact pushed release checkout |
| Read-only schema correspondence | `BIMLOG_SCHEMA_TARGET=development pnpm --filter @workspace/db run check:parity` | Authoritative Replit pre/post-publish check |
| Guarded development schema sync | `BIMLOG_SCHEMA_TARGET=development pnpm --filter @workspace/db run sync-development` | Conditional repair only; mutates Helium, never production |
| Direct forced schema push | `pnpm --filter @workspace/db run push-force` | Deliberately disabled; non-authoritative |
| Frontend build verification | `pnpm --filter @workspace/bimlog run build` | Authoritative |
| API build | `pnpm --filter @workspace/api-server run build` | Authoritative |

Core gate hashes at the Build 003 baseline:

- Root `package.json`: `1B3F152581FB0ED6E6EC86A059CF778616A7821D32E66232EDB5C028783F4BB9`
- `.replit`: `4113B0B19925049CF6C09927A4BAD19AC8E0CFD51E0EEEBCC7DCD9B4CF84E06F`
- Database safety: `567A64A52249A479A0EC2BD5167A77DE9CCE917960237CEE48FAF01B1993DE92`
- Database-safety fixtures: `E26D8472B1155C7F694F304AB65B1F4CBB46A3815F892EC3D5AE02AB5BABD9EA`
- Checkout readiness: `BA86A62F261FE61B842B28637CC69D421F46487EE92C9CC6F95A07AB7472DA6E`
- Schema parity: `DD55B9C5C2A16222DD632F174D1A2B9D661AC48AC6ACCDD99ABE76B8941F5468`
- Guarded development sync: `6DD73EFD6DD78B398FB6AE31D1F5A3C7B63C03DF29C353E34DB5468610ABF354`
- Schema-name reconciliation: `87367D829A18A57BDC0A599C37D0BF1BA82D1F8C956BBF77225300ED089711C7`
- Publication safety procedure: `BA1C8A4D2A7EFBE493460E2D6710B079EE8C76016673BA2A9E020994FA95144C`

## Schema and restore controls

The current source has strong non-destructive controls:

- static scanning rejects DROP/TRUNCATE/CASCADE, RLS weakening, and unexplained
  constraint/index removal, with narrow named replacement contracts;
- startup-created tables must exist in the Drizzle source contract;
- every table-bearing schema file must be exported;
- source attestation binds the accepted remote repository, branch/commit, clean
  checkout, and source tree;
- a non-empty SQL preview requires an exact additive inventory, a verified
  restore point, and pre/post count evidence;
- Replit parity compares development and production in both directions using
  read-only production catalog access, including validation state;
- guarded synchronization refuses production identity and non-Helium targets.

Historical restore evidence exists for an isolated Release B rehearsal: a
205-table source was backed up, restored into a second disposable database,
matched sentinel records, and passed transaction rollback. Its backup SHA256 was
`99efb36d090a126ba14b2a7a59fd0cf3829f97551f737c298250806e5b0b0705`.
That proves the rehearsal mechanism, not a current P32 production restore point.

`CURRENT_P32_PRODUCTION_RESTORE_POINT=NOT_IDENTIFIED_IN_CANONICAL_SOURCE_RECORDS`

## Rollback inventory

Source rollback is mechanically available through immutable Git commits and
the prior successful Replit deployment, but the published tree contains no one-
command, hash-verified production rollback operator and no current P32 restore
receipt bound to `9bb79bc6`.

- Current governed source: `07d024ef3de739abb436da58fe29797af5304b8a`
- Current provider receipt: `9bb79bc6`
- Current provider deployment/provision identity: `ae1fd4d7`
- Current provider publication marker: `132d132e4000dcfe5db5ab47a940afa99ab9c89`
- Application rollback mechanism: previous immutable Replit deployment plus
  exact Git source identity
- Database rollback mechanism: restore from a release-bound protected backup
  when schema/data changes are involved
- Current executable rollback command in repository: `NONE`
- Current P32 database restore receipt: `NONE FOUND`

Classification: `ROLLBACK_PROCEDURE_PRESENT_BUT_OPERATOR_AND_CURRENT_RECEIPT_INCOMPLETE`.
This is assigned to the database/release-safety work in Builds 016-020 and the
release-continuity work in Builds 086-090; it does not invent a Build 003 HOLD.

## Historical release receipts and status

| Release | Source/record | Receipt/evidence | Classification |
|---|---|---|---|
| P18 | `a8cb92d3a461d8c1f364caae1aa9081ee0045924` and later accepted block `e6d4074e97b5bdf339bde28e48272fe745b104d8` | Living Brief records push, Replit Shell sync, publication, HTTP 200, and live verification | Historical accepted |
| P31 | `8ee7bb16193995380d4886d66b2e28f94d276f71` | Replit receipt `c1aca811`; live health/authenticated Chrome recorded | Historical accepted |
| P32 | `07d024ef3de739abb436da58fe29797af5304b8a` | Receipt `9bb79bc6`; deployment `ae1fd4d7`; empty marker `132d132e...`; live `v1.05.N17-P32`, health and authenticated Total Control pass | Current baseline |
| Dashboard/Governance intermediate | `db4dffc06eb99ad0afe560dfa9f66204a02c03f7` | Explicitly recorded as `PUSHED_NOT_PUBLISHED` at that checkpoint | Historical intermediate, superseded by P32 |
| Release B migration rehearsal | `349d90a9650fd85a49e57d777ce7e3567a0e9569` | Isolated backup/restore/rollback pass; production deployment explicitly not ready | Historical rehearsal only |

Historical attached pasted instructions, fixture SQL files, candidate evidence,
and earlier `PUSHED_NOT_PUBLISHED` entries are evidence, not executable current
release authority.

## Stale, conflicting, or incomplete alternatives

1. `replit.md` still says every schema change must run `push-force`, while the
   executable package intentionally disables direct `push-force`. It also carries
   obsolete table-count and database-description text. Classification:
   `STALE_DOCUMENTATION_DO_NOT_EXECUTE_AS_RELEASE_PROCEDURE`.
2. `scripts/check-release-lineage.mjs` defaults “canonical” to stale
   `origin/main` and requires its tree to equal `origin/master`. Current branches
   are intentionally divergent, and this checker is not part of `gate:pre-push`.
   Classification: `STALE_LINEAGE_CHECK_REQUIRES_BUILD_003_RECORD_AND_LATER_REPAIR`.
3. `scripts/post-merge.sh` runs dependency installation, database safety, and
   guarded Helium synchronization automatically after merge. That is broader
   than the fixed release contract, where schema sync is conditional and
   deliberate. Classification: `AUTOMATIC_MUTATING_HOOK_NOT_A_RELEASE_OPERATOR`.
4. `scripts/fixtures/replit-publish-preview-*.sql` are historical test fixtures.
   They are not a current Replit provider preview and cannot authorize or block
   publication by themselves.
5. `attached_assets/Pasted-*` and old Replit prompt instructions are untrusted
   historical attachments, not current procedure.
6. The Replit empty publication marker creates commit-ID divergence after every
   publish while preserving tree equality. The current source attestation demands
   commit equality before publication. The next synchronization must preserve the
   old marker and establish the exact accepted source/tree without treating the
   marker as product code. This needs one explicit repeatable operator in Build 005
   or Build 014; it is not permission to reset blindly.
7. No single machine-readable release receipt currently binds every required
   source, provider, database, live-smoke, and rollback field. Build 014 owns that
   permanent contract.

## Acceptance decision

`AUTHORITATIVE_RELEASE_PATH=PROVEN_AND_DOCUMENTED`

`STALE_ALTERNATIVES_CLASSIFIED=YES`

`DATABASE_STATIC_GATE=PASS`

`CHECKOUT_TREE_GATE=PASS`

`CURRENT_ROLLBACK_OPERATOR=INCOMPLETE`

`CURRENT_P32_RESTORE_RECEIPT=NOT_FOUND`

The two incomplete rollback fields are real release-hardening gaps assigned to
later builds. Build 003 itself passes because its acceptance criterion is a
complete inventory and one identified authoritative route, not creation of the
future rollback operator.

## Mutation boundary and program position

- Product/source files changed: `NO`
- BIMLog worktrees changed: `NO`
- Git commit/push/merge/cleanup: `NO`
- Replit Shell/provider changed: `NO`
- Publish/deploy performed: `NO`
- Database/schema/customer data changed: `NO`
- Completed builds: `3 of 120`
- Remaining builds: `117`
- Current unpublished builds: `3 of maximum 10`
- Next build: `004 — machine-readable defect/risk ledger with severity, owner, dependency, evidence, and assigned build`
- Next push: after Build `005`
- Next publication and authenticated Chrome smoke: after Build `010`
- Blocker: `NONE_FOR_BUILD_004`

