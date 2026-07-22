# OPEN_LOOP.md - BIMLog Open Product Loops

This is the operating register for unfinished BIMLog work. It exists so customer feedback, half-built features, cleanup tasks, quality issues, plugin tasks, and Replit/Codex handoffs do not disappear across compacted chats or focused tasks.

## Current terminal truth - 2026-07-21

### Coordinator Command Center Build 2 accepted in source; push verification pending

- Preserved candidate `bb2925eb0a2fe45d4bb5e60d2e0d4fe76cd125b8`, originally based on
  `b67ae0118b4f8eb85f9de2aaf55c5aad399a7ea6`, was independently reviewed and reapplied as content only to
  authoritative master `999589c7ed5cf9414cda12b4031ce475e16a5303`; candidate ancestry was not imported. Clean product integration:
  `4572882561684bbfe6472a6a0ecca414a4d4f152`. Newer Security Batch A, Portability Phase 1A, Telegram Build 6, and lockout-hotfix history is preserved.
- Scope is Build 2 only: bounded server-side operational filters, My Items, This Week, Overdue, Next Coordination Meeting,
  and All Actionable built-ins; user-and-project-scoped personal saved views/defaults; deterministic configuration,
  optimistic concurrency, idempotent receipts, rename/delete, and shareable URL navigation that grants no access.
- Every saved-view operation rechecks current tenant binding, active membership, project read authority, module entitlement,
  and ownership. Lens retains server/display/viewpoint/Navisworks GUID/physical/revision/lifecycle/lineage identity and
  canonical deep links. RFIs, Submittals, Meeting actions, and Schedule tasks retain their Build 1 canonical mappings.
- Focused reconciliation proof passed Build 2 19/19, Build 1 35/35, Lens identity 15/15, entitlement 41/41, multipart
  security preservation, affected typechecks/build, and real Chrome English desktop plus exact 390px Spanish mobile with
  no overflow or browser errors. The local browser used the built production component with fixture-controlled API replies.
- No Clash substitution, canonical record mutation, AI use/usage/charge, new product notification behavior, Build 3,
  publication, deployment, production/customer access, or field verification is included. Normal push and exact remote
  ancestry/equality verification remain the source completion gate.

### Urgent Living Brief lockout hotfix accepted in source; deployment verification pending

- Roberto reported the deployed Living Brief still rejects his gate password. Source review found the accepted recovery
  path was circular: `POST /living-brief/password` required a Living Brief token when a durable credential existed,
  but obtaining that token required unlocking with the unavailable gate password.
- Source fix accepted at integration commit `3da420d9068e26d80169aa74aefca67eba860b47` on Telegram Build 6 master
  `e67ca65be7ff633aa888241c941c557818c446d9`: authenticated current Super Administrators can recover without an
  existing brief token by using account-password revalidation, exact confirmation, bounded reason, rate limiting,
  observed-version stale protection, locking, atomic version increment, durable audit, rollback safety, and
  prior-session invalidation.
- Ordinary users, Project Admins, Company Admins, anonymous users, stale recovery attempts, replay, wrong account
  password, and rate-limit excess fail safely. The locked page exposes recovery only to authenticated current Super
  Administrators. This remains separate from the owner-approved integration-credential continuity exception.
- Publication, deployment, production verification, and Roberto's field access confirmation remain pending. No
  production/customer data, Replit settings, provider credentials, publication, or manual production reset was accessed
  or changed by this source integration.

### Portability Phase 1A accepted in source; push verification pending

- Corrected candidate `63ab0f873e9294a1c0ce7e3cee9b7a3119bd848d` was reapplied as content only to authoritative
  master `988b5cef9312737f1d64447aa6b5b642b927e4ab`; candidate ancestry was not imported. Clean integration commit:
  `6f9c3f18d524723361f5f0ab45cf18f160566311`.
- Exact integration scope is `docs/portability/PHASE_1A_CREDENTIAL_CONTINUITY_EXCEPTION.md` plus
  `scripts/check-credential-continuity.mjs`. The document records Roberto's temporary exception, recovery ownership,
  non-mutating safeguards, future one-time launch-hardening design, and mandatory public-launch blocker.
- The guard remains byte-identical to the accepted candidate, compares the complete protected Replit configuration
  value-blind, emits generic pass/fail output only, and passed against the current configuration plus its synthetic
  self-test. The protected file/blob and credential behavior remain unchanged.
- Focused source gates passed: accepted-content equality, exact two-file integration allowlist, protected-file/blob
  identity, guard, self-test, and raw diff check. Living Brief semantic, state, encoding, and diff gates are rerun in
  the separate acceptance commit; no broad build is required because no runtime/application behavior changed.
- Remaining source gate is normal push followed by exact remote equality and ancestry verification. No force-push,
  publication, deployment, production/customer/provider access, callback/authentication change, credential mutation,
  default-branch change, history rewrite, or Phase 1B work is authorized or performed.
- Public/production launch remains blocked until Roberto separately approves and verifies managed-secret migration,
  backup/recovery, appropriate rotation/revocation, callback continuity, rollback, history remediation, and independent
  verification.

### Living Brief Credential Persistence and Terminal-Turn Governance Accepted

- Integration commit `c3a7c809643022abb04b8fe58db043ccd5d828ff` cleanly reconciles the accepted Living Brief
  credential/governance candidate onto Coordinator master `81007cafddd1d59880259af2255863986715ed56`, without
  importing superseded candidate ancestry or overwriting Coordinator Build 1 source/acceptance truth.
- The accepted source correction preserves the durable Living Brief gate credential authority, fail-closed missing
  state, Super Administrator revalidated recovery, version-bound sessions, locked-screen reset removal, responsive
  UI fix, owner credential-continuity exception, safe defensive-security guidance, terminal-turn notification rule,
  and the atomic `legacy_migrated` audit fix.
- The atomic audit correction ties `legacy_migrated` evidence to the actual successful one-time legacy credential
  insert and prevents false or duplicate migration audit rows during fresh bootstrap or concurrent startup.
- This is source acceptance only. It does not publish, deploy, access production/customer data, rotate/test/print
  credentials, or verify the live production mirror. Production rollout remains a separate controlled action.
- Ready Telegram Message ID 52 referenced superseded local candidate `27c4b318be4ee2f4371d30633a82b0b448c8d339`;
  it is not a completion notification and was not resent. The current terminal turn requires a separate sanitized
  Completed notification after push and remote verification.

### Coordinator Command Center Build 1 Accepted

- Candidate `c3e8fb030ed544ede6e4f83ea2cd4dab656d01f3` was independently reviewed and applied as
  content only to clean `origin/master` baseline `2c1ffc4b5c08618610cdb70b42fcb08556726f1c`, without
  importing candidate ancestry. Clean integration commit:
  `7fb3a1b54dc378bba38cf79a2747766b62baa741`.
- One read-only Lens-first project action register presents current actionable `lens_viewpoints`,
  RFIs, Submittals, Meeting actions, and canonical Schedule milestones. It retains source module and
  ID, project ID, display identity, original and presentation status, responsibility, deadline,
  floor, discipline, real priority, source update time, authoritative deep link, and bounded related
  Meeting, Schedule, and Lens identities without creating or mutating a second authority.
- Lens eligibility is active Open, Follow Up, and Waiting Design only. Its safe identity includes
  server, display, viewpoint, Navisworks GUID, BIMLog physical ID, lifecycle, revision, supersession,
  grouping, source-project/server/physical/display lineage, and imported-lineage status. No Clash
  table is queried, aggregated, substituted, or presented as current coordination truth.
- The bounded deterministic endpoint rechecks the latest project-company binding, active membership,
  scoped read authority, current Lens/RFI entitlements, and a reasoned exact-project super-admin rule.
  Five bounded source queries run without row-by-row expansion; failed or unauthorized sources remain
  visibly partial with null counts, and an honest zero result never falls back to all records.
- Independent review corrected Spanish presentation and original-status labels. Focused proof passed
  35/35, Lens identity regression 15/15, entitlement resolver 41/41, API/frontend typechecks, and real
  production-component English desktop plus exact 390px Spanish mobile behavior for loading, populated,
  partial-failure, retry, deep-link, and honest-empty states.
- Build 1 remains the canonical read-only register foundation. Build 2 is now separately accepted in source at
  `4572882561684bbfe6472a6a0ecca414a4d4f152`; Clash aggregation, bulk actions, notifications/digests, AI, feedback capture, canonical mutations,
  sync writes, and Build 3 remain deferred.

### Integration candidate: Living Brief Content Reconciliation Build 2

- Candidate `6146c136ce33f9828edb16fddf9c4fffa1b7b839` was based on `9297740` and correctly expanded
  semantic governance, but its tar and deployment status became stale when master advanced.
- Independent reconciliation is now based on accepted `origin/master` commit
  `178462eef6edbde08e2d44efb0a944b812f98480`. Candidate ancestry is not accepted as deployment
  history; only reviewed content is retained and stale operational claims are corrected.
- Scope is the 11-document semantic review model, enforcement, API/UI freshness metadata, and current
  narrative truth. It does not publish Replit, mutate production/customer data, deploy a plugin, or
  start another product build.

### Urgent local candidate: Living Brief credential persistence

- Roberto reports the fifth recurrence of the Living Brief gate password failing after Replit publication,
  with the locked page exposing a visible reset form. Current accepted source seeds a hardcoded gate hash
  only when the legacy `platform_settings` row is absent; that does not overwrite an existing row, but it
  makes missing durable state look like a reset instead of failing closed.
- Local correction in progress from `origin/master` `2c1ffc4b5c08618610cdb70b42fcb08556726f1c`: dedicated
  durable gate credential table, one-time migration of the legacy hash, no hardcoded/default seeding, locked
  page without reset form, Super Administrator revalidated reset with reason/audit/rate limit/session
  invalidation, and structural tests. No production access, publish, deployment, push, or customer data access.
- Remaining gates before acceptance: disposable database/API/browser proof; focused regressions; typecheck/build;
  privacy and diff checks; independent review; then separate controlled production migration/publish that
  preserves the current valid production credential.

### Security Batch A accepted in source

- Integration commit `97e32503a641c37ff55c0e96806c1cf58af57ae1` applies the preserved Batch A content directly to accepted master
  `b67ae0118b4f8eb85f9de2aaf55c5aad399a7ea6` without importing the old candidate ancestry.
- Source acceptance covers exact Multer 2.2.0, centralized finite multipart limits across 20 upload endpoints,
  controlled bilingual parser failures, authorization-order preservation, and durable storage compensation.
- Validation passed: frozen install; finite multipart and Living Brief matrices; shared-library, API, and full-root
  typecheck; the complete workspace build with the documented PORT setting; semantic lock, diff, encoding, privacy,
  and exact-candidate-content checks. The initial build invocation stopped only because PORT was omitted; already
  passed checks were not rerun, and the unfinished workspace build phase then passed with `PORT=3000`.
- Current registry audit remains 94 records: 0 critical, 41 high, 46 moderate, and 7 low. Multer contributes zero
  remaining records. These counts do not claim SheetJS or Batches B-I were corrected; those batches remain unstarted
  and require separate authorization.
- Remaining boundary: normal push of the integration and acceptance commits plus exact remote ancestry/equality
  verification. No publish, deployment, production/customer access, or external security testing occurred.
- The one persistent UI safety notice remains one visible notice only and is excluded from Telegram.
### Terminal-turn Telegram notification rule

- Every explicitly assigned task work cycle that stops must send one sanitized structured Telegram terminal-turn
  notification immediately before the final response or idle state. This is a return-to-computer alert for Roberto,
  not a claim that the full build is complete.
- Honest status is mandatory: Completed only for genuine completion; otherwise Info, Blocked, Failed, or Needs Input
  with the current outcome and next action. Ready/local-candidate and later Completed notifications are separate
  work cycles with separate EventIds. No duplicate EventId, periodic noise, or silent omission is allowed.

### Temporary owner credential continuity exception

- Roberto has explicitly approved a temporary continuity exception: current working integration credential material
  remains operational and unchanged during ongoing platform development because prior rebuilds repeatedly lost/replaced
  configuration and forced manual re-entry. This is not final launch architecture.
- Until Roberto separately approves launch hardening, no task may rotate, revoke, delete, replace, relocate,
  regenerate, invalidate, print, copy, quote, transmit, test, or change provider/callback/authentication behavior for
  those credentials. No build or correction may require Roberto to re-enter them. Evidence and summaries must remain
  value-blind.
- Public/production launch blocker: separately approved managed-secret migration, durable backup/recovery, controlled
  rotation/revocation as appropriate, callback continuity, rollback proof, history remediation, and independent
  verification. Future credential mutation requires fresh explicit Roberto approval.
- This exception does not weaken the separate Living Brief gate-password durability correction in this candidate.

### Replit publication recovery and verification

- Schema reconciliation `9297740` and clean publish dependency correction `178462e` are accepted and
  pushed. The latter uses the sole workspace override authority, removes all `tar@7.5.11` resolutions,
  resolves the four Electron packaging paths to `tar@7.5.20`, preserves every existing override and
  platform exclusion, and passed frozen install, full production build, and Windows Sync Agent packaging.
- Rejected unpushed Replit checkpoint `0d60d7a` remains evidence only. It displaced the canonical override
  set and introduced unrelated packages/platform binaries; never merge, cherry-pick, or reuse it.
- The pending production preview remains 12 additive `CREATE TABLE` operations: Meeting M4 (2), Finance
  Build 2 (9), and `living_brief_documents` (1). No destructive or existing-column operation is expected,
  but only the actual preview generated after Replit pulls current master can authorize publication.
- Replit's next role is limited to verified pull, capability/state preflight, actual migration preview,
  explicitly approved publish, runtime/mirror/browser verification, and the complete terminal summary.
  It does not perform source edits, lockfile regeneration, Git surgery, or another checkpoint correction.
- The full dependency audit found 94 pre-existing findings (7 low, 47 moderate, 40 high) outside the
  tar-only correction. They remain a separately scoped security workstream with regression evidence.

### Field-acceptance pending: Navisworks v1.60.18

- Frozen 2021 exact-model evidence and final 2025 handoff provenance are verified. Ruben must install the
  exact frozen DLL in Navisworks Manage 2025, run the affected workflow, repeat Pull/Reconcile, save/reopen,
  and confirm physical viewpoints and identities. Until then v1.60.18 is not Completed.

### Approved sequence, not started

- RFI Build 8; Telegram Product Build 6; Plans/Entitlements Step 3; Meeting Minutes M5; Cost & Financial
  Control Build 3. Each requires a new focused latest-master task; none starts automatically.

## Living Brief Freshness Architecture Accepted

- Independently accepted on 2026-07-21 and applied as reviewed content only to clean
  `origin/master` baseline `8022b894bf8650c9a02384f2d187e0f84f476d55`; candidate ancestry was not imported.
  The clean integration commit is the immediate parent of this acceptance record.
- The authority-ordered 11-document catalog now drives validation, deterministic PLATFORM
  generation, the authenticated API, exact database mirror, responsive bilingual UI, Copy Full
  Brief, and export. Arbitrary pasted or database-only doctrine mutation was removed.
- Independent disposable PostgreSQL/API evidence passed 18/18 for exact mirror metadata,
  idempotency, mismatch preservation, observed-hash reconciliation, locking, concurrent source
  change detection, rollback, authentication, restart persistence, privacy, and cleanup.
- Freshness negatives passed 9/9; architecture passed 25/25; desktop English and exact 390px
  Spanish browser evidence showed 11 tabs, 11 copied/exported documents plus manifest, no page
  overflow, and zero console errors. Current Meeting Minutes M4 and Finance Build 2 regressions,
  full typecheck, production build, encoding, privacy, and deterministic generation also passed.
- This acceptance does not claim deployment, publication, production database reconciliation, or
  production browser verification. Those remain controlled later gates. No new Living Brief build
  starts automatically.
- The earlier Ready notification referenced superseded pre-amend commit `a4990da41cf2036fe09f80f03cb7b3db4211bf94`;
  it was disclosed and was not resent.

## Replit Publish / Dependency Incident - Source Correction Closed

- The schema reconciliation is accepted and pushed at `9297740955336971b6aa9b4b120b0f2b6054185c`.
  Replit's subsequent publish failed during dependency installation, before migration or application
  build, because its supply-chain firewall rejected transitive `tar@7.5.11`.
- A rejected Replit-local correction placed a second override authority in root `package.json`.
  That silently dropped the established `pnpm-workspace.yaml` overrides, added unrelated deprecated
  tooling and foreign-platform binaries, and produced a 1,269-line lockfile rewrite. It was not
  pushed or published and must never be reused.
- Clean correction `178462eef6edbde08e2d44efb0a944b812f98480` was built from exact pushed
  baseline `9297740`: `tar: 7.5.20` was added only to the existing workspace override map and the
  lockfile was regenerated with pnpm 10.26.1. The semantic delta is tar-only, frozen install and
  Electron/API/frontend gates passed, and local HEAD was verified equal to `origin/master`.
- Permanent boundary: Codex owns source edits, dependency/lockfile work, Git integration, commits,
  and pushes in clean worktrees. Replit pulls reviewed commits, reports the exact migration preview,
  builds, and publishes only after Roberto approves. Every Replit instruction requires both a
  capability/state preflight and a complete terminal summary.
- The full registry audit on the accepted baseline plus this tar-only correction reports 94
  pre-existing findings (7 low, 47 moderate, 40 high) across packages including XLSX, Electron,
  Express tooling, upload/archive dependencies, and build tooling. The removed `tar@7.5.11` is not
  among the remaining findings. Those findings require a separately scoped dependency-security
  review with behavior/regression evidence; they are not silently bundled into this publish fix.

## Cost & Financial Control Build 2 Accepted

- Independently accepted on 2026-07-21 from candidate `51edf32a106b2b4a82a6f55fe1a7b2de40440fb5`, applied as content only to baseline `a6d3b1916319bfd0f473d9ec9e1978f166f407dc`.
- Clean integration commit: `be42d94`.
- Accepted scope: versioned company cost libraries, project cost structures, exact-decimal budgets, maker-checker workflow, immutable approved snapshots/history, bounded import/export, controlled authorization, and bilingual responsive UI.
- Independent corrections closed changed-payload idempotency conflicts, atomic import confirmation, gross approval exposure for negative offsets, trusted exact-budget confirmation, and complete additive Drizzle schema coverage.
- Real isolated database, authenticated HTTP, concurrency, rollback, append-only, browser, Build 1, Plans/Entitlements, Meeting Minutes M1-M4, Living Brief, typecheck, production build, encoding, privacy, and secret gates passed.
- Retained evidence manifest SHA-256: `7014f75ef182fa78656a536794d4c393ce491a03403baadc302237f01f86e099` (18 retained files, all hashes verified).
- No deployment or publication occurred. Finance Build 3 has not started.

## Mandatory New Task Startup Rule

Every new BIMLog Codex, Claude, or Replit task must start with this repository check:

The BIMLog repo is not in the current mounted project folder. Use the real repo path:
C:\Dev\bimlog
If that path is unavailable, search C:\Dev for a folder containing artifacts, lib, living-brief, package.json, and pnpm-workspace.yaml. Do not proceed until the real repo is mounted.

After the repo is confirmed, read:
- OPEN_LOOP.md
- QUALITY.md
- STATUS.md
- PLATFORM.md
- PLUGIN.md when plugin work is involved
- The real current code being changed

## Operating Rules

- Add any user request here if it will not be finished in the current task.
- Move shipped work to Watching or Closed with commit, version, build, or publish notes.
- Do not mark work complete just because code was written.
- Complete means built, verified, understandable to the user, and not duplicating an existing flow.
- Keep every item specific, testable, and connected to Quality 4.0.
- Before building a new button, tab, export, or workflow, check whether one already exists.
- Duplicate controls are quality defects unless each has a clearly different named purpose.
- Customer requests must be translated into BIMLog architecture, not copied blindly.
- If a task is interrupted, write the exact remaining work here before switching topics.

## Active Now

### Superseded record: Living Brief Freshness Architecture local candidate (accepted above)

- Accepted truth is reconciled through `a6d3b1916319bfd0f473d9ec9e1978f166f407dc`.
- This isolated candidate replaces the mixed disk/database eight-tab implementation with one
  authority-ordered 11-document catalog, cross-platform deterministic source hashes over canonical
  UTF-8/LF text and impact metadata, a
  source-controlled read model, an exact database mirror with controlled reconciliation, and
  responsive bilingual freshness evidence.
- Local implementation and verification do not make this accepted. Required later states remain:
  independent review, clean integration, push, remote verification, publish, deployed source-commit
  configuration, production mirror reconciliation, and production browser verification.
- No production database, Replit publish, customer data, plugin source, DLL, package, or dirty primary
  checkout is part of this candidate.
- Independent local review uses only disposable localhost PostgreSQL. It verifies the exact startup
  migration and authenticated API, all 11 exact source mirrors and metadata, unknown/missing-key
  rejection, mismatch preservation, observed-hash reconciliation, idempotency, advisory-lock
  serialization, concurrent source-change detection, rollback, restart persistence, ordinary-user
  read-only boundaries, admin authority, privacy, and complete cleanup. These results support clean
  integration review but do not claim deployment or production reconciliation.

### Concurrent candidates kept pending

- Navisworks v1.60.18: Pending / Under Review; do not claim accepted or deployed.

### Meeting Minutes M4 Schedule Bucket Links Accepted

- Accepted local candidate `6726240a21d7e23ee4199e906aed32c61f8800a6` was independently reviewed and applied as content only to clean `origin/master` baseline `a6d3b1916319bfd0f473d9ec9e1978f166f407dc`, without importing candidate ancestry. Clean integration commit: `1b8fff74a42ef291dba0a7f0d92f1f5dd5744cf0`.
- Meeting Minutes now creates, opens, and syncs canonical Schedule Buckets from already-linked canonical Submittals. The implementation uses the existing `schedule_buckets`, `project_milestones`, and `schedule_item_placements` architecture rather than a parallel Schedule system.
- Additive relationship tables `meeting_schedule_bucket_links` and `meeting_schedule_task_links` preserve stable traceability across project, meeting, meeting-submittal link, canonical Submittal, Schedule Bucket, and Project Milestone task. Idempotency uses `(project_id, meeting_id, idempotency_key)`. Duplicate protection uses `(meeting_id, bucket_id)`, `(project_id, meeting_id, meeting_submittal_link_id)`, and `(project_id, meeting_id, milestone_id)`, allowing legitimate separate meetings to link the same canonical task while preventing duplicate relationships inside one meeting.
- Independent review corrected the candidate's too-broad milestone uniqueness and corrected existing-task handling so disabling "Link existing tasks" produces a controlled user-review conflict rather than silently linking or duplicating a task. Preview counts now align with actual Create/Link/Update/Skip/Conflict outcomes.
- Create and Sync recheck authentication, project membership, meeting access, linked Submittal access, target bucket access, assignee access, and same-project ownership in transactional writes. Same idempotency key plus the same immutable request returns the same result; changed target, selection, deadline, assignee, or policy returns controlled conflict without mutation. Concurrent Create and Sync converge without duplicate bucket, task, placement, relationship, event, or audit rows.
- Meeting Minutes never creates or mutates canonical Submittals. Sync never silently deletes tasks, overwrites manual task notes, or changes deadlines/assignees unless the user selected the update policy. Pending-action subset is derived from explicit open meeting action data; unknown action state is surfaced as user review.
- Open Schedule Bucket navigates to the exact canonical bucket. Schedule tasks retain canonical Submittal and Meeting traceability. Meeting PDF exports show stored Schedule Bucket create/sync relationship snapshots and preserve historical evidence while legacy manual `DELIVERABLES:` rows remain separate.
- Independent M4 focused proof passed 21/21, including selection, default/custom bucket name, deadline/responsible/target behavior, duplicate and concurrent create, same-key retry, changed-payload conflict, failed-create rollback, Sync create/link/update counts, concurrent Sync convergence, no Submittal mutation, no unauthorized task-note overwrite, exact navigation, separate-meeting same-task linking, link-existing policy conflict, cross-project rejection, export snapshots, privacy/no AI, restart persistence, bilingual responsive UI, and M1/M2/M3 preservation.
- Regressions passed Meeting Minutes M1 17/17, M2 26/26, M3 26/26, Finance Build 1 pure 40/40, Finance DB 9/9, Finance browser, Plans/Entitlements resolver 41/41, catalog DB/API/concurrency, Feature Policy 60/60, Feature Policy browser, and Telegram/Notification Center Build 5 132/132.
- Required validation passed: `git diff --check`, mojibake scan, Living Brief integrity, complete typecheck, and production build. `PLATFORM.md` changed only by build timestamp and was not committed. Isolated cleanup left zero M4 and Telegram Build 5 test identities.
- Sanitized external evidence: `C:\Dev\bimlog-tools\evidence\meeting-minutes-m4-integration\20260721-000000`. Nothing was published or deployed. M5 was not started.

### Meeting Minutes M3 Canonical Clash Links Accepted

- Accepted candidate `683e9c304ac16d59041c973d40d04f97476dda37` was independently reviewed and applied as content only to clean `origin/master` baseline `13f9fe994ed662552c16f028f4ec21c5143071ea`, without importing candidate ancestry. Clean integration commit: `4b68ade86be7aa0ef7eed4435baff12511ffcd1f`.
- Meeting Minutes now links existing canonical same-project Clashes by stable `clash_id`. The additive `meeting_clash_links` table stores `meeting_id`, `clash_id`, project/report identity, current link state, removal metadata, user meeting notes, and immutable meeting-time snapshots for clash number, description, floor, discipline, responsible party, group, status, deadline, and source update time. The unique `(meeting_id, clash_id)` index is the duplicate and concurrency boundary.
- Initial Load Open & Follow-Up imports only eligible Open and Follow Up clashes, excludes Closed, Resolved, Approved, Voided, Superseded, deleted, and inaccessible records, skips existing links, and reports Open/Follow-Up counts. Refresh updates active linked snapshots when canonical status, responsibility, deadline, floor, discipline, or group changes; adds newly eligible clashes; archives links whose source becomes excluded; and never restores a user-removed clash unless explicitly restored.
- Removing a clash changes only the meeting association state. The canonical Clash record is never created, deleted, or mutated from Meeting Minutes. Open Original Clash resolves the current canonical Clash through same-project authorization. Meeting exports use immutable meeting-time snapshots, while legacy manual `VIEWPOINTS:` rows remain readable and exported separately.
- Authenticated project membership, meeting access, Clash access, and exact same-project ownership are rechecked server-side. Cross-project and inaccessible Clashes fail safely. Selector/detail/export payloads exclude attachment contents, raw URLs, storage paths, private audit payloads, credentials, and internal filesystem details.
- Independent M3 focused proof passed 26/26, including Open/Follow-Up loading, all five filters, duplicate/concurrent duplicate protection, concurrent Refresh idempotency, refresh snapshot updates, source-closed archiving, user-removal preservation, explicit restore, Open Original, cross-project rejection, privacy, export snapshots, legacy preservation, reload persistence, and no canonical create/delete. M1 regression passed 17/17 and M2 regression passed 26/26.
- Real browser evidence passed on English desktop and Spanish 390px mobile with no horizontal overflow, no browser exceptions, and no failed API requests. Finance Build 1 regression passed focused, database, and browser checks. Plans/Entitlements regression passed resolver, database/API, and browser checks. Notification Center/Telegram foundation proof and Build 5 regression passed 132/132.
- Required validation passed: `git diff --check`, mojibake scan, Living Brief integrity, complete typecheck, and production build. `PLATFORM.md` was regenerated only by the official production build, not copied from the candidate. Isolated database cleanup left zero M1/M2/M3/Build5 test identities.
- Sanitized external evidence: `C:\Dev\bimlog-tools\evidence\meeting-minutes-m3-integration\20260720-193600`; manifest SHA-256 `9add15111769cf40fd12030071ea5dcd073da8926efd03272de608a8a59b0991`.
- Nothing was published. M4 was not started.

### Cost & Financial Control Build 1 Accepted

- Accepted candidate `67b248fc5f158a5a84d2369ef574883f5d0e334d` was independently reviewed and applied as content only to clean `origin/master` baseline `12f5ab3947b0ebd38eed059ad59a72196674f314`, without importing its older ancestry. Clean integration commit: `893bb0b99e1305fc6d722032094b4e08fd75cc3a`.
- Build 1 establishes only the financial authority and currency-control foundation. Financial Viewer, Cost Preparer, Cost Reviewer, Cost Approver, Financial Administrator, and Auditor are explicit, independent, effective-dated authorities. Existing application roles and Super Administrator status provide no silent financial visibility or approval authority; bootstrap and emergency suspension remain explicit, reason-required, and audited.
- Money uses canonical decimal strings with six-place `BigInt` comparison and `numeric(30,6)` persistence. ISO currencies are validated, mixed-currency comparison and conversion are denied, and approval policies match exact company/project scope, category, currency, effective dates, and amount limits. Maker/checker separation, revoked/expired grants, missing limits, related-request review signals, and company/project suspension all fail closed.
- Additive tables `financial_context_versions`, `financial_authority_grants`, `financial_authority_revocations`, `financial_approval_policy_versions`, `financial_suspension_events`, and `financial_authority_journal` retain immutable history. Database triggers reject ordinary update and delete on every table. Concurrent context and policy writes serialize to distinct versions; stale in-place rewrites are rejected.
- The canonical entitlement resolver remains a separate required advisory gate and cannot authorize financial execution. The bilingual Settings → Financial Controls interface exposes only the current user's redacted effective state unless an explicit Financial Administrator or Auditor grant permits more. No budget, contract, commitment, Cost Event, forecast, payment application, ERP synchronization, financial AI, accounting posting, or money movement was added.
- Independent Finance evidence passed 40/40 focused checks, 9/9 disposable PostgreSQL checks, 17/17 authenticated HTTP/concurrency/atomicity checks, and 6/6 English desktop/Spanish 390px browser checks. Review corrected only a missing effective timestamp in the browser evidence fixture; production behavior was unchanged.
- Focused regressions passed Plans/Entitlements 60/60, Meeting Minutes M1 17/17, Meeting Minutes M2 26/26, Telegram product foundation proof, and Notification Center 4/4. Required `git diff --check`, mojibake, Living Brief, final typecheck, production build, exact-decimal, additive-migration, privacy, boundary, and preservation checks passed.
- Sanitized external evidence: `C:\Dev\bimlog-tools\evidence\cost-financial-control-build-1-integration\20260720T223125Z`; manifest SHA-256 `9fcc9db9dc589b5a67a79db4c299754f197dd0df5da3ad63cddb4cc011c1c71e`. Candidate evidence hashes were verified; its redacted disposable connection line was not propagated into integration evidence.
- Nothing was published or deployed. Finance Build 2 was not started, and the active Navisworks work was not modified.

### Meeting Minutes M2 Existing Project Submittal Links Accepted

- Accepted candidate `9f05f20e7577a9010469ff0eee237707e59690f2` was independently reviewed and applied as content only to clean `origin/master` baseline `801244388d9d7c9ef9cbcd25a20fc21d697fdd53`, without importing candidate ancestry. Clean integration commit: `f4bcc37f39fa638e55db0ad5c318afcc5dea0516`.
- Meeting Minutes now selects one or more existing same-project Submittal Log records by stable record ID. The bilingual selector searches number, title, and description; filters floor/area, discipline/trade, status, and responsible person/company; identifies already-linked rows; and excludes attachments, storage paths, raw URLs, private file metadata, unrelated participant details, and audit payloads.
- Additive `meeting_submittal_links` stores canonical `submittal_id` plus immutable meeting-time snapshots for number, title, description, floor, discipline, discipline bucket, status, responsible party, and deadline. The unique `(meeting_id, submittal_id)` index is the concurrency boundary. Later canonical edits never silently refresh meeting rows; Open Original Submittal resolves the current accessible canonical record.
- Discipline mapping is explicit: Plumbing, HVAC/Mechanical, Fire Protection/Fire Suppression/Sprinkler, and Electrical populate only their corresponding status column; a real non-empty unmapped trade uses Other; missing trade with a generic Submittal type populates no discipline status column. No unrelated status is fabricated.
- Authenticated project membership is required for reads. Mutations additionally require configured admin/write permission and revalidate the meeting, non-deleted Submittal, and exact same-project ownership. Cross-project, deleted, inaccessible, and unauthorized identities fail safely. Unlinking removes only the association; Meeting Minutes contains no Submittal creation or canonical mutation path.
- Existing manual `DELIVERABLES` notes remain unchanged and render separately as legacy rows. Meeting PDF exports render immutable link snapshots, while the original-record deep link opens current canonical data. Draft values do not refresh automatically or invisibly.
- Independent M2 API/database proof passed 26/26, including combined filters, multi-select, duplicate/concurrent convergence, authorization, snapshot preservation, parsed-PDF export truth, unlink integrity, legacy preservation, privacy, reload, and zero new Submittals. M1 regression proof passed 17/17. Fresh English desktop and Spanish 390px browser evidence passed with no exceptions or horizontal overflow.
- Required validation passed: `git diff --check`, mojibake scan, Living Brief integrity, typecheck, and `$env:PORT='3000'; pnpm run build`. Sanitized evidence: `C:\Dev\bimlog-tools\evidence\meeting-minutes-m2\20260720-180745`; manifest SHA-256 `8d587a73ee5d619b05b48de93e0e088033df970c31301201eb86d3b0994a04a5`. Evidence privacy scanning found zero matches and isolated cleanup left zero test identities.
- Nothing was published. M3 and M4 were not started.

### Meeting Minutes M1 Existing Project RFI Links Accepted

- Accepted candidate `447ea95e8f389ea1600cc2c834ab273354cf4f8d` was independently reviewed and applied as content only to clean `origin/master` baseline `d4862ad6b1d13ac49972561cc8c99916f7dc15e9`, without importing its older ancestry. Clean integration commit: `b1913aa5ed70e46f900f0dd4facc16030be78bf8`.
- Meeting Minutes now selects one or more existing same-project RFIs by stable record ID. The selector searches number, title, description, and question; displays number, title/description, status, and responsible/ball-in-court; identifies already-linked rows; and exposes no attachment, storage, raw URL, or private audit payloads.
- `meeting_rfi_links` is additive and preserves immutable meeting-time number, title, description, status, and responsible snapshots beside canonical `rfi_id`. The unique `(meeting_id, rfi_id)` index is the concurrency boundary. Later RFI edits do not silently rewrite saved meeting history; Open Original RFI resolves the current canonical record.
- Authenticated project membership is required for reads. Write routes also require configured admin/write permission. Meeting existence, non-deleted RFI existence, and exact same-project identity are revalidated server-side; inaccessible and cross-project identities fail without enumeration. Removing a link deletes only the association and never updates or deletes the RFI.
- Existing pipe-delimited manual RFI rows remain untouched in `meeting_minutes.notes` and are rendered as legacy text. There is no destructive migration, silent conversion, RFI creation path, or original-RFI mutation in Meeting Minutes.
- Independent review corrected cross-search multi-select caching and removed fallback database credentials from the focused proof. Final focused API/database proof passed 17/17, including number/description search, multi-select, duplicates, concurrent requests, authorization, cross-project rejection, unlink integrity, legacy preservation, Open Original, and reload persistence. Real English desktop and Spanish 390px browser evidence passed with no selector overflow or browser exceptions.
- Required validation passed: `git diff --check`, mojibake scan, Living Brief integrity, typecheck, and `$env:PORT='3000'; pnpm run build`. External sanitized evidence: `C:\Dev\bimlog-tools\evidence\meeting-minutes-m1\20260720-154857`; manifest SHA-256 `48a07d3aeb1b5f06e5bcd7421bcb2ad8bc7ada11308ce53a1c20b3b70305c105`.
- Nothing was published. Meetings M2, M3, and M4 were not started.

### Shop Drawing Control Filter Hotfix Accepted

- Accepted candidate `8c2e5709cf18f977d653bece5d6625d416ef46eb` was independently reviewed and applied as content only to clean `origin/master` baseline `c13d9044513169ff61816f8e598197c25334981e`, without importing its older ancestry. Clean integration commit: `02e3f773e2ed796dde3567a0170f3f399f863c69`.
- Shop Drawing Control Building Level, Trade, and Drawing Type filters now normalize case, whitespace, punctuation, underscores, and approved aliases for comparison only. Clean human-readable labels are preserved, persisted customer data is not rewritten, and Building Level uses configured project levels plus actual submittal rows.
- UI visible rows and PDF/Excel tracker exports use the same filter semantics. The focused fixture proves All restores every record, combined filters return only matching rows, zero-result filters remain empty, Sleeve includes Sleeve/Sleeve V/Sleeve H, and HVAC, Plumbing, Electrical, Fire Protection, Architectural, Shop Drawing, Sleeve V, Sleeve H, and Product Data variants filter correctly.
- Repository evidence JSON from the candidate was excluded. Final sanitized evidence was regenerated outside the repository at `C:\Dev\bimlog-tools\evidence\shop-drawing-filter-hotfix\2026-07-20T19-11-22-382Z`; manifest SHA-256 `c5db85acda7e67fbc8631bc9f42b388007e9fb00a2956ba8696787b285f2640e`.
- Focused validation passed: filter proof, `git diff --check`, mojibake scan, Living Brief integrity, typecheck, and production build. Nothing was published.

### Plans, Entitlements & Feature Controls - Step 1 Accepted

- Accepted source commit `35b01ae7ce80344fae13550b36ca8353ad643901` was cleanly applied to `origin/master` baseline `2d57aaff7c58e27cb0b1e8290375c5d7f4be2543` without importing its older branch ancestry. Integration commit: `0e73ba0aaa29c4d4f5de023aa25caeceb435f1da`.
- Added the versioned canonical feature catalog, append-only activation/platform/audit journals, and an authenticated advisory entitlement resolver. Public decisions are read-only and cannot authorize execution; arbitrary query parameters cannot satisfy confirmation requirements.
- Seat classes remain separate from scoped project roles. Current Project Admin, Convention Manager, Discipline Lead, Member, Sub-trade, and Read Only roles plus bounded legacy `admin`/`viewer` aliases map through canonical authorities. Permission metadata may restrict but never broaden authority; inactive, missing, and unknown roles deny safely.
- Company-scoped evaluation rechecks the authenticated user's current database company association. Per-feature transaction locking serializes concurrent platform capability versions. Catalog corrections supersede with later immutable versions rather than altering history.
- The truthful initial catalog contains 10 available, 7 coming-later, and 2 preview entries. Deterministic notifications and Concierge Assist remain coming later. File reading is a confirmation-gated control classification and does not grant universal execution.
- Final isolated validation passed 41 pure resolver checks, 21 real PostgreSQL checks, 34 authenticated HTTP checks, and 4 concurrency checks, including 20 simultaneous writes producing unique ordered versions 1-20. Sanitized integration evidence remains external at `C:\Dev\bimlog-tools\evidence\plans-entitlements-step1-integration\20260716T193426Z`; manifest SHA-256 `e2ae5a315de45fdaaf4cc10343538e4ad88be7efde3662c19fec3fa08f04b025`. No evidence files are committed to the product repository.
- Step 2 remains deferred and was not started. Subscription, seat assignment, add-on, trial, contract, allowance, downgrade, pricing, checkout, invoice, and payment-provider authorities require separate approval and implementation.

### Plans, Entitlements & Feature Controls - Step 2 Accepted

- Accepted source commit `67c6c663e09d2820be729b1f52878f3ed979c368` was independently reviewed and applied as content only to current `origin/master` baseline `a6f76909aa011aa45f2e0dbde39890e083630f97`, without importing its older ancestry. Clean integration commit: `a475a5bd1dabc6e54a9d659ddf09da7985ce21c8`.
- Added explicit company/project/user policy controls, three-state user preferences (`Use Default / Inherit`, `On`, `Off`), separately displayed effective results, bounded bilingual administrative reasons, current-authority revalidation, ordinary-user redaction, and an explicit reviewed support matrix for all 19 catalog features. The matrix has no permissive default-to-true behavior.
- Project-company ownership is an explicit serialized, versioned, append-only journal. Creator company changes do not alter the binding; legacy reads do not silently backfill; unbound policy mutation returns `PROJECT_COMPANY_BINDING_REQUIRED`; authorized binding/rebinding requires bounded evidence. Historical entity identifiers remain immutable scalar audit facts without lifecycle-blocking parent foreign keys, so ordinary project/company/user deletion does not delete historical evidence. Append-only triggers and cross-company denial remain intact, and no destructive migration was introduced.
- Telegram Build 3 focused parity review compared `telegram-product-provider-broker.ts`, `telegram-product.ts`, Telegram product routes, Telegram conversation schema, and the Build 3 evidence script against `origin/master`; all five were byte-identical. `app.ts` adds only Step 2 policy initialization while preserving the existing Telegram conversation, notification, recovery, and worker initialization exactly once. Profile retains both the Build 5 compact `NotificationPreferenceCenter` and the Step 2 `FeaturePolicySettingsPanel`.
- **KNOWN NONDETERMINISTIC TELEGRAM BUILD 3 HARNESS TIMING EXCEPTION — NO STEP 2 PRODUCT REGRESSION PROVEN.** The first complete harness attempt passed 29 checks before the restart-accountability checkpoint observed the queued continuation as `processed` without its delivery message ID settling inside the polling window. Existing delivered-message identity and attempt count remained unchanged, support lifecycle and AI settled/failed state persisted, and no duplicate charge or false delivery was observed. The single clean rerun passed 18 checks before the combined English multi-turn observation checkpoint returned false after its short queue-drain timing window; that failed assertion produced no evidence of cross-user exposure, duplicate charge, false delivery, lost persisted state, failed restart persistence, or a production-source exception. Neither failed checkpoint is claimed as passed, and the full Build 3 suite was not run a third time.
- Reused independent validation: Step 2 policy/API 60/60; real desktop/mobile browser 9/9; Step 1 resolver 41/41, database 21/21, authenticated HTTP 34/34, and concurrency 4/4; Navisworks contract 15/15 and corrected authenticated API rerun 68/68; Telegram Build 4 79/79; Telegram Build 5 132/132; focused RFI Build 7 15/15. Diff, mojibake, Living Brief, typecheck, production build, privacy, secret, destructive-migration, silent-catch, and permissive-default checks passed.
- Sanitized external evidence: `C:\Dev\bimlog-tools\evidence\plans-entitlements-step2-integration\20260717T014000Z`; manifest SHA-256 `6121cf523f4b5e7246bd6b61dfa5bfc5091ef6e186622430fd754a439c9dde8c`. Nothing was published. Step 3, Finance Build 1, RFI Build 8, and Telegram Build 6 were not started.

### Telegram Product Implementation 2 - AI Control Plane

- Independent review found the candidate AI control plane acceptable only after adding explicit provider-failure accounting and retry conflict checks. Failed provider requests now record a single zero-cost failure receipt, release any reservation, mark the run `failed`, and reject retried failure/settlement callbacks that reuse the same run with different details.
- Clean integration scope: secure provider connections, effective-dated price/entitlement policy, company budgets, user allocations, estimates, explicit confirmations, separate file-reading confirmation, reservations, cancellation, settlement, failure, append-only cost receipts, authenticated management routes, and the Profile/Project AI control panels.
- The correction explicitly tightens provider-management authorization, blocks pending/rotated key activation without validation, scopes budget/allocation responses by role, applies corrections to budget and allocation ledgers, and supersedes versioned policies instead of silently choosing ambiguous active rows.
- Integration evidence is stored under `C:\Dev\bimlog-tools\evidence\telegram-product-build-2-review`; the final reviewed run records behavior, authenticated HTTP, browser-role/source checks, Telegram Build 1 identity/link regression proof, validation commands, and sanitized hashes.
- Build 2 was cleanly integrated from `origin/master` at `6919765be8c7cd3f0042fa62b4283d4862210181` without Navisworks/plugin, RFI, generated mockup, or generated PLATFORM.md changes. Nothing was published, and Product Build 3 was not started.
- Legacy plaintext values in `users.openai_api_key` and AI rows in `user_connections.credentials` were preserved non-destructively. New plaintext writes are blocked; a separately reviewed migration/retirement plan is still required before those legacy columns or rows can be removed.
- Existing AI generation call sites remain on the legacy usage path. A later build must integrate each call site with estimate, explicit confirmation, reservation, broker execution, provider-reported settlement, and receipt display. No conversation or file-reading execution was added here.
- No real provider generation occurred. Production KEK provisioning, provider credentials, budget/pricing policy, production migration, live Telegram webhook configuration, customer messaging, file delivery, publish, and rollout remain explicitly out of scope.

### Telegram Product Implementation 1

- Starting commit: `18256153fe9c82ac149bfca53d9909a0c63d99c8`. Rejected local commit `2e10a1c` is being corrected locally and must not be pushed.
- Corrected source scope: channel-linking only. No RFI/Submittal notification delivery, assistant, AI, file-reading, delivery workflow, live webhook registration, production secret change, publish, or notifier completion was performed.
- Added additive schema/startup migrations for `notification_channels`, `channel_linking_tokens`, `notification_preferences`, `consent_records`, and `telegram_inbound_updates`; linking tokens now store accepted consent version and purpose `channel_linking`.
- Browser Profile now requires explicit unchecked consent before creating a Telegram link. The request must include `consentAccepted: true`, the exact current consent version, and purpose `channel_linking`.
- Telegram preferences start disabled with empty topics. The bot says the BIMLog channel is connected, not that active RFI/Submittal notifications are enabled.
- Webhook behavior now stores a durable inbound receipt first, returns 200 after receipt, treats duplicate adapter/update IDs as safe, and processes from the recoverable inbound-update table outside the acknowledgement path. Startup recovery processes durable `received` rows.
- Identity conflict handling rejects active Telegram identity reassignment to a different BIMLog user instead of silently revoking another user's link. Browser and Telegram disconnect now use one canonical transactional revocation path.
- Profile and deterministic bot responses have reviewed English/Spanish text with UTF-8 accents. Source scans reject `espanol`, `ingles`, `estan`, `task_notifications`, default enabled RFI/Submittal Telegram topics, duplicate disconnect implementations, webhook payload logging, TODO/mock behavior, and destructive migrations.
- Local source gates passed after correction: `git diff --check`, `pnpm run check:mojibake`, `pnpm run check:living-brief`, `pnpm run typecheck`, `$env:PORT='3000'; pnpm run build`, and `pnpm --filter @workspace/api-server exec tsx scripts/telegram-product-proof.ts`.
- Behavior evidence passed against a fresh disposable PostgreSQL 18 database on `127.0.0.1:55433`; the temporary server was stopped after the run. The final runner exited 0 and recorded all consent, token, duplicate-update, adapter/secret rejection, private-chat, concurrent-consumption, identity-conflict, disconnect, restart-recovery, UTF-8, status-privacy, and disabled-topic gates at `C:\Dev\bimlog-tools\evidence\telegram-product-implementation-1\20260714-141736\behavior-results.json`.
- Review status: corrected implementation and local evidence are complete; awaiting independent review. Not self-accepted, not pushed, and not published.

### Canonical RFI Workflow and Complete Issued RFI Package

Purpose: eliminate the divergent New RFI, viewpoint-created RFI, existing RFI, sent RFI,
closed RFI, and reopened RFI experiences. BIMLog records and audits human decisions; it must
not impose one-RFI-per-viewpoint behavior or block authorized users from editing/reopening a
record merely because its status changed.

Canonical platform requirements:
- One numbered 1-7 field structure and one field contract across every RFI state and entry path.
- New, viewpoint-created, existing, sent, closed, revised, and reopened RFIs expose the same
  applicable fields. Titles and state styling may differ; field meaning and edit behavior may not.
- Authorized users can edit every RFI state. Close/reopen/edit actions must be explicit and logged.
- Date Required must be editable and persist in every applicable state.
- Section 4 is always Reference Information / Attachments. Add Reference must immediately show
  the value, allow removal, preserve human-readable names, and save through every create/edit path.
- A viewpoint screenshot is an attachment, not a special alternate RFI layout. The user can
  show/hide it in the issued RFI, replace it, and crop it non-destructively while preserving the
  original evidence file.
- Users can capture or paste a screenshot and crop it with a snipping-tool-style workflow before
  attaching it to the RFI.
- Section 5 is question-only. AI question assistance is click-driven, credit-visible, and never
  reads attachments unless the user explicitly invokes file-reading AI.
- Section 6 keeps each impact choice directly beside its dependent fields. Cost Amount and Cost
  Reason belong with Cost Impact. Calendar Days and Schedule Reason belong with Schedule Impact.
  The same values must persist through create, duplicate-number retry, edit, response, PDF, DOCX,
  Excel/log output, activity history, and audit output.
- Section 7 contains distribution, email, and responses. Generated email has an explicit Copy
  action with visible success feedback. Text-only email AI remains click-driven and does not read files.
- Existing/sent/closed/reopened state must be unmistakable without turning informational labels
  into buttons. Use the shared primary/secondary/danger button hierarchy and remove duplicate controls.
- Preserve attachments, linked items, ball-in-court history, responses, Jump to Viewpoint, Raise
  Change Order, exports, audit, and AI text assistance while unifying the presentation.

Viewpoint relationship and plugin-facing requirements:
- One viewpoint may source any number of RFIs for different questions, disciplines, companies,
  or recipients. `source_viewpoint_id` is lineage, not a uniqueness key.
- Repeated POSTs to the existing `.../rfis/from-viewpoint` contract with the same viewpoint ID
  must create separate RFI records, separate sequential RFI numbers, and separately linked evidence.
- Diagnose the current plugin failure from the exact HTTP status/body and plugin debug log. Do not
  invent a second RFI endpoint or remove the project-mismatch guard.
- The platform endpoint and plugin must show actionable errors instead of `Failed to create RFI.
  Check connection.` when the server returned a more specific cause.

Complete issued-RFI PDF package:
- The final RFI export is one complete PDF containing the BIMLog RFI pages followed by all selected
  supporting documents in deliberate user-controlled order.
- Original PDF attachments must be copied as native PDF pages. Preserve MediaBox, CropBox, page
  rotation/orientation, vector content, and native sizes including 36x48, 24x36, and 11x17.
- Mixed page sizes inside one RFI package are valid. Never shrink drawings to Letter, stretch them,
  crop them, or rasterize them.
- Word, DOCX, Excel, and image attachments require an explicit conversion path that preserves the
  original page/sheet presentation as closely as the source format allows. Conversion failure must
  be visible and must not silently omit an attachment.
- The user selects which attachments appear in the issued package and whether the viewpoint image
  appears. The export must clearly report any attachment that cannot be converted or merged.

Verification required before customer retest:
- Compare all RFI entry/state variants side by side and prove the 1-7 structure and field contract match.
- Create at least two RFIs from the same viewpoint and prove both remain independently editable.
- Verify show/hide/crop screenshot behavior and preservation of the original image.
- Generate a mixed-size PDF package and inspect page boxes and vector preservation, including the
  supplied real River Avenue RFI PDF when available.
- Run behavior checks, `pnpm run check:mojibake`, `pnpm run typecheck`, and the production build.
- Update this register with commit, push, publish, package, and Roberto/customer verification status.

2026-07-13 focused RFI pass:
- Completed: preserved `rfis.cost_impact_reason`, `rfis.schedule_impact_reason`,
  `rfi_responses.cost_impact_reason`, and `rfi_responses.schedule_impact_reason` in the Drizzle
  schemas and confirmed startup migrations remain additive `ADD COLUMN IF NOT EXISTS`; verified
  feedback_items indexes still match the idempotent migration.
- Completed: fixed Section 6 Cost Increase TBD handling so the Cost Reason / Explanation field is
  visible and saved without requiring a cost amount on new RFI, duplicate-number retry payload,
  existing RFI edit, and official response save.
- Completed: normalized official response impact writes so no-impact/TBD paths do not preserve
  stale cost amount, schedule days, or reason values.
- Completed: confirmed `source_viewpoint_id` remains non-unique lineage only and the
  `from-viewpoint` route has no duplicate-prevention check; storage uses unique physical filenames
  for repeated screenshot uploads.
- Completed: removed the silent viewpoint-prefill catch by logging a traceable server message while
  still allowing RFI creation to continue.
- Verification: `pnpm run check:mojibake` passed, `pnpm run typecheck` passed, and
  `$env:PORT='3000'; pnpm run build` passed after rerun with filesystem approval for Vite cache
  writes under the real repo.
- Deferred: browser screenshot crop tools, complete issued-RFI PDF package/native PDF page-copy,
  Word/DOCX/Excel/image conversion verification, River Avenue page-box comparison, and authenticated
  repeated-viewpoint HTTP proof still require the larger RFI package implementation/test harness.

2026-07-13 RFI Build 1A Correction 3:
- Completed: removed the unreachable always-true create/detail shortcuts and deleted the obsolete duplicate New RFI and Existing RFI field markup after moving support controls into the reachable canonical path.
- Completed: kept Add Reference, clean attachment labels, local file upload, image upload/paste/capture review, cloud attachments, package inclusion, question AI, email AI, Copy Email, exports, response save, viewed-by, ball-in-court, jump-viewpoint, and change-order actions reachable from the canonical RFI structure.
- Completed: detail edit now persists priority, drawing number/title, spec section, detail number, note number, and location through the canonical adapter instead of discarding edits. Submitted To address/phone are read-only unless real values exist because the current API save path does not support editing them.
- Verification: `git diff --check` passed with only a pre-existing line-ending warning on the mockup generated file, `pnpm run check:mojibake` passed, `pnpm run typecheck` passed, and `$env:PORT='3000'; pnpm run build` passed after filesystem approval for Vite temp/cache writes.
- Still open for independent Build 1B review: no browser visual acceptance was claimed; dedicated visual crop tooling and the larger complete issued-RFI PDF package work remain deferred above.
- PDF fixture note: local `pdfinfo`, `pypdf`, and resolvable `pdfjs-dist` were unavailable in this
  environment during this pass, so River Avenue page boxes were not programmatically recorded here.
- Publish status: not published.

2026-07-13 RFI Build 1A Correction 4:
- Corrective status: implementation and local Source Gate evidence only. Build 1A remains unaccepted pending independent review; Build 1B was not started and the application was not published.
- Completed: the single production `RfiCanonicalForm` now owns placement for saved-RFI actions and specialized Section 1, 4, 6, and 7 behavior. No fallback or duplicate 1-7 field form was restored.
- Completed: Section 1 visibly restores current ball in court, custody history, activity timeline, and the Viewed By results panel. Section 4 restores linked items, project-file selection, source-viewpoint evidence, interactive package include/order controls, image include/exclude, and saved-crop preservation/reset. Section 6 shows latest confirmed response impacts.
- Completed: Section 7 restores manual Mark as Sent, connected SendGrid delivery and setup guidance, existing responses and clean attachment names, explicit Add Response, local/cloud/project-file response attachments, response AI text assist, Answered By, response cost/schedule accountability fields, closing status, and one Save Response action at the bottom of the response form.
- Completed: the visible Create Revision action now uses the real linked-revision API mutation and audit path. The obsolete preload/create pseudo-revision path and disconnected legacy `.doc` generator were removed.
- Completed: saved RFI actions are passed through `savedRfiActions`; `RfiActionBar` omits any action without a real handler. New viewpoint-prefilled RFIs cannot render Jump to Viewpoint without a handler, while saved RFIs retain the existing local jump handler.
- Completed: New RFI restores project-directory pickers, project-file references, and explicit higher-cost AI file reading with a confirmation warning. Text-only question/email/response AI remains click-driven and states that attachments are not read.
- Source cleanup: the focused definition-only scan found no local constant, state setter, handler, ref, or helper function occurring only at its declaration after correction.
- Local verification: `git diff --check`, `pnpm run check:mojibake`, `pnpm run typecheck`, and `$env:PORT='3000'; pnpm run build` passed. The first sandboxed build attempt was blocked by Vite temp-file permissions; the approved rerun passed. Independent browser behavior and visual acceptance remain required before Build 1A can be accepted.

2026-07-13 Build 1 - Canonical RFI UI:
- Scope: browser UI only for the canonical RFI 1-7 structure. No export routes, PDF/DOCX/Audit
  PDF/Complete PDF generation, Office conversion, plugin code, production data, environment,
  services, or database behavior were changed.
- Completed: widened the RFI create/detail containers to use desktop content width more
  responsibly and removed the narrow floating form presentation shown in rejection screenshots.
- Completed: existing RFI detail now separates Section 3 Submitted To from Section 2 Submitted By
  with its own visible section header instead of rendering "3. Submitted To" inside the Section 2
  card.
- Completed: removed the fake numeric crop UI and the predetermined 10 percent crop action from
  browser RFI controls. Existing saved crop metadata is preserved and can be cleared, but real
  visual crop tooling remains a later gated build.
- Completed: Section 4 keeps references, attachments, viewpoint preview, package include/exclude,
  and package order controls together. Section 5 remains question and AI question assist. Section 6
  keeps cost/schedule conditionals with their related fields. Section 7 keeps distribution, email,
  Copy Email, and responses together.
- Screenshot evidence generated at desktop viewport:
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\new-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\viewpoint-created-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\existing-draft-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\sent-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\closed-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\reopened-rfi.png`
- Deferred: export quality changes and real snipping-tool-style visual crop implementation remain
  for later gated builds. The screenshots are deterministic UI acceptance evidence, not a publish
  or production-data verification.

### Platform-Wide Report Design System

Shipped first implementation scope on 2026-07-10:
- Central module/variant theme registry in `artifacts/api-server/src/lib/pdf-kit.ts`.
- Schedule Calendar, Board, and List PDF variants.
- RFI detail and audit PDF variants, with RFI DOCX/log variants reserved in the registry.
- Lens Coordination PDF family and reserved Lens register/audit variants.
- Submittal detail and audit PDF variants, with log/Shop Drawing Control variants reserved.
- Modified PDF title/download filenames aligned; Schedule export controls distinguish configuration from generation.
- Full route/control inventory recorded in `living-brief/REPORT_DESIGN_SYSTEM.md`.

Intentionally deferred to the next report-standardization round:
- Shipped in Phase 2: reserved families are now active for Transmittals, Change Orders, Meetings, Files/CVR, Clash Reports, the general Reports catalog, Submittal Log, Shop Drawing Control, and imported Submittal Tracking reports.
- Shipped in Phase 2: removed the broken individual Meeting PDF control; clarified individual Transmittal/Change Order and Lens PDF/Excel labels.
- Remaining: migrate the longest legacy detail/audit layouts onto shared table/page-break primitives where they still require route-specific construction-document sections.
- Remaining: add authenticated production-data visual regression fixtures for every export route; Phase 2 uses deterministic multi-page fixtures plus typecheck/build verification.

### Submittals / Shop Drawing Control Field Test
Shipped baseline: commit 94c9c4b - Unify submittals shop drawing control.

Watch for:
- Ruben importing his real Shop Drawing Control Excel.
- Drawing Type filters, especially Sleeve / Sleeve V / Sleeve H.
- Trade filter behavior.
- Building Level source and imported row levels.
- Whether Register vs Submittal Packages vs Shop Drawing Control is clear to users.
- Whether exports match Ruben's operational Excel expectations.

Open design issue:
- BIMLog needs two connected worlds, not one confused Submittal bucket:
  - Shop Drawing Control: coordination deliverables, drawing packages, floors, trades, review status, RFI links.
  - Submittal Packages: equipment/material/product/documentation packages, approvals, warranties, O&M, final handover records.
- These worlds must cross-link where a shop drawing depends on an equipment/material submittal package.

## Ready Next

### RFI Unfinished Work
Purpose: finish the RFI handover items without creating a second disconnected RFI workflow.

Open items:
- Cloud file pickers and OAuth environment follow-up from RFI_HANDOVER.md.
- RFI attachment/file handling and generic binary download route for uploaded files.
- RFI impact layout, save unification, configurable RFI types, and numbering cleanup.
- RFI AI assist must stay split between low-cost text/email drafting and explicit-cost file reading.
- Cross-module links from RFIs must persist through the existing linked-items model, not a duplicate relationship system.

### Navisworks Plugin Two-Way Status Sync
Purpose: reduce web/plugin round-trips for status changes.

Known requests:
- Ruben wants to change Lens viewpoint status from the plugin.
- Ruben asked whether moving a viewpoint into a folder such as Resolved should update the platform.
- The plugin must not guess silently. If folder movement is supported, it must be explicit, logged, and reversible.

Guardrails:
- Read BIMLogLensPanel.cs and BIMLogApiClient.cs in full before editing.
- Understand all Lens buttons first: Save Viewpoint(s), Sync with BIMLog, Pull from Platform, Create RFI from Viewpoint, Load Selected Viewpoint, Done Managing Viewpoints, Reconcile/Cleanup.
- Protect non-BIMLog folders such as LEVELS.
- Protect against wrong-project sync. The plugin should clearly show the selected BIMLog project and warn before syncing if the Navisworks model/project context appears mismatched.
- Old dated BIMLog folders must be recognized for migration, but the final operational tree should be simple.

### BIMLog Feedback Widget
Purpose: replace Replit's feedback widget with BIMLog's own feedback/report-bug widget.

Requirements:
- No Replit branding.
- Available across the authenticated app.
- Capture page URL, project id when present, user id/email, category, severity, message, optional screenshot/file.
- Super admin can review submitted feedback.
- Should feed the Open Loop process instead of becoming lost chat context.

### Domain / Replit Branding Follow-Ups
Purpose: remove deployment confusion and keep BIMLog branding/customer paths clean.

Open items:
- Confirm bimlog.app and www.bimlog.app production behavior after DNS/certificate propagation.
- Keep old Replit URLs out of user-facing source, OAuth callback docs, reports, and emails.
- Clearly label future release notes as committed/pushed, needs publish, or live verified.
- Do not publish from this task.

### Lens Excel Custom Report
Purpose: satisfy Ruben's request for a customized Lens Excel export with a report-style summary.

Required behavior:
- Keep the existing raw export.
- Add a configurable report export with a summary/pivot-style worksheet.
- Include filters and layout similar to Ruben's manual Excel customization.
- Export should be useful to send directly to clients without manual cleanup.

### Platform-Wide Duplicate Control Cleanup
Purpose: remove repeated buttons and confusing duplicate controls.

Known issue:
- Pages often show multiple Export PDF / Export Excel buttons that appear identical.

Rule:
- If two buttons do the same thing, keep one.
- If two buttons export different scopes, name them by scope and add hover help.
- This is a Quality 4.0 defect category, not cosmetic polish.

### Mojibake / QUALITY.md Enforcement
Purpose: keep Living Brief, UI text, reports, emails, and exports clean UTF-8.

Open items:
- Run `pnpm run check:mojibake` before production builds, publish prompts, and release handoffs.
- Treat user-facing mojibake as a release blocker.
- Enforce QUALITY.md rules: spreadsheet-simple UI, connected data, no duplicate controls, clear ownership, audit-ready output.
- Do not fix corrupted text by deleting valid Spanish; repair the encoding/source.

### AI Usage / Cost Controls
Purpose: make AI useful without surprising BIMLog or customers with hidden cost.

Current policy direction:
- Roberto/internal accounts can use the platform-managed Anthropic/Replit model path.
- External users should eventually use included quotas, managed paid tiers, or their own AI keys depending on product tier.
- Low-cost AI assist (description/email drafting) should be separate from high-cost file reading.
- Heavy AI file reading must show a clear warning before use.
- AI usage must be visible to the user and to super admin by user, project, feature, billing mode, and time period.

## Watching

### RFI Create/Detail UX + Complete PDF Package
Shipped commit: this RFI quality-pass commit - Finish RFI detail UX and complete PDF export.

What changed in this pass:
- Existing RFIs now expose the same numbered 1-7 structure as New RFI.
- Sent and closed RFIs remain editable for authorized users.
- Closed RFIs use an explicit Reopen RFI action instead of masquerading as a revision.
- Existing RFI edit now persists Date Required and Submitted By address/phone with the rest of the canonical RFI fields.
- Complete RFI PDF export is a distinct action and route.
- Complete RFI PDF copies uploaded PDF attachment pages as native PDF pages via pdf-lib, preserving page boxes/rotation/vector/text as provided by the source PDF.
- Complete RFI PDF converts image attachments to PDF pages with aspect ratio preserved.
- Complete RFI PDF fails explicitly when a DOC/DOCX/XLS/XLSX or unsupported attachment needs a converter that is unavailable in the runtime.

Local proof completed:
- River Avenue source PDF was copied into a package after BIMLog-generated cover pages and before a manifest page.
- River Avenue source page MediaBox, CropBox, rotation, native width/height, and displayed orientation matched the merged package pages.
- River Avenue source file size and modification timestamp were unchanged after the native-copy test.
- Local LibreOffice conversion fixtures passed: DOC, DOCX portrait, DOCX landscape, XLS, and XLSX multi-sheet all converted to PDF pages; corrupt DOCX is rejected before conversion.
- Image package rendering primitive passed for include, exclude, and crop/reset PDF generation.

Continuation added after f1ad6f7:
- RFI records now persist `attachment_package_json` and `image_presentation_json`.
- Existing RFI Section 4 can include/exclude package attachments and reorder the Complete RFI PDF package.
- Viewpoint/image presentation state supports include/exclude, replacement image, crop metadata, reset crop, paste image, upload image, and browser screen capture controls.
- New RFI Section 4 supports upload, paste, capture, pre-attach image review, crop, and reset before attaching the image.
- Server-side image crop bounds are normalized and validated before save/export.
- Complete RFI PDF follows saved package order instead of database order.
- Complete RFI PDF uses Replit-supported `libreoffice`/`soffice` runtime detection and a local LibreOffice fallback path for DOC/DOCX/XLS/XLSX conversion, with timeout, temp directory isolation, cleanup, and explicit attachment-level failure.

Watch after publish:
- Roberto should run authenticated Replit acceptance for create/edit/reload/export with real project data.
- Verify persisted package selection/order after create, edit, sent, closed, and reopened states.
- Verify image include/exclude, replacement, crop, reset, and re-crop in the deployed browser flow.
- Verify DOC, DOCX, XLS, and XLSX conversion in Replit where `.replit` provides `libreoffice`.
- Verify corrupted/unsupported attachment failure returns an explicit failed Complete RFI PDF response.

### Schedule / Coordination Planner
Shipped commit: 2f9093b - Build coordination planner schedule.

What shipped:
- Calendar, Board, and List planner behavior.
- Editable buckets/sprints, default buckets, item moving, bucket rollover, and rollover history.
- RFIs and Submittals remain source-owned while Schedule stores planner placement separately.
- Structured 3D Model schedule fields: level, trade, company, assigned user, notes, due date, and status.
- Backend schema/startup migrations for planner buckets, item placements, rollover history, and milestone planner fields.

Watch after publish:
- Ruben's sprint/kanban workflow with incomplete tasks rolled forward.
- Whether 3D Model tasks are clear enough for trade/company/user responsibility.
- Whether delay attribution can identify repeated bottlenecks by company, trade, and user.
### Submittals Unification
Shipped commit: 94c9c4b - Unify submittals shop drawing control.

What shipped:
- One visible sidebar item: Submittals.
- Internal tabs: Submittal Packages, Register, Shop Drawing Control.
- Shop Drawing Control uses live existing submittals.
- Filters: Building Level, Trade, Drawing Type, Date, Review Status.
- Sleeve filtering includes Sleeve, Sleeve V, and Sleeve H.
- Building Level options combine Convention Builder /levels data with real submittal rows.
- Export labels/files use Shop-Drawing-Control scope.
- Backend Shop Drawing Control PDF/Excel exports respect the same filters.
- BIMLog's own Shop Drawing Control Excel export can be re-imported deterministically.

Watch after publish:
- Ruben's real import file.
- Whether users understand Register vs Submittal Packages vs Shop Drawing Control.
- Whether the Excel export is client-ready.

### Living Brief QUALITY.md
QUALITY.md is now a first-class Living Brief tab and should guide every feature.

Active enforcement needed:
- Run mojibake scan before production builds.
- Keep UI spreadsheet-simple.
- Every feature must answer record, location, owner, responsibility, change, reason, date, state, proof, and next decision.

### RFI Build 1 Correction
Correction started from commit f9793e1ff230632c59ac6dca5ace99b78f87bc9a after the first Build 1 screenshot evidence was rejected as synthetic.

What changed:
- `artifacts/bimlog/src/pages/project/RfisTab.tsx` now defines the canonical RFI section components:
  `RfiSectionHeaderStatus`, `RfiSectionSubmittedBy`, `RfiSectionSubmittedTo`,
  `RfiSectionReferencesAttachments`, `RfiSectionQuestion`, `RfiSectionImpact`, and
  `RfiSectionDistributionResponses`.
- The New RFI create flow renders all seven production sections through those shared components.
- The existing RFI detail/edit flow renders the same seven section component names in view/edit context.
- Saved RFI header state actions are centralized through `getSavedRfiActionMatrix`.
- Test-only harness files were added for real-component evidence:
  `artifacts/bimlog/src/pages/project/RfiCanonicalUiHarness.tsx` and
  `artifacts/bimlog/rfi-canonical-harness.html`.

Evidence note:
- The correction harness imports `RfiCanonicalUiHarness`, which imports the production section components from `RfisTab.tsx`.
- The harness is a Vite-served test fixture and is not linked from production routes.
- PNG screenshot capture was attempted with Playwright, but this machine has neither Playwright's browser payload nor a local Chrome/Edge executable available. No browser was installed because the correction request forbids system installation.
- Do not mark Build 1 accepted until Roberto captures/reviews the nine required harness or production screenshots with a browser available.

Correction 2:
- Starting commit: dff68daae9a8b023c3ac92d9f2569f4575cd9c4d.
- The prior heading-wrapper pattern was rejected because it still allowed separate create/detail/harness field markup.
- `RfiCanonicalForm` now owns the canonical seven-section field markup and renders through `RfiActionBar`.
- `RfiCreatePanel`, `RfiDetailPanel`, and `RfiCanonicalUiHarness` all render `RfiCanonicalForm`.
- The `RfiSection...children` wrapper components were removed.
- The harness no longer defines its own `Field`, `ImpactFields`, section wrappers, or action labels; it supplies fixture values and no-op callbacks only.
- Source proof searches passed for the three `RfiCanonicalForm` call sites and absence of the rejected wrapper/field helper patterns.
- Screenshot capture was retried with the requested existing Chrome executable path (`C:\Program Files\Google\Chrome\Application\chrome.exe`). Chrome launched through Playwright, but localhost Vite startup could not be kept running in this sandbox: direct background process launch hit Windows PATH/environment issues, PowerShell job launch required escalation for Vite temp files, then Vite required `PORT`, and the final `Start-Process -UseNewEnvironment` path caused Node CSPRNG initialization failure. No browser or system package was installed.
- Do not mark Build 1 accepted until the ten requested screenshots are captured from `artifacts/bimlog/rfi-canonical-harness.html` or the live app with Vite bound to `127.0.0.1`.

### RFI Build 1A Correction 5
Starting commit: `9a167fc8598dd93ab4a406c03fa5349e229b4b83`.

Source correction completed:
- The single `RfiCanonicalForm` remains the owner of the seven-section create/detail/edit structure.
- Section 3 restores project-directory company/contact selection, RFI-only external people, and real project-directory company creation without fabricated fallback data.
- Section 7 restores explicit project-contact selection, clean external-recipient display, external-contact creation, and recipient removal without exposing internal `EXT:` storage values.
- Section 4 keeps manual references and uploaded attachments as distinct UI collections, opens authenticated `/api/` attachments through an authorized fetch, opens HTTP(S) references, keeps plain names as text, and removes from the correct source collection.
- Existing RFI edit now persists Project Address through the existing update API and activity record path.

Acceptance state:
- Correction 5 source is ready for independent review.
- Build 1A remains pending independent acceptance.
- Build 1B has not started.
- Do not publish from this source-review step.

Final micro-correction:
- SendGrid CC construction now parses stored distribution entries before validating email addresses, so plain project contacts, legacy external contacts, and URI-encoded external contacts are delivered.
- CC addresses are deduplicated case-insensitively and malformed or empty distribution entries are excluded.
- Build 1A remains pending independent acceptance. Build 1B has not started. Nothing was published.

### RFI Build 1B Browser Acceptance Evidence

- Starting commit: `8b9f9e4ba562f4e74ad61a160204d6738afe0c66`.
- Environment: real BIMLog browser route at `http://127.0.0.1:3100/projects/1/rfis`, current API bundle on `127.0.0.1:3101`, isolated PostgreSQL database `bimlog_rfi_test` on `127.0.0.1:55432`, and existing Chrome `150.0.7871.114`. No harness, static mockup, production service, or production data was used.
- Browser-found corrections: saved-RFI edit mode now exposes one primary `Save RFI` and one neutral `Cancel` action; detail headers now identify `Draft RFI`, `Sent RFI`, `Closed RFI`, `Reopened RFI`, and `Revised RFI` instead of the ambiguous `Existing RFI` label.
- Persisted acceptance records: canonical matrix IDs `39` (draft/edit/upload), `40` (sent/response/email/export), `41` (closed), `42` (reopened), `44` (revision), `45` (viewpoint-created), `46` (browser-created conditional impacts/reference), UI lifecycle IDs `51` and `52`, and participant/directory RFI ID `53`.
- Passed browser matrix: shared 1-7 structure; create and existing edit persistence; immediate manual reference display; cost amount/reason and schedule days/reason conditionals; real attachment upload with clean name; reference-removal isolation; decoded external distribution display; project-directory company/contact creation and selection; encoded external recipient persistence; click-driven Copy Email; zero automatic AI requests; response visibility; ball-in-court history; UI-driven mark-sent, close, reopen, and revise transitions; viewpoint control; linked-item controls; authenticated attachment download; HTTP reference opening; and PDF, Complete PDF, DOCX, and Audit PDF downloads.
- Required screenshots: `C:\Dev\bimlog-tools\evidence\rfi-build-1b\20260714-073359\01-new-rfi-initial.png` through `12-section7-distribution-email-responses.png`. Supporting proofs are `acceptance-results.json`, `state-label-proof.json`, `behavior-proof.json`, `participant-directory-proof.json`, `export-download-proof.json`, and `runtime-proof.json` in the same folder.
- Isolated configuration observation: the local seed contains all four RFI status values but does not declare a default; new API records therefore carried the local configured status `responded` while the independent send lifecycle remained `draft`. This was not hidden or treated as production behavior, and no test-helper or API change was made in this browser-only pass.
- Final verification: `git diff --check`, `pnpm run check:mojibake`, `pnpm run check:living-brief`, `pnpm run typecheck`, and `$env:PORT='3000'; pnpm run build` passed. The approved helper restarted the rebuilt API as PID `22348`; its loopback listener, health 200 response, bundle timestamp, length, and SHA-256 were reverified before a successful post-restart browser read of RFI `40`.
- Acceptance status: evidence submitted for independent master review. Build 1B is not self-accepted. Nothing was published.

### RFI Build 2 Persistence And Lifecycle Integrity

- Starting commit: `082d0519954d3b943931fd43e68ebc9e44aa9e28`.
- Canonical create, duplicate-number retry, existing edit, sent edit, closed edit, reopened edit, reload, and intentional clearing now use the same complete persistence contract. Clearing an impact selection also clears stale amount, day, and reason values.
- Normal and viewpoint-created RFIs resolve a safe configured creation status: explicit safe default first, then semantic `draft`, then semantic `open`; responded/closed defaults and missing safe configuration fail explicitly.
- Close and reopen are explicit transactional operations with persisted actor/timestamp evidence, custody-row termination/restoration, unsent author-held behavior, and lifecycle activity records. Sent drafts advance to the configured semantic `open` status instead of an unconfigured hard-coded value.
- Revision numbers are allocated across the entire family under a transaction advisory lock. Revisions preserve the complete question-side record and viewpoint lineage, do not copy responses, and write source/revision lineage activity.
- Each response owns `response_attachments_json`; response numbering is row-locked and protected by a unique index. Closing through a response is Project Admin-only, invalid statuses return 422, and closed RFIs reject responses until explicit reopen.
- Material edits now write safe before/after activity details. The RFI Audit PDF includes lifecycle, response, and revision activity from the activity log.
- Additive isolated-database operations only: four nullable RFI lifecycle columns, two actor foreign keys, one non-null response attachment JSON column with `[]` default, and two unique indexes. No drop, rename, rebuild, production, Replit, or Neon operation was performed.
- Real API/database acceptance gates A-O passed against `127.0.0.1:3101` and `127.0.0.1:55432/bimlog_rfi_test`. Evidence: `C:\Dev\bimlog-tools\evidence\rfi-build-2\20260714-091443`.
- Build 2 is submitted for independent review and is not self-accepted. Nothing was published. Build 3 was not started.

Discovered and corrected:
- Package selections reload in their explicit saved order; the acceptance fixture was corrected to assert normalized package order.
- Windows PowerShell requires `-PassThru` to retain HTTP status while downloading the Audit PDF with `-OutFile`; this affected only the external evidence runner.
- The prior mark-sent path could persist `in_review` without that value being configured. It now uses the configured semantic `open` value for draft/open records.
- The overdue RFI notifier previously started before the additive RFI migration completed on a fresh schema. It now starts only after that migration succeeds and reports an explicit startup error otherwise.

Deferred:
- Independent acceptance and any production/Replit migration or publish remain outside this build.
- Image crop/export redesign, plugin work, and Build 3 remain out of scope.

### RFI Build 3 Reference And Attachment Integrity

- Starting commit: `cfcb9645ee97c28dd896569c1c1c7d1724aed99d`.
- `files` remains the stored-file and storage-identity authority; `attachmentsJson` owns RFI manual-reference and file membership; `attachmentPackageJson` owns only Complete PDF inclusion/order; and each `rfi_responses.response_attachments_json` owns that response's evidence independently.
- One canonical internal-file locator parser and attachment normalizer now validate same-project file identity, reject malformed/cross-project locators and unsafe schemes, preserve clean display names, deduplicate stable file/reference keys, and remove package ghosts.
- New-RFI uploads remain staged until create succeeds. Creation validates and binds eligible staged files transactionally, duplicate-number retry binds them once, and verified user removal/cancel deletes only the current uploader's unlinked RFI-staging row and storage object.
- Local upload, existing project-file selection, authenticated download, response attachments, revisions, and Complete PDF membership now use stable file IDs rather than filename identity. Selected existing files retain their original ownership; viewpoint evidence remains separate.
- Real authenticated API/database and browser acceptance evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-3\20260714-104133`. It includes byte-for-byte SHA-256 upload/download proof, staged cleanup, database identity, package reload, independent response ownership, security/error statuses, runtime identity, and real-browser screenshots from the production RFI route.
- The isolated environment has no connected cloud provider. No provider URL, token, credential, or fabricated cloud success was persisted; the unavailable state is recorded in the acceptance evidence.
- Acceptance found that Multer's multipart header decoding could misread a valid UTF-8 filename such as `café` as Latin-1. RFI upload normalization now repairs a reversible UTF-8-as-Latin-1 decode while preserving already-valid names; authenticated upload/download and staged cleanup evidence covers the corrected accented filename.
- Build 3 is submitted for independent review and is not self-accepted. Nothing was published and Build 4 was not started.

Final integrity correction:
- Starting commit: `e9fb794103f649ea62f8b4a4a251c3e6821421bf`.
- Every `files.ts` response containing a complete file row now passes through one public serializer. Project-file list/upload/update, CVR proceed/approve/reject, and nested CVR report issue rows omit storage paths, source locations, and internal file metadata.
- Staged cleanup now locks the candidate row transactionally, revalidates project/uploader/source/unlinked eligibility under that lock, deletes storage while binding is excluded, and conditionally deletes the row. A completed bind returns an explicit cleanup conflict instead of allowing storage deletion.
- Real isolated acceptance evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-3\20260714-113827`. Recursive JSON inspection found no `storagePath` or internal storage/provider fields across all audited file responses, including one real nested CVR issue row.
- In the real bind/delete race, cleanup won with HTTP 200, binding failed with HTTP 404, the row and object were absent, and the RFI did not persist the locator. A normal bind regression then returned HTTP 200, cleanup returned HTTP 409, the linked row/object remained, and authenticated upload/download SHA-256 values matched.
- Build 3 remains submitted for independent review and is not self-accepted. Nothing was published and Build 4 was not started.

Deferred:
- Complete PDF/export layout redesign and image crop tooling remain later-build work; Build 3 preserves original evidence files without claiming conversion support.
- Plugin work, production/Replit/Neon operations, migration/publish work, and Build 4 remain out of scope.

### RFI Build 4 Snipping And Non-Destructive Crop Tools

- The original Build 4 submission at `6682875ba8eb608d6c0de5c6bebcde81ae948c43` was independently rejected. It had duplicate Snipping Tool actions, browser-only `showInRfi`, immediate existing-edit file binding, first-image-only multi-select handling, and membership-only server image validation. The earlier completion claims are superseded by this correction record.
- The corrected Snipping Tool has exactly four actions: Continue to Crop, Redraw Selection, Retake Screen Capture, and Cancel. Real browser evidence proves draw, move, resize, crop, upload, pre-upload Cancel, pre-upload Retake, and zero final console errors.
- New and existing RFI image queues preserve every selected file for sequential review. Per-file status distinguishes confirmed, canceled, and failed files; canceled images are not uploaded and document uploads continue independently.
- Existing-RFI question images and cloud files remain staged until Save RFI. Save validates presentation bytes/provenance, persists attachment/package/presentation state, binds staged files, and writes activity in one database transaction. Cancel removes only files staged during that edit; failed validation rolls back state and binding.
- Server image presentation validation now reads stored bytes, accepts only decodable PNG/JPEG data, rejects PDF and corrupt-image sources with explicit 422 responses, and verifies immutable server-known upload, paste, screen-snip, or viewpoint provenance.
- `showInRfi` controls browser presentation, standard RFI PDF, and RFI DOCX. Crop metadata and replacement/original selection are honored without changing stored evidence bytes. `includeInCompletePdf` remains independent; the Complete RFI record page does not duplicate the standard image.
- Correction evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-4-correction\20260714-172059`. It includes authenticated API/database/storage proofs, original-byte hashes, real-browser JSON/screenshots, standard and Complete PDF variants, DOCX package inspection, and LibreOffice-rendered visible/hidden DOCX artifacts.
- Build 4 functional correction was independently accepted. Its focused evidence directory was sanitized, and the accepted correction was cleanly integrated from the exact `origin/master` baseline without unrelated Telegram or Navisworks commits. Nothing was published, and Build 5 has not started.

### RFI Build 5 Professional Standard Exports

- Starting commit: `6919765be8c7cd3f0042fa62b4283d4862210181`.
- RFI PDF and RFI DOCX now consume one canonical saved-record export model in `artifacts/api-server/src/lib/rfi-standard-exports.ts`. The model covers the numbered 1-7 application structure, participants, references and clean attachment names, persisted image presentation, multiline question text, impact accountability, decoded distribution, persisted email wording, and ordered official responses with independent attachments and impacts.
- The standard PDF is a searchable Letter construction record with repeated BIMLog identity, disciplined blue/neutral styling, safe pagination, Page X of Y, generation timestamp, content fingerprint, and draft watermark. Persisted original/replacement crop and show/hide state are honored.
- The DOCX contains editable native Word content with Letter margins, styles, tables, header/footer, Page X of Y fields, embedded aspect-ratio-preserving images, and the same canonical field inventory as the PDF. All focused samples opened and rendered through LibreOffice without broken relationships.
- The Audit PDF is now a factual evidence report with identity, lifecycle state, event-category coverage, chronological actor/timestamp/action history, safe before/after summaries, custody history, response evidence, and view/access history. Missing categories are explicit, and the report makes no unsupported certification claim.
- Acceptance inspection found and corrected two final export defects: odd-length DOCX field groups exposed a padding label as `Not recorded`, and saved audit details exposed numeric BIMLog file locator IDs. Padding cells are now blank and audit file labels retain factual change context without internal IDs.
- Isolated acceptance covered draft, sent, closed, reopened, revised, Cost Increase TBD, known cost, schedule increase/decrease, long text, several references, multiple attachments, decoded distribution, two responses, cropped original image, replacement image, and hidden image. Evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-5\20260714-223603`.
- Build 5 was independently accepted by the master coordinator and cleanly integrated. The standard RFI PDF, editable RFI DOCX, factual RFI Audit PDF, and shared canonical export model are accepted. Nothing was published.

Deferred at Build 5 acceptance:
- Complete RFI PDF attachment/package merging, native PDF pages, Office conversion, and mixed page sizes were assigned to Build 6 and are addressed in the Build 6 review record below.
- Production, Replit, Neon, plugin, Telegram, Lens, Schedule, Submittals, and global-layout work remain outside this build.

### RFI Build 6 Complete PDF Package And Native Fidelity

- Starting baseline: `3fe1b2c5ada4cf6c657a44b90731a3ea6fbe08cd`.
- The Complete RFI PDF now uses a dedicated atomic package pipeline. Build 5 canonical RFI pages remain first and unchanged; saved `attachmentPackageJson` controls binary attachment inclusion/order, while saved `imagePresentationJson` independently controls the original/replacement presentation image, crop, standard-RFI visibility, and Complete PDF inclusion.
- Native PDF pages are copied without rasterization or page-size normalization. Structural comparison of the unchanged five-page River Avenue fixture against merged package pages 3-7 found exact MediaBox, CropBox, TrimBox, BleedBox, ArtBox, rotation, decoded content streams, resource inventories, embedded-image inventories, vector-operator counts, and extracted text. Existing source qpdf resource/AutoCAD character-map warnings remain distinguishable from merge defects.
- DOC, DOCX, XLS, XLSX, CSV, and TXT use a bounded asynchronous LibreOffice capability contract with an isolated profile, restricted child environment, explicit timeout/cancellation, and deterministic cleanup. PNG, JPEG, TIFF, BMP, GIF, and WEBP use validated image decoding, aspect-ratio preservation, reliable DPI when available, and a documented no-DPI policy without crop or stretch. Presentation crop applies only to the presentation image.
- Generation preconverts and validates all selected sources before assembly, validates the final PDF, enforces byte/page/pixel limits, rejects malformed/cross-project/missing/corrupt/zero-byte sources cleanly, and records one sanitized success or failure activity per request. The searchable manifest records clean labels, source and converted hashes, source page inventories, page ranges, methods, warnings, and a stable logical fingerprint derived from canonical saved state and source bytes.
- Real authenticated isolated-local API evidence proves package inclusion/order persistence, duplicate suppression, revision preservation, independent `showInRfi` and `includeInCompletePdf`, original/replacement selection, stable fingerprints, missing/corrupt source rejection, and success/failure activity integrity. Focused evidence is under `C:\Dev\bimlog-tools\evidence\rfi-build-6\20260715-130643`.
- The initial local review commit `0719655fcaae2623daf6283b6dd8f958d62eaed0` was independently rejected for pre-orientation EXIF geometry, synchronous LibreOffice execution, and an overstated converter security claim. The native PDF architecture and River Avenue fidelity proof passed review and were preserved.
- The correction normalizes JPEG/TIFF orientation once before reading displayed dimensions or applying browser-normalized crop coordinates. Four-quadrant EXIF fixtures for orientations 1, 3, 6, and 8 prove rotation, width/height swapping, source-byte immutability, and non-symmetric crop placement for orientations 6 and 8.
- All converter execution is asynchronous and bounded. Real isolated API evidence proves health and authenticated reads remain responsive during a delayed conversion, timeout and client disconnect terminate the child, one disconnect starts no duplicate conversion, concurrent conversions use distinct workspaces, and success/failure/cancellation cleanup leaves no converter process or temporary workspace.
- OOXML external relationships are rejected before LibreOffice starts; a live loopback retrieval trap recorded zero requests. Application secrets are excluded from the child environment, macros and interactive prompts are disabled, and link updating is disabled where supported. This is not an OS-level sandbox: LibreOffice still runs under the API host account and may retain host-account filesystem/network capabilities for legacy DOC/XLS or converter behavior not covered by OOXML preflight.
- Final narrow correction starts each POSIX converter in a new owned process group and signals only that group on timeout, request cancellation, or output-limit failure. Windows retains argument-array `taskkill /PID <owned-pid> /T /F`; both paths await converter closure before workspace cleanup, with direct-child termination only as a fallback when the platform tree mechanism itself is unavailable.
- OOXML preflight now bounds ZIP metadata before reading any relationship payload: 4,096 entries, 256 MiB declared uncompressed data, 1 MiB per relationship entry, 4 MiB total relationship data inspected, and a 1,000:1 compression-ratio ceiling for entries of at least 1 MiB. Excessive archives return `422 resource_limit` before LibreOffice starts.
- Windows parent/child/grandchild termination is covered locally for timeout and cancellation. POSIX strategy selection and negative-process-group ownership are deterministic in local proof; actual Linux/Replit process-tree execution remains a deployment acceptance item because no existing POSIX runtime was available for this correction.
- Independent review accepted source commit `89ec3818126cd47d8a2a19d58b1a4baef7e1d7e2`; clean integration commit `0d774412e352e668328939ef21bc84cf9a1afecc` preserves the accepted implementation on the current `origin/master` lineage.
- Clean-integration evidence passed all 52 checks. Evidence: `C:\Dev\bimlog-tools\evidence\rfi-build-6-integration\20260715-202552`; manifest SHA-256 `12afcb8d9a85027d8207c44feb460a5f4c4980d8b4d6b51397344a7be4cd3d31`.
- Build 6 source and focused artifacts are independently accepted for clean integration. Actual Linux/Replit POSIX process-tree execution remains required before publication; this acceptance does not waive that deployment gate.
- The separate `OPEN_LOOP.md`-only commit containing this record is the final Build 6 acceptance commit.
- Nothing was published, and Build 7 was not started.

Deferred:
- Outlook MSG conversion remains explicitly unsupported. An included MSG returns a clean 422 naming the file; there is no silent omission or partial package.
- Native PDF annotations are imported as supported by pdf-lib. Cross-document destinations are not rewritten and this limitation is stated in the package manifest; no stronger preservation claim is made.
- Independent acceptance and any production/Replit/Neon operation remain outside Build 6.

### RFI Build 7 Canonical Register And Professional Excel Export

- Starting baseline: `3af9cf0a82d33aac5e7954b9ea9b156bca9637a1`.
- Local review implementation replaces the prior one-sheet RFI Excel export with one canonical server-side register workbook model. The workbook contains exactly four sheets in order: `RFI Register`, `Responses`, `Ball-in-Court History`, and `Export Information`.
- The prior zero-result fallback was removed. Status and search filters now export the actual filtered result set, including an intentionally empty register when no RFI matches, instead of silently exporting all project RFIs.
- The workbook uses clean attachment labels, decoded distribution recipients, project-scoped responses and custody history, real date and numeric cell values, frozen headers, auto-filters, widths, margins, and landscape fit-to-width print settings. Formula-control text is prefixed to prevent spreadsheet formula execution.
- The browser control is now explicit: `RFI Register Excel` / `Registro RFI Excel`. It sends the active status and search filters, shows loading state, uses the server filename, and preserves current RFI page state.
- Local artifact evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-7\20260715-220000`. The generated workbook SHA-256 is `43401a30c1314ebd465dc7b74a158f57802c38798b12b9a9df6a27bae5051fd3`. XLSX parser inspection and raw ZIP/XML inspection both confirmed the sheet order and workbook settings; the evidence privacy scan found no storage paths, filesystem paths, credentials, bearer strings, API keys, passwords, token query strings, or signed-provider query strings.
- Correction after rejected local commit `bab618d5dc2b3a60ba18f1276f5e27997562263e`: Cost Amount and Calendar Days now export as numeric cells for numeric values in both Register and Responses sheets, invalid numeric text remains inert text instead of silently becoming zero, formula-control text is protected without converting negative numeric costs, register columns include send/source/count/current-custody/latest-response/created/updated fields, and Current Ball in Court is sourced only from the open `rfi_ball_in_court_history` row. Corrected evidence passed 91/91 named checks, including real LibreOffice headless open/save validation. Evidence: `C:\Dev\bimlog-tools\evidence\rfi-build-7\20260716-000000-correction`; manifest SHA-256 `9cdf54f723b3478095094fd577405be5b0b230ed874ef8c798dc0dfa59e0f208`.
- Clean integration was completed from current `origin/master` baseline `cb9ad9bf8fad45dc2148fc0ff057746ccf9acf50` without importing the candidate's older ancestry. Integration commit: `20a7a26ec856c262e05810d1875b3e7725c6eada`. Independent clean-integration review passed 31/31 focused checks, including raw XLSX/ZIP XML inspection, LibreOffice headless open/save roundtrip, custody authority, privacy, zero-result filtering, UI labels, server filename handling, and activity-record source review. Evidence: `C:\Dev\bimlog-tools\evidence\rfi-build-7-integration\20260716-acceptance-review`; manifest SHA-256 `aa93904be758f119c7c9f5fd84f7982835aff8003aab3aa512f8e34cad3148d8`.
- Build 7 is independently accepted for clean integration. Nothing was published, and Build 8 was not started.

## Deferred

### Telegram Product Build 5 - User Notification Preferences And Reliable Event Delivery

- Starting baseline: `54fd68439522a6627998026953c13403c9f34795`, the accepted Telegram Product Build 4 master commit. Work was isolated in a clean worktree; the dirty primary checkout and concurrent RFI Build 7/Navisworks work were not touched.
- Extended the existing canonical `notification_preferences` row with opt-in enablement, pause/resume, English/Spanish language, IANA timezone, quiet hours, immediate/daily-digest/weekly-digest/off frequency, Telegram/email permission, overdue cadence, project mode, update actor, and update source. Project, module, and event overrides are additive owner-scoped tables with membership validation and explicit inheritance.
- Added bilingual stable module/event catalogs. Support, Delivery Concierge, and Account/Security are connected Telegram-domain adapters. RFI, Submittals, Schedule, Change Orders, Transmittals, Lens, and Files preferences are honestly marked unavailable/coming later; no active RFI implementation or module adapter was modified or fabricated.
- Added a durable notification outbox, immutable transition ledger, provider-attempt ledger, deterministic digest windows, and unique digest membership. User-scoped database uniqueness covers canonical source event, channel, frequency, and digest window. Workers claim transactionally with `FOR UPDATE SKIP LOCKED`; delivered and unknown outcomes are never automatically resent.
- Authorization and current preferences are checked when an event is accepted and again before immediate or digest delivery. Revoked membership suppresses delivery, revoked channels cancel safely, quiet hours defer rather than discard, stale `delivering` rows become `unknown`/manual review on restart, and real Telegram provider acknowledgement IDs are required before `delivered`.
- The dedicated platform Notification Center and ordinary-user Telegram menu share the same persisted settings for language, timezone, quiet hours, frequency, project/module/event choices, pause/resume without unlinking, and a clearly labeled test notification. Profile retains only Telegram connection status and a concise shared summary with pause/resume and a route shortcut. Super-admin notification review requires server-side authorization, exact target plus reason for detail access, an audit record, and metadata-only bulk projection.
- Independent review correction moves the complete platform preference editor to the dedicated protected `Settings -> Notifications` route and sidebar location. One reusable canonical component renders the full Notification Center there and only a concise status, pause/resume control, and route shortcut in Profile; both use the same authenticated APIs and persisted model.
- Contextual `Notify Me` and `Send via Telegram` module controls are explicitly deferred until the relevant real module adapters and entitlement foundation exist. No RFI, Submittal, Schedule, Change Order, Transmittal, Lens, Files, or other module surface is modified or presented as connected by Build 5.
- Deterministic product notifications use zero AI credits and never create an AI run, reservation, provider request, settlement, or charge. Automatic AI summaries were not added. Email notification delivery remains explicitly unavailable because the accepted legacy SendGrid credential path is not envelope-encrypted; no plaintext credential was copied, migrated, printed, or expanded.
- Additive schema only: no table, column, or index drop and no destructive rename/rebuild. Independent correction evidence reran the built API against `127.0.0.1:55432/bimlog_rfi_test` with a loopback Telegram fixture and real Google Chrome desktop/mobile platform runs, including real provider acknowledgements, timeout/rejection classification, concurrency, restart, quiet-hours/digest recovery, canonical Telegram/platform synchronization, responsive UI checks, privacy scanning, and cleanup. Result: 132 passed, 0 failed. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-5-review\20260716T155925Z`; detached manifest SHA-256 `0e896a24dcdca4e6d9020599c75d0269e7c5967883419bac285aca2bad880c45`.
- Required validation passed: `git diff --check`, `pnpm run check:mojibake`, `pnpm run check:living-brief`, `pnpm run typecheck`, and `$env:PORT='3000'; pnpm run build`. Privacy/secret scan found zero prohibited values and zero Build 5 test identities remained after cleanup.
- Independent review rejected source candidate `650dbfe0a3665e892138638f8d112ecfe7ebf744` as submitted because the dedicated platform Notification Center was absent, then corrected and accepted the resulting local candidate for clean integration after source, schema constraints, built runtime, canonical database/API behavior, and real Chrome desktop/mobile verification passed. Nothing was pushed or published, no live webhook or real customer contact was performed, the external development notifier was not modified, and Telegram Product Build 6 was not started.
- Independent master integration accepted candidate `db307d39ac88e3fe92972b303e0841393d9fdf5d` and applied only its two-commit delta after Telegram Product Build 4 to current master baseline `27d133dadcdb4374d50c305a960be47c73a1d214`. Clean integration commit `8ee4a5f77ad279bad4b00ec702c3cb040376aeba` preserves Plans and Entitlements Step 1, Navisworks Import/Rebind, RFI Build 7, Telegram Product Builds 1-4, and all additive startup migrations.
- Plans and Entitlements Step 1 continues to classify product-wide deterministic notifications as `coming_later`. Build 5 truthfully provides the canonical preference, outbox, and Notification Center foundation only; the RFI, Submittals, Schedule, Change Orders, Transmittals, Lens, and Files adapters remain disabled and visibly labeled `Coming Later` / `Disponible más adelante`. Contextual `Notify Me` and `Send via Telegram` controls remain deferred.
- Clean-integration evidence passed 132/132 against `127.0.0.1:55432/bimlog_rfi_test`, a loopback Telegram provider, the real built API, and real Chrome desktop plus 390px mobile runs. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-5-integration\20260716T221823Z`; manifest SHA-256 `1e55d7b7a6119e916351ab143895a3dd9eb1a87ce7faa6c80cc4788e47dfb52a`. Focused regressions passed Plans/Entitlements 41/41, Navisworks import contract 15/15, Telegram Build 3 30/30, and Telegram Build 4 79/79. The first Build 3 regression attempt encountered its known competing-worker claim timing race; its cleanup completed, and the clean rerun passed with delivered-message identity and attempt count unchanged across restart.
- Production validation passed `git diff --check`, mojibake, Living Brief, typecheck, and build gates. The production build alone regenerated `PLATFORM.md`; it records both the preserved Navisworks import files and the new notification foundation. Privacy/secret scanning passed, and all uniquely timestamped identities created by this integration evidence were removed. Nothing was published, and Telegram Product Build 6 was not started.

### Telegram Product Build 6 - Deterministic RFI Notification Adapter And Contextual Controls

- Clean integration accepted locally, replayed as an audited authorized delta onto authoritative accepted master
  `7cc8447876a731c95771bb6e07ca827202d90ce7`; the preserved older-baseline worktree and unrelated main checkout
  were not reset, cleaned, stashed, rebased, or pushed.
- RFI lifecycle actions record durable, idempotent source events in the same database transaction as the accepted
  RFI change. A separate worker fans eligible recipients into the existing Build 5 outbox; RFI routes never deliver
  directly, and deterministic notification processing performs zero automatic AI calls or charges.
- Delivery eligibility is rechecked against current project membership, authorization, Telegram connection,
  global/channel/module/event/project preferences, watch state, quiet hours, frequency, overdue cadence, and
  current outbox state. Unknown or delivered attempts are not resent after restart.
- The canonical Notification Center owns RFI module frequency. Saved RFI records alone expose contextual
  watch/unwatch and inherited/effective behavior using the same APIs and settings; unsaved RFIs expose no control.
  Submittals, Schedule, Change Orders, Transmittals, Lens, and Files remain visibly unavailable/Coming Later.
- Final local evidence passed 38/38 with zero failures against the safely verified isolated database
  `bimlog_rfi_test` at `127.0.0.1:55432`. It exercised the built API, real loopback Telegram HTTP acknowledgements,
  durable transaction rollback, duplicate/concurrent processing, delivery-time authorization and preference
  changes, quiet hours, immediate/daily/weekly/off behavior, restart recovery without resend, Build 5 outbox
  regression, zero AI use, English desktop UI, Spanish 390px UI, privacy, and tag-scoped cleanup.
- Integration evidence corrected the browser fixture's response handling and made its quiet-hours proof stable across
  the UTC midnight boundary. Final evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-6-integration\20260722T000230Z`;
  manifest SHA-256 `2bbfeaa3e635aff72b2032295d36ecbf3ce1e0df3237d2d2aa455b21ab6f36d6`.
- Clean integration commit `fdfbdd490ba58ad5070b94c580d374d31007d808` has direct parent
  `7cc8447876a731c95771bb6e07ca827202d90ce7`. Final repository validation passed; normal push verification remains.
  Nothing was published or deployed, no production or customer data was accessed, and Telegram Product Build 7
  has not started.

### Telegram Product Build 4 - Secure Delivery Concierge Foundation

- Starting baseline: `43497bb8e2db1b8b567ddf6bc060b0afbcadd646`.
- Added one durable delivery-request, immutable transition-event, provider-attempt, and short-lived audience-link model for authorized existing BIMLog artifacts.
- Guided English and Spanish Telegram delivery supports project files plus the existing canonical RFI PDF, Complete RFI PDF, RFI DOCX, and RFI Audit PDF routes. Unsupported artifact types fail explicitly; no alternate report generator was added.
- Telegram delivery is limited to the linked user's verified private chat. Email recipients are explicit, normalized, deduplicated, previewed, and require a second confirmation when outside the user's verified company/project participants.
- Authorization is rechecked at preview, immediately before canonical generation/storage read, and immediately before provider contact. Delivery attempts are persisted before contact; only a real acknowledgement ID can produce `delivered`.
- Direct attachment limits are configurable. Oversized delivery uses a random, short-lived, audience-bound, exact-artifact BIMLog link when safe; otherwise it fails explicitly without truncation or silent compression.
- Existing limitation: the legacy SendGrid connection stores its API key server-side in `user_connections.credentials`. Build 4 does not duplicate or expose that key, but a focused provider-credential migration is required to establish encrypted-at-rest storage and rotation for legacy email connections.
- Independent-review correction now requires user-scoped atomic idempotency, an explicit persisted external-warning acknowledgement before the separate external confirmation, transactional state/event/attempt changes, stale-state restart recovery without resend, narrow rejection of every oversized email, broader timeout-to-unknown classification, requester-only Telegram large-file links, audited link access, and bounded preparation. Corrected rebuilt-API evidence passed 79/79 against `127.0.0.1:55432/bimlog_rfi_test` with loopback-only AI, Telegram, and email provider fixtures. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-4-idempotency-correction\20260716T021040Z`; manifest SHA-256 `2a53dd8ad4a1dfed4d5968357c72431eb2fb25aba09978504bf3f85d3adc25ac`.
- Idempotency index migration is additive: new requests store a user-namespaced HMAC confirmation key and use `telegram_delivery_requests_user_confirmation_uidx` on `(user_id, confirmation_key)`. The earlier global index is intentionally retained to avoid a destructive automatic `DROP INDEX`; a separately reviewed future migration may remove that redundant legacy index after deployment compatibility is established.
- Independent master review accepted source commit `8f769a45796bfeac3d7bfa9990a0022214ecbe45`. Clean integration commit `be0a55e4d02c1139244d324fc6d9e27e873f7e1e` applies only the accepted Build 4 implementation to master baseline `3af9cf0a82d33aac5e7954b9ea9b156bca9637a1`, preserving the accepted RFI Build 5/6 schema and startup behavior.
- Clean-integration evidence reran all 79 checks with zero failures against `127.0.0.1:55432/bimlog_rfi_test` using loopback-only provider fixtures. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-4-integration\20260716T115522Z`; manifest SHA-256 `64769e119f8434f28779cd98bca3cfb4e4c9e9c4e297ba462c60609c9f29b404`. Privacy/secret scanning passed and the harness left zero test seed records.
- Telegram Product Build 4 is independently accepted and cleanly integrated. Nothing was published, no live webhook was configured, no customer file/email was sent, and Telegram Product Build 5 was not started.

### Telegram Product Build 3 - Bilingual Conversational Assistant And Support Core

- Local review implementation is complete in the isolated `telegram-product-build3-clean` worktree from baseline `be3a76aa5ea8f2a7749f0f4c845a04d69d5934c9`.
- Added canonical Telegram product conversation, message, support case, and support case event tables through additive startup migration and Drizzle schema exports.
- Telegram inbound processing now supports bilingual help/privacy/language flows, deterministic assistant estimate/confirm/cancel/failure handling through the Build 2 AI control plane, and support case creation from private Telegram chat.
- Browser Profile now exposes recent Telegram conversation summaries, AI funding/status/usage, support cases, and privacy/consent summary from authenticated product routes.
- Super-admin Telegram review routes require a reason and write `admin_actions_log` entries; ordinary users cannot access global conversation/support review.
- Real local evidence passed 30/30 checks against the isolated database `127.0.0.1:55432/bimlog_rfi_test` and real app routes/Telegram queue. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3\20260715T140026\telegram-product-build3-evidence.json`.
- No production, Replit, Neon, live webhook configuration, polling/controller startup, push, publish, or customer data access was performed.

Initial submission limitations, superseded by the corrections below:
- The initial local evidence used deterministic settlement/failure broker paths; the accepted correction replaces that limitation with real provider HTTP execution and provider-returned usage.
- Build 4 remains not started.
- Production Telegram webhook setup and deployment remain blocked until explicitly authorized.

Correction after rejected local commit `e25bb8a7803eb93ab618a14e6f193757be9918b7`:
- Removed fake Telegram Assistant execution, hardcoded assistant text, fixed token counts, fabricated provider IDs, and the production `TELEGRAM_PRODUCT_AI_TEST_MODE` branch.
- Added a production provider broker that revalidates the reserved AI run, uses `withProviderSecret`, calls OpenAI/Anthropic HTTP APIs, returns only provider text, and settles only with provider-returned usage.
- Delivery accountability now records outbound messages as pending, stores Telegram `message_id` only after successful Telegram response, records failed delivery categories, and skips resending already-delivered outbound records.
- Support intake is staged and creates a case only after confirmation, using required statuses `new`, `acknowledged`, `in_progress`, `waiting_for_user`, `resolved`, `closed` with transition events.
- Corrected evidence passed the exact 30-item matrix. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3-correction\20260715T150459`; manifest SHA-256 `f7b30f30767c0f54e24fbada4aacddc1b973f83044ac749423ac172430d28a47`.

Final focused correction and independent acceptance:
- Accepted source commit: `6585682ca377a5a1f6937f8be23837eef9c80972`, cleanly integrated as `3566ab7b3b20f4529df62b231ca5fdfe005dd8ea` from accepted master baseline `3fe1b2c5ada4cf6c657a44b90731a3ea6fbe08cd` without importing its older ancestry.
- Real provider HTTP execution now supports bounded English and Spanish multi-turn context, provider-returned usage settlement, response-body and response-header request identifiers, and rejection/release without settlement when the provider supplies no request identifier.
- Target-specific super-admin content review requires an exact conversation ID and reason with audit evidence; bulk review remains metadata-only. Ordinary-user and company boundaries remain enforced.
- Final isolated evidence passed 30/30 with real built-API stop/start persistence and delivery accountability. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3-final\20260715T174744Z`; manifest SHA-256 `baecba1def3baf1d9f0c4d00fef8d5e1110ac65872deb35b7fe1223a747d8bd0`.
- Clean-integration evidence again passed 30/30 against the isolated local database. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3-integration\20260715T183706Z`; manifest SHA-256 `03438111df8c26c281d47dd45d315a3eadb327ea66cc998809ff55828872ceab`.
- Telegram Product Build 3 was independently accepted for clean integration. Nothing was published, and Telegram Product Build 4 was not started.

### Navisworks Project-28 Preserve-First Reconcile v1.60.13 - Review Candidate

- Ruben reports a physical active viewpoint disappears after Pull from Platform followed by
  Reconcile. Reported unresolved successor rows include 99-109, 181, and 316.
- Proven v1.60.12 root cause: an unmatched local `serverId` was passed to
  `doc.SavedViewpoints.Remove(loc.Vp)`. Reconcile could also remove prior BIMLog folders after copying
  matched rows only. Both destructive normal-operation paths are disabled in v1.60.13.
- Omitted, ambiguous, incomplete, wrong-project, `Guid.Empty`, duplicate-label, historical, and strict
  temporary records are preserved. Strict remnants are isolated by row and cannot cancel unrelated
  reconciliation. Verified rows are moved in place, preserving physical Navisworks state.
- Normal Pull/Reconcile enforces a distinct-physical-count invariant. Exact duplicate removal requires
  verified project/server/physical identity, independently unique non-empty GUID targets, canonical
  metadata/folder, and survivor readback; ambiguity removes nothing.
- Platform Pull returns every lifecycle row for the requested project and now includes each row's
  `projectId`, allowing the plugin to reject missing/wrong-project rows before mutation.
- Deterministic matrix: 26/26 passed. Debug AnyCPU/net48 builds passed with zero errors. DLL hashes:
  2025 `A66618980D099D88FDF80BDAE235A50CA3EB89CAFA5BB9F1470C970C853F564D`; 2021
  `3A39B02E6CCD3FE21AD3041AB9B083B4E50029DE1BDB539DC420C3F7F16E851A`.
- Review ZIP: `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.13.zip`, SHA-256
  `AB9CE37B33FB11CBF7935DF0FCA1E1A514346DC0399CB15C049756E9BB5CA2AC`.
- Project-28 NWD acceptance is pending because the supplied NWD is not present. Do not install,
  distribute, send Completed, or close the customer issue until isolated-copy Pull/Reconcile twice,
  save/reopen, inventory/Jump/state checks, Roberto approval, and Ruben's 2025 confirmation pass.

### Navisworks v1.60.13 Project Import/Rebind Platform Correction - Integrated

- Clean integration base: `2d57aaff7c58e27cb0b1e8290375c5d7f4be2543`. The accepted local candidate
  `bc64520de42e85ca2f99e0670be851573def0750` was applied as a diff only; its older branch ancestry was
  not imported.
- The platform import endpoint now persists a canonical immutable request hash, namespaces
  idempotency by authenticated user and target project, returns controlled HTTP 409
  `IMPORT_IDEMPOTENCY_CONFLICT` for same-key/different-content retries, validates bounded input before
  transactions, sanitizes failures with correlation IDs, and persists queryable target
  `bimlog_physical_id` values returned by Pull.
- Integrated evidence passed 15/15 source contract checks and 68/68 real authenticated API/database
  checks against `127.0.0.1:55432/bimlog_rfi_test`, proving idempotency, concurrency, rollback, restart
  persistence, project boundaries, Pull contract, legacy NULL request hash controlled 409, zero test
  identities remaining, privacy scan, and no destructive Lens import migration block. Evidence:
  `C:\Dev\bimlog-tools\evidence\navisworks-project-import\lens-import-20260716200026-945467`;
  manifest SHA-256 `3dfc8a5480fcabdf88130585cb8066f85067ab8ccafc19178727db2aef11cbff`.
- No Replit publish, production/Neon access, projects 28/34/35 access, customer data access, Navisworks
  relaunch, deployed Sync/Pull/Reconcile/Import, DLL/package install, distribution, or new plugin version
  occurred.

### Navisworks Superseded Viewpoint Reconciliation v1.60.10 - Superseded by v1.60.13 Candidate

- v1.60.9 field regression: web-created successors could remain visible with internal
  `BIMLog successor <rowId> <token>` names when post-insertion direct name mutation failed.
- v1.60.10 source/package produced on 2026-07-14: clean names are assigned before insertion,
  persisted mutation uses the supported API, readback is mandatory, exact-GUID compensation
  removes incomplete copies, and strict existing remnants are repaired without label deletion.
- Platform Jump continues to send immutable row identity; both physical
  plugin sources reconcile by `serverId`, GUID, and lineage rather than display label.
- Web-created Edit/Reassign successors are copied deterministically from their physical predecessor
  and stamped with the new platform row ID. Duplicate display labels remain separate and ambiguous
  label-only jumps are blocked.
- Local gates passed: deterministic successor-name fixtures; 2025 and 2021 plugin Debug builds
  as AnyCPU/net48; v1.60.10 assembly/package inventory and matching DLL hash.
- Package: `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.10.zip`, SHA-256
  `72A9C743D55BB0DFBE275C164E6C93E0248BDEBBC590DDCB0647DF56F8C550EE`.
- Evidence: `C:\Dev\bimlog-tools\evidence\navisworks-successor-name-fix\20260714-141458`.
- Open field gate: Ruben must install the v1.60.10 package and verify the affected web reassignment,
  superseded predecessor, active successor, duplicate-label HV-010, Pull/Reconcile, and Jump flows
  inside Navisworks Manage 2025. Do not call field verification complete before that confirmation.

### Telegram / WhatsApp Briefings
Idea: connect project briefings, schedule alerts, and delay/risk summaries to Telegram or another messaging channel.

Do not build until:
- Schedule data model is stable.
- Notification preferences are designed.
- Customer permission/opt-in rules are clear.

### Heavy AI File Reading
Do not make automatic.

Future behavior:
- User explicitly clicks AI file read.
- BIMLog warns that this may use AI credits.
- The extracted fields must show confidence and require user review.

## Closed / Shipped

### GitHub Merge Reconciliation
Resolved and pushed after manual Shell merge.
Remote master includes the Replit work plus Codex's Replit branding removal commit.

### Replit Branding Removal
Production no longer depends on old bim-log-ignite.replit.app references in searched source paths. Continue to prefer bimlog.app in user-facing URLs and OAuth callback docs.
