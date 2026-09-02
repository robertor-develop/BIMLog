# OPEN_LOOP.md - BIMLog Open Product Loops

This is the operating register for unfinished BIMLog work. It exists so customer feedback, half-built features, cleanup tasks, quality issues, plugin tasks, and Replit/Codex handoffs do not disappear across compacted chats or focused tasks.

## BIMLog v1.60.33.06 Build 6 Team Capacity release gates - 2026-08-14

- The exact-artifact proof's fixed PostgreSQL port collided with an unrelated managed local
  service. The proof now permits an explicit caller-selected non-privileged loopback port while
  continuing to require an explicit URL, exact `bimlog_rfi_test` database name, loopback host,
  and verified server identity. The governed pre-push gate must still pass against a fresh
  disposable F-rooted cluster before the local candidate is closed.
  The proof also tracks the accepted `/api` health endpoint as 200 rather than its obsolete
  pre-health-route 404 expectation.
  Proof users and their immutable entitlement initialization remain confined to the fresh
  disposable cluster, which is stopped and removed as the cleanup boundary.

- Exact-390 Spanish QA corrected the Resource Scheduling methodology that remained in English.
  Focused bilingual SSR, frontend typecheck, and live no-overflow browser evidence pass; the
  governed post-change build still requires a clean successful run before local commit.

- Isolated PostgreSQL release evidence now passes profile persistence, membership/company/project
  isolation, concurrent scenario conflict, persisted nested financial redaction, concurrent
  idempotent application, divergent replay refusal, cross-tenant scenario refusal, stale-basis
  refusal, injected mid-transaction rollback, and zero partial reassignment. No production database
  was accessed.
- A release review defect was corrected: the four mutation limiters had process-local maps that did
  not enforce one bound across a multi-process topology. The candidate now uses one additive,
  transactionally updated database bucket authority shared across processes and fails closed when
  that authority is unavailable. Browser, CSV/PDF, final build, independent review, and clean-commit
  evidence remain open until their terminal artifacts pass.

1. Complete the governed full production build and independently inspect the corrected exact
   candidate diff, including the generated platform inventory and Living Brief state.
2. Exercise authenticated API persistence against an isolated authorized database: profile and
   scenario version conflicts, project/company isolation, role and entitlement denial, rate
   redaction (including persisted scenario financials), mutation-rate-limit behavior across the
   deployed process topology, concurrent save/apply, stale basis refusal, divergent event replay, transaction
   rollback, and zero partial reassignment. No database was accessed by this source task.
3. Exercise the actual production UI on desktop and exact-390px English/Spanish for populated,
   missing-profile, empty-task, priced-assignment, loading, denied, malformed-response, stale,
   conflict, and successful apply states. Confirm save/reload persistence, CSV inspection, governed
   Print PDF, no horizontal overflow, no failed requests or console exceptions, and no hidden rates.
4. Preserve Build 5 `v1.60.32.05` and all canonical Job Intake, Job Operations, task, resource-rate,
   package, deliverable, membership, entitlement, and company-binding authorities. Build 6 may
   change only reviewed direct task assignees; scenario hours and financial values remain advisory.
5. After local gates and independent acceptance, create one clean candidate commit. Push, Replit
   alignment and complete non-destructive preview, authorized publish/deploy, deployed-commit and
   production verification, customer acceptance, and live acceptance remain separate approvals.

## BIMLog v1.60.32.05 Build 5 Document Connections release gates - 2026-08-13

1. Exercise typed task and work-package connections to same-project RFIs, exact
   file revisions, and transmittals in an isolated database, including invalid
   types and IDs, cross-project refusal, duplicate/idempotent requests,
   concurrent changes, target reassignment, and canonical-source deletion.
2. Verify current-authority recalculation and stale-safe unlink: a former
   controller must not retain authority, a current authorized controller must
   be able to remove the junction, and an unavailable canonical source must not
   expose a dead anchor or mutate the source record or its history.
3. Verify bounded option and connection-list behavior at, below, and above each
   limit. Confirm truthful `total`, `limited`, and `max` disclosure, malformed
   present-metadata failure, stable ordering, and no implication that a capped
   result is complete.
4. Exercise desktop and exact-390 English/Spanish populated, empty, loading,
   failure, denied, capped, and unavailable states. Confirm exact RFI,
   file-revision, and transmittal navigation after data load, preserved filters,
   exact highlighting/opening, and visible invalid/not-found behavior with no
   substitute selection.
5. Preserve the Build 4 `v1.60.31.04` history and all existing canonical RFI,
   file, transmittal, task, and work-package authorities. This `v1.60.32.05` local
   candidate is locally committed at
   `3d22c6a64e311575f1de9c8478d4ecebda9d26a3`, but is not pushed,
   published, deployed, production/database verified, customer accepted, or
   live accepted; each remains separately authorized.

## BIMLog v1.60.28.03 Smart Intake multi-contract activation gates - 2026-08-11

1. Verify one through 50 contract profiles, independent APU or pricing
   selections, item-to-contract assignments, currency compatibility, workflow
   inheritance, and budget relationships across save, reload, edit, and
   activation.
2. Exercise idempotent activation and stale-revision refusal in an isolated
   database. Confirm that the same canonical Contracts & Commitments records
   appear after activation and that retry creates no duplicate contract,
   snapshot, Contract Item, budget, or operational baseline.
3. Verify desktop and narrow-width English/Spanish behavior with optional
   documents, imported and pasted rows, contract assignment controls, missing
   contract validation, autosave recovery, and the final activation summary.
4. GitHub `main` and `master` currently resolve to exact Build 3 source commit
   `69f1791fe623faed546ae1da7a0d8498b00ffbac`, including the corrected
   `v1.60.28.03` Team Resource Planning release-version assertion. Treat local
   test, typecheck, and build success as source evidence only. Replit pull,
   publication, deployment, production/database verification, and customer
   acceptance remain separate, operator-controlled actions.

## Smart Intake and Contract Item editor release gates - 2026-08-11

1. Exercise XLSX, XLSM, and CSV sources with multiple sheets, preambles,
   non-first headers, reordered columns, blank and ambiguous rows, 100-plus
   valid rows, stale revisions, stale fingerprints, reload, and repeated apply.
2. Verify desktop and narrow-width English/Spanish keyboard and screen-reader
   behavior for sheet/header/column selection, issue presentation, Excel paste,
   row add/remove, quantity-wide edits, Advanced disclosure, autosave status,
   and reload without lost rows.
3. Verify in an isolated database that confirmed mappings append rather than
   replace, preserve document/hash/cell provenance, inherit only currency-
   compatible saved APU/rate defaults, and activate through the existing shared
   operational and Commercial records without a duplicate Intake authority.
4. Preserve the Build 4 local candidate's generated project-budget aggregate,
   immutable per-contract APU/financial baselines, Budget Accounts, workflow
   inheritance, and execution baseline. Do not introduce a duplicate contract,
   item, APU, workflow, budget, or PDF authority.
5. Treat local source, test, typecheck, and build success as local evidence
   only. Push, publication, deployment, production/database verification, and
   customer acceptance require separate authorization and remain open.

## Invitation and Job Intake release gates - 2026-08-11

1. Preserve the canonical company-bound invitation and direct-member path;
   exercise existing-user, new-user, multiple-pending-invitation, concurrent,
   cancelled, and ambiguous-legacy-email cases in an isolated database before
   any release decision.
2. Exercise Job Intake metadata prefill, optional PDF/DOCX/XLS/XLSX/XLSM/CSV
   upload, ordered autosave recovery, document removal, stale-revision refusal,
   reload, and activation in English desktop and Spanish narrow-width browser
   states before live acceptance.
3. The flexible Smart Intake mapping and 100-plus Contract Item editor are now
   a separate local candidate described above; they are not part of pushed
   commit `1a45653691c750a5929ba6acd25ec415b66ef26b`.
4. Preserve the Build 4 local candidate's generated project-budget aggregate,
   immutable per-contract APU/financial baselines, Budget Accounts, workflow
   inheritance, and execution baseline. Do not introduce a duplicate contract,
   item, APU, workflow, budget, or PDF authority.
5. Treat local source, test, typecheck, and build success as local evidence
   only. Push, publication, deployment, production/database verification, and
   customer acceptance require separate authorization and remain open.

## Operational-register field acceptance - 2026-07-31

1. Preserve the local Activity Log and Coordinator Command Center correction
   until a candidate-bound production runtime-closure build exits successfully.
2. Bind Roberto's complete original PDF/UI evidence denominator to final
   artifacts; regenerate the affected families and inspect every affected page
   at original size, including all nine Activity Log pages and every
   Coordinator continuation page.
3. Obtain independent review of the exact immutable commit/tree/evidence before
   any separate push, publication, deployment, production, or live-acceptance
   decision. Source completion must not be reported as live acceptance.
4. Exercise the reconciled ProjectDetail, sidebar, Integrations, Pricing, and
   Features paths in English desktop and Spanish exact-390 browser states,
   including load failure, retry, denied, disabled, stale-response, focus, live
   announcement, console, request, and horizontal-overflow gates.
5. Preserve the F-root runtime-closure candidate
   `9506e5e3139665dd53fc519fea17f3ebc9603a0c` and its tree
   `0169ddd2d7ffa069f4ce135703e8e1db7af8b768` with the reconciled local runner
   and runtime-closure corrections. The strict-offline production build passed
   on 2026-08-04; do not rerun it unless candidate bytes change, install or
   fetch dependencies, alter protected lock bytes, or substitute a C-root
   checkout.
6. Treat a local build PASS as local build evidence only. Replit workspace
   preservation and exact source equality, Linux build/promotion, separately
   authorized publish/deploy, deployed health, customer workflow, and
   independent PDF/UI acceptance remain open and operator-gated.
7. The passwordless F5 candidate passed its single replacement strict-offline
   full build locally. Preserve the frozen commit and build receipt. Replit
   exact-target/credential/source verification, publication, and bounded live
   verification remain operator-owned: prove an eligible user needs no separate
   BIMAI360 password, a user without current eligibility remains denied, and
   all 11 authoritative sections load from the deployed source bundle.

## Recovery control loop - 2026-07-28

1. Register `F:\BIMLog\Repositories\bimlog` as the saved Codex BIMLog project.
   The C: Documents project is a pointer only and must never own product work.
2. Keep every task stopped until Roberto explicitly names the existing task to
   resume. Do not create, fork, replace, reactivate, rename, or archive tasks
   automatically.
3. Treat `0fd469acbbafa7af323629dc0cbad1126b5aaeb4` as a preserved,
   unvalidated 19-path PDF/report UX candidate. Its next permitted sequence is
   focused checks, build, independent UI/PDF acceptance, source freeze, then a
   separate release decision.
4. Preserve all 13 dirty and five unreadable historical worktrees as
   `UNKNOWN-PRESERVE`. No cleanup is authorized merely because a candidate
   looks old or duplicated.
5. Keep accepted source, local candidates, pushed source, deployed source, and
   live-accepted behavior as separate facts in every status report.
6. Enforce one approval budget per task. A repeated or timed-out request for
   the same action stops the task; it must never become an approval loop.
7. Reconcile the remaining historical worktree ledger only after the current
   PDF candidate reaches a terminal accepted, rejected, or preserved state.
8. Completion review corrected the inline PDF-only checklist on Project
   Insights, the Submittal current-view zero-result rejection, and unlabeled
   Activity Log operational filters found during local acceptance. Schedule
   now inherits the visible operational state and keeps only PDF-specific
   sections in the shared modal; Clash Reports list printing now targets its
   visible list branch; Schedule default buckets now initialize idempotently
   under parallel first-load requests. Contracts now gates its entire
   financial workspace and Print PDF action behind successful financial
   authorization. Shared and domain-specific footer stamping now prevents
   footer-only trailing PDF pages found during rendered-page inspection. Keep
   the candidate local until real
   desktop/exact-390px checks, representative every-page PDF inspection, and
   independent review finish.
   Before that handoff, the PDF owner must complete the mandatory family-wide
   generation, every-page inspection, contact-sheet comparison, correction,
   and selective re-render gate in `REPORT_DESIGN_SYSTEM.md` and `CLAUDE.md`.
   Roberto's review of 28 downloaded PDFs left these exact production findings
   unresolved:
   - Submittal title/branding/Ball-in-Court clipping;
   - native browser print on Clash Hits, Reports Hub, and Integrations;
   - accidental blank or nearly blank pages in Activity Log, Schedule, Project
     Insights, Project Health, Naming Compliance, RFI Aging, and Submittal
     Status;
   - inconsistent identity/headers across report families and missing nested
     `Reports & PDFs` origin;
   - weak or sparse Audit Certificate, Meeting Minutes, Project Performance,
     Change Order, and Transmittal presentations;
   - inconsistent source hierarchy in RFI and Submittal record artifacts;
   - `PDF` in the Project Team title and a Lens title/header collision;
   - project 26 needs audited `BIMCorp Inc` binding and appropriate Roberto
     test-admin financial authority without email hard-code or tenant bypass;
   - `Validate and Download` currently only routes to Files and must be removed
     from or relocated out of Integrations.
9. The continuation implementation resolves the source-level native-print,
   title/filename, nested company/source identity, Submittal clipping, and
   sparse report-presentation findings without changing tenancy or financial
   authorization. The single local production build passed. Fifteen
   representative governed PDFs covering every affected family were
   regenerated from the built API and all 28 rendered pages were checked with
   a compact contact sheet plus page-level text/page-number inspection; no
   blank or footer-only page remains. Real desktop/exact-390px EN/ES state
   evidence remains blocked because the connected Chrome control runtime
   fails during initialization with `Cannot redefine property: process`.
   Keep the work local for a clean candidate commit, coordinator callback,
   and the existing independent-review dependency; do not treat the browser
   gate as passed.
10. The bounded follow-up to local candidate `4f69ba8c` removes the misplaced
    Integrations `Validate and Download` Files shortcut, aligns governed
    visible current-view titles to `{Module} — Current View`, and corrects RFI
    record headers from product-only identity to the audited project company.
    The affected Integrations desktop/exact-390px EN/ES browser checks,
    current-view title checks, and record-level RFI/Submittal rendered-page
    inspection passed with synthetic local fixtures. Preserve the accepted
    family evidence these changes did not invalidate and keep provider,
    production, push, publication, and deployment outside this local seal.
11. The Lens/Viewpoint reporting follow-up on `5e0508f` automates Ruben's
    company/person, report-type, floor, code, revision, and open-item hierarchy;
    adds generated summaries by level, trade, responsible company, and status;
    defaults exports to Open; and applies existing role metadata so managers
    retain full project scope while other responsible parties receive only
    assigned rows. It also corrects the two remaining uppercase Submittals
    current-view separators and the affected Ball in Court column allocation.
    Focused typechecks, one successful offline production build, actual
    manager/assigned XLSX generation, all-sheet workbook inspection, every-page
    Lens/Submittals PDF inspection, and case-insensitive title scanning passed
    with synthetic local fixtures. Seal only the clean evidence-bound local
    candidate. Meeting Minutes, Proposed-RFI, schema, provider,
    production, push, publication, and deployment remain excluded.
12. The production-PDF family addendum on local Lens candidate `352586b`
    normalizes the supplied 18-family regression set to compact deep-blue
    company/project/report chrome, canonical current-view em dashes, repeated
    table headers, consistent footers and page numbering, and efficient content
    flow. It removes the RFI List metadata collision, generic customer identity,
    white Submittals continuation headers, Schedule and Project Insights cover
    waste, and avoidable Lens revision/sign-off pagination while preserving
    record-artifact boundaries, filters, permissions, and tenant scope.
    Nineteen synthetic local artifacts (the complete 18-family set plus the
    changed record-level Submittal) and all 45 pages form the final owner-QA
    evidence set; the 18 supplied production originals remain read-only
    regression references. Provider, production/customer data,
    database mutation, push, publication, and deployment remain excluded.

## Current terminal truth - 2026-07-23

### Ruben T1 current-view export and sidebar release validation

- Accepted local lineage: `5db399450adc5df92420012c2d30380444d681f5` ->
  `6cb212b368a20c6aaf5af61f34de5cc28c7e501d` -> `122d3b5216266fedd1eaee9f723ac398f2791281` ->
  `2be2ac0fa464ecc86ce95b7f5194e29a0dd7bfa1` -> `05fe1390739a433dfac392b03ee7f51e90dd3de2`.
- Independent review accepted the RFI lifecycle-aware Ball in Court and inclusive `23:59:59.999` end-date parity
  correction, the optional nullable `Rfi.ballInCourt` OpenAPI/generated React contract correction, and the
  one-file desktop sidebar viewport/independent-scroll correction for combined final gates.
- Offline dependency materialization, the TypeScript library prerequisite, and frontend typecheck passed on
  `05fe1390`. The production build stopped during `check:living-brief` before compilation/bundling because
  `state.json`, `STATUS.md`, and `OPEN_LOOP.md` had not yet been reconciled through the sidebar implementation unit.
- After independent acceptance of this governance-only successor, the heavy-gate owner must rerun the production
  build once on the exact accepted source. Only after a build pass may the real-app English desktop, Spanish
  exact-390px, RFI PDF, Submittal PDF, every-page visual, metrics, request-log, and hash evidence run.
- The full Orval/Zod generated RFI response inventory was already narrower than the runtime API and was outside the
  bounded type-contract correction. A separately authorized generated-client provenance decision must determine
  whether and how to regenerate/reconcile that wider inventory; do not silently treat the two-line contract fix as
  full generated-model convergence.
- Normal push and remote equality, provider/Replit alignment and complete preview, exact-source approval,
  publication, deployment, production verification, customer verification, and live acceptance remain pending.
  No provider, database, production/customer data, push, publication, or deployment action occurred in this lane.

### UI/auth and report-export UX serialized release integration

- Local release integration source currently ends at $head and combines only the authorized chain: Living Brief auth ac8df1334707666669f1697a40f2d593a32e5bd; Headquarters Slice 1 chain through e005d810ee328ff5bdca375592f9c7db8df79cfa; Meetings chain through 3c9df321bd92c54fe8850e54d8ea8184f3632836; Headquarters Slice 2 634d08d0b90af5913273c4e951673fd1418bbc76; Finance Budget d6a7ac1f245e761d1aafa5a101d4dccfc95537d2; and Finance Contract 982f1440f557587323f30cb032ac1eb55be8134d.
- Superseded Headquarters Slice 2 commit d7bcf76be2d14eae49ef0c7a10d17d55a198f59e remains excluded.
- Remaining gates before any publication are focused auth regression, typecheck/build validation, desktop and exact-390px Spanish browser proofs for the integrated UI surfaces, request/console/runtime/overflow/privacy cleanup checks, normal push if gates pass, remote equality verification, and a separate fail-closed Replit preview/publication decision. No Replit, production/customer data, database, provider, publish, or deploy action is part of this local source integration.
### UI/UX Foundation Phase A source candidate

- Serialized source candidate is based on authoritative master `6fc0f8ef48c23c07f89a3ad6b3928f6c552bcdfe` and
  changes only the shared Project Sidebar, foundational CSS, and representative non-RFI Reports Hub surface.
- The accepted Phase A behavior adds grouped project navigation, desktop expanded/collapsed shell behavior, Spanish
  exact-390px mobile drawer behavior, foundational responsive spacing tokens, and a clearer Reports Hub hierarchy.
- RFI export/report behavior, Project Insights backend behavior, Activity presentation behavior, schema/database,
  dependencies/lockfile, Security work, Telegram product code, plugins, Replit, production/customer data, publish, and
  deploy remain outside this lane.
- Remaining gates are focused browser evidence reuse/rerun as invalidated, serialized source validation, normal push,
  remote equality verification, and later deployment/customer acceptance only if separately authorized.

### Project Insights API correction and Activity presentation combined source candidate

- Combined source candidate is based on authoritative master `715fd6ad8ff0a9e80f69b6e969cfde3ff3c511b0` and combines
  only the independently completed Project Insights backend/auth/metrics correction and Activity presentation lane.
- Project Insights preserves tenant isolation, allows legitimate legacy same-company project-admin access when current
  binding metadata is absent, uses the real `files -> users -> companies` relationship for company metrics, emits
  live Command Center query parameters `ccView` and `ccPresentationStatus`, and fixes Spanish unavailable-reason text.
- Activity presentation now provides readable user-facing detail summaries across Dashboard, Admin, Profile, Total
  Control, and Project Activity without showing raw JSON payloads or internal keys.
- Remaining gates are serialized candidate proofs, Living Brief check, typecheck, database safety, secret/privacy,
  pre-push/final build validation, normal push, remote equality verification, and later deployment/customer acceptance
  if separately authorized. No Replit, production/customer data, publish, deploy, dependency, lockfile, schema, RFI
  export, Telegram product, or plugin work is part of this combined source candidate.

### RFI Visual Evidence UX clean integration; deployment and customer proof pending

- Clean source integration on authoritative master baseline `7532a8d4f879aeca01136535a0abfd5cefc5eb00` preserves the
  platform-wide Generate RFI Report modal and adds the RFI-owned Visual Evidence usability correction.
- RFI create/detail now makes source viewpoint and additional screenshots explicit, with empty state, preview
  thumbnails, add/upload/paste/capture affordances, captions, order/remove controls, and visible PDF/DOCX/Complete PDF
  inclusion wording. The approved normal-zoom RFI form layout is preserved.
- Editable response-capable states expose exactly one Save Response action after reconciling the dedicated response bar
  with the sticky action matrix.
- Existing evidence remains valid: artifact proof manifest
  `F:\BIMLog\Evidence\rfi-visual-evidence-ux-slice\20260725-visual-evidence\rfi-visual-evidence-artifact-proof.json`
  has SHA-256 `6590B2E18910DAE1A10CAA11BA32E8F24696FCCF8B1252F3669328303D5568C8`, and browser CDP proof manifest
  `F:\BIMLog\Evidence\rfi-visual-evidence-ux-slice\20260725-visual-evidence\browser-cdp\browser-cdp-proof-manifest.json`
  has SHA-256 `F5F07B0178C1E883372F59DE4DECBE3A3B1E39F926D8D9E9E62D77E3E38D6731`.
- Remaining gates are normal source push, later deployment/publication if separately authorized, Roberto/Ruben
  downloaded artifact confirmation for real RFIs, and customer field acceptance. No Replit, production/customer data,
  schema/database, dependency/lockfile, plugin, Telegram product, publish, or deploy action occurred in this lane.

### Deterministic Replit API artifact closure accepted locally; Republish proof pending

- Product commit `76addb6eb7b791a7579ca5c2e7d95a6526b544a1` makes the repository build the production
  runtime dependency closure instead of relying on Replit's optimizer or installed workspace links.
- Compatible pure-JavaScript packages are bundled. Native and asset-bearing packages, PostgreSQL, and every
  remaining external are deployed from the frozen workspace lockfile into the artifact, with no dependency link
  permitted to escape that artifact.
- The production build emits an esbuild metafile and runs the isolated artifact proof itself. PDF generation and
  parsing, Sharp, Canvas, SendGrid import, ZIP, DOCX, PDF-lib, bcrypt/auth, workspace links, exact `/api` non-5xx,
  and real health readiness must pass before the build succeeds.
- The local Windows proof passed with synthetic values and an unreachable loopback database. The frozen lockfile
  includes the Linux x64 native variants; the next Replit build must independently execute the same bound proof
  on its Linux build host before promotion.
- Replit's uncommitted Agent edits are not part of this source. Before realignment they must be preserved without
  merging them into release master; authoritative `master` must then be recreated cleanly from the accepted
  remote commit.
- The observed Vite failure resolving declared `@workspace/api-zod` is treated as damaged/incomplete Replit
  install state, not a Submittals source defect. After realignment, Replit must restore the frozen workspace
  installation and source attestation before Republish.
- Remaining gates are normal push, exact Replit master equality, clean frozen install, one explicitly authorized
  Republish, successful artifact-only Linux proof/build/promotion, deployed health, and customer-workflow
  verification. No Replit, database, schema, migration, secret, production, customer-data, Publish, or deployment
  mutation occurred in this source correction.

### Bounded Replit startup-risk correction accepted in source; Republish proof pending

- Product commit `3ae00ec0138fb2c443eae320b80b7b3383fe36fc` preserves exact `/api` as a
  historical non-ready `404` only during the bounded import window. It does not claim application readiness.
- `/api/v1/healthz` and all other paths remain `503` until the real Express application is loaded; import failure
  or the 45-second timeout changes `/api` to `503` as well.
- Sanitized timing markers identify bootstrap bind, application-import begin, application-import completion or
  failure, and the ready transition without exposing environment values or customer data.
- The synchronous top-level `which ffmpeg` subprocess is removed from module initialization. FFmpeg capability
  discovery is lazy, bounded, cached, and invoked only when meeting-audio transcription needs it.
- Actual bundled `index.cjs` proof reached ready in under five seconds with an unreachable loopback database;
  deterministic tests cover delayed import, historical `/api` behavior, readiness truth, failure/timeout, and
  delayed FFmpeg discovery. This removes the only verified pre-log blocking subprocess but does not label it the
  proven Replit root cause.
- Remaining gates are exact Replit alignment, one explicitly authorized Republish, provider Promote completion,
  and deployed health/customer-workflow verification. No database, schema, migration, secret, Replit Agent,
  production, customer-data, Publish, or deployment mutation occurred in this source correction.

### Replit early-port startup hotfix accepted in source; Republish verification pending

- Product commit `048bb095bd2d4cd553eb6eedd27e0b63969d768a` binds the production listener before
  the full application import and keeps startup or import-failure requests at truthful `503`.
- Successful initialization switches requests to the existing Express application; its canonical
  `/api/v1/healthz` response becomes the only `200` readiness result.
- The tracked Replit startup probe now uses `/api/v1/healthz` instead of the unmounted `/api/healthz`.
- Deterministic proof requires the port to bind well inside 60 seconds under a deliberately delayed import,
  remain non-ready until load completes, then become ready; a failed import must remain non-ready and log the
  failure.
- Remaining gates are exact Replit alignment to the accepted remote master, one explicitly authorized Republish,
  provider build/promote completion, and read-only deployed health/customer-workflow verification. No database,
  schema, migration, secret, product workflow, production, customer-data, Replit Agent, Publish, or deployment
  mutation occurred in this source correction.

### Final-six preview correction accepted in source; regenerated Replit preview remains pending

- Accepted product commit `86a30f23a1d4999b630fe71a6a8ff4e90cd04e7e` corrects the six remaining Replit
  drop/recreate authorities without table, record, production DDL, or RFI behavior changes.
- Read-only catalog evidence supersedes the earlier visual-preview inference: all three coordinator indexes use
  `DESC NULLS FIRST` in production while development was plain ascending. Declarative and startup authority now
  encode those semantics explicitly.
- The three RFI report-settings foreign keys now preserve the existing production `_fkey` names across declarative
  and startup authority rather than proposing Drizzle-generated replacement names.
- The exact final-six preview is a hash-bound regression fixture and fails the destructive SQL gate. Focused
  database safety, 133-table/147-index/93-startup-table reconciliation, typechecks, API build, secret/privacy,
  mojibake, and diff checks passed.
- Replit must cleanly align to the exact accepted remote master, run guarded development-only synchronization and
  parity, and regenerate the complete preview. The preview must be empty or explicitly inventoried additive-only,
  with zero destructive or unexplained statements.
- Mandatory next acceptance item: upgrade schema parity from name/count checks to semantic index comparison
  covering ordered columns, direction, null placement, uniqueness, predicate, access method, expressions,
  operator classes, included columns, and constraint definitions. Bind that semantic parity and the destructive
  preview parser into pre-push/final gates for every schema or startup-migration change.
- Preview rehearsal must occur before release day. Declarative schema is the single schema authority; new
  runtime-only table/index definitions are prohibited unless mirrored in declarative source and covered by parity
  and regression proof.

### Replit complete-preview name alignment accepted locally; final preview remains pending

- Local source commit `a761ff82b65226ac9c7fd782b6f69a60a3e1da1b` aligns all 105 constraint/index authorities
  from the rejected complete Publish preview to the existing stable database names and definitions. It does not
  drop, rename, rebuild, or rewrite records.
- The exact rejected preview is a hash-bound regression fixture: 87 `DROP CONSTRAINT` and 18 `DROP INDEX`
  statements must fail closed, and every affected authority must remain explicitly declared in source.
- Disposable PostgreSQL first-run and repeat declarative application completed with zero `DROP CONSTRAINT`,
  `DROP INDEX`, `DROP TABLE`, `CASCADE`, `TRUNCATE`, or `DISABLE RLS` statements. Source safety reports 133 tables,
  147 indexes, and 93 startup tables reconciled.
- Remaining gates are normal source push, exact Replit master attestation, guarded development-only sync and
  constraint-aware parity, and complete regenerated preview inspection. Publish is permitted only after that
  preview is empty or explicitly inventoried additive-only and Roberto separately approves Publish.
- Known credential/JWT replacement risk remains owner-deferred until after Ruben's urgent delivery and is not
  resolved by this schema correction. No Replit, database, provider, credential, production, customer, publish, or
  deployment action occurred in this source cycle.

### Connector Governance Phase 1 accepted in source; deployment verification pending

- Accepted Connector Governance Phase 1 source at `dd41c79607a6f51e19eb2d63febb92b1d74edb27` is based directly on
  current accepted master `f13d538074878822e56a7d780113d3517dffacdf` and preserves all RFI report, Coordinator,
  Security, Living Brief, Meeting, Finance, Telegram, and Navisworks history without importing stale candidate
  ancestry.
- The accepted boundary makes the server-side provider catalog the customer-facing connector authority. Default public
  capabilities are limited to IFC/openBIM, document exchange, BIMLog Lens/Navisworks, Google Drive, and Dropbox;
  governed/private providers remain hidden and denied unless a company-specific approval token permits the exact
  operation.
- English and Spanish customer-facing copy no longer presents unavailable private connectors, managed password/API-key
  submission, or inaccurate project-file storage/privacy claims as current behavior. The UI directs users to approved
  capabilities and warns not to send passwords, API keys, or access tokens in integration requests.
- The correction does not add schema, migrations, package/lockfile changes, credential testing, provider setting
  mutation, Replit work, publication, deployment, production/customer access, or customer data access. Publication,
  deployment, runtime verification, and any future customer/provider approval remain separate.

### Urgent database publication safety gate accepted locally; Replit source repair and publication remain blocked

- Clean integration commit `f5d2ef4bd76115bb9f595ad803adcbdf2e9a2104` is based directly on authoritative
  `origin/master` `8c9d1aaf735932b4f5ed2d271cfeef7925ddc635` and reapplies the nine-file candidate without
  importing candidate ancestry.
- Independent hardening closed comment-separated destructive-SQL bypasses, requires the production identity to be
  present for comparison, restricts development mutation/parity to Replit Helium, binds the source contract to
  freshly read remote master, and requires a complete hash-bound additive preview inventory.
- Official Replit documentation says development structural deletions may be applied to production at Publish. No
  supported `.replit` switch was found to disable that authority, and the two opaque artifact IDs cannot be safely
  reclassified from repository evidence. Replit publication remains human-gated; the root build is not a pre-migration
  kill switch.
- The read-only Replit audit used stale deployed source `2c1ffc4b5c08618610cdb70b42fcb08556726f1c`,
  saw 97 Drizzle table declarations, and proposed 33 `DROP TABLE ... CASCADE` statements. Accepted local source has
  132 tables, 140 indexes, and all 92 startup-created tables reconciled. Do not duplicate the 33 declarations.
- Before any future Publish, preserve reviewed Replit workspace-only files, fast-forward clean local `master` to
  freshly fetched remote master, attest exact equality, run the separately approved guarded Helium sync, prove
  read-only parity, and regenerate the preview. The preview may be empty or explicitly inventoried additive-only;
  it must contain zero DROP, CASCADE, TRUNCATE, RLS disable, or unexplained removal.
- Publication remains blocked pending a verified restore point, exact pre-publication record counts for every
  affected production table, complete SQL and deployment logs, Roberto's explicit approval, deployed-commit
  attestation, and exact post-publication counts. No database, Replit, production, or customer access occurred in
  this integration review.

### Coordinator Command Center Build 4 accepted in source; deployment verification pending

- Accepted Coordinator Build 4 source at `6f96a3f2385a08c3e364099178617d4ec16dfcf5` is based directly on Security
  Batch C master `5d71fe6150c332b28f3e2274afeebdcf0a7fc146` and preserves the Batch C commits
  `cf2edd9125d797109215ed0e03d0e08d27f13ff0` and `5d71fe6150c332b28f3e2274afeebdcf0a7fc146` plus all prior
  Coordinator, Meetings, Finance, Security, Telegram, and Living Brief history without importing stale candidate
  ancestry.
- The accepted boundary correction keeps Coordinator Command Center as the Act surface: current actionable records,
  My Items, overdue/due soon/blocked work, responsibility/ball-in-court, saved operational views, selection, governed
  actions, and only four contextual counters: actionable, overdue, due soon, and blocked.
- Analytics is renamed Project Insights & Reports / Perspectivas e Informes and becomes the Understand/Report surface
  for compliance, bottlenecks, company performance, RFI aging/status performance, honest unavailable states, and
  governed report links. Recent Activity, Recent Files, operational task lists, and the Schedule placeholder are removed
  because their canonical owners are Activity Log, Files, Command Center, and Schedule.
- Shared server-side metric definitions govern counts, status buckets, date boundaries, and permissions; actionable
  insights deep-link to exact filtered Command Center records, and links grant no authority.
- Lens/Viewpoint identity, Coordinator Build 3 bulk actions, Clash deferral, AI/notification boundaries, and canonical
  module authority remain unchanged. Publication, deployment, production/customer verification, field acceptance, and
  Build 5 remain separate and unstarted.

### Security Batch C Axios correction accepted in source

- Integration commit `cf2edd9125d797109215ed0e03d0e08d27f13ff0` is based directly on accepted `origin/master`
  `ed8b94bd4f7e73f3ad5bbb1d236f4b474f4fae1a` and preserves all Coordinator, Meetings, Finance, Living Brief,
  Security Batch A, and Security Batch B history without importing stale candidate ancestry.
- The sole dependency constraint is an exact Axios 1.18.1 override in canonical `pnpm-workspace.yaml`.
  `@sendgrid/mail@8.1.6` and `@sendgrid/client@8.1.6` remain unchanged; `form-data@4.0.5` remains on its already
  corrected line. The lockfile delta is limited to Axios and its required HTTP/proxy transport dependencies.
- The existing email wrapper now applies fixed finite transport defaults: 10-second timeout, 512 KiB request body,
  64 KiB response body, and zero redirects. The official SendGrid destination, server-owned credential boundary,
  JSON mail serialization, recipients, templates, authorization, preferences, logging, and asynchronous/non-fatal
  caller behavior are unchanged.
- The bounded loopback-only transport proof covers JSON serialization, credential confinement, fixed destination,
  proxy bypass, redirect rejection, timeout, request/response limits, controlled provider errors, and all inventoried
  `sendEmail` caller modules. No provider or production service was contacted.
- Source acceptance includes frozen installation, focused transport proof, exact lock review, Living Brief matrices,
  typechecks, and one final complete workspace build. Only normal fast-forward source delivery is permitted;
  publication, deployment, production/customer access, and Batches D-I remain separate.
- The historical registry snapshot remains last-known only; this candidate makes no fresh registry-wide count claim.

### Coordinator Command Center Build 3 accepted in source; deployment verification pending

- Accepted Coordinator Build 3 source at `18154f359ea45783eda54fe3a52111d9f45fb41a` adds explicit-confirmation
  bulk actions from the existing Command Center register without creating duplicate canonical records. RFI and
  Submittal items can be added to accessible Meeting Minutes through accepted canonical link behavior; supported
  Submittal actions can create/link/sync accepted M4 Schedule Buckets/tasks with deterministic per-item outcomes.
- Lens/Viewpoints remain first-class Lens terminology and exact identity/navigation records. Build 3 does not mutate,
  duplicate, relabel, merge, or substitute Lens/Viewpoints; Clash aggregation/substitution remains future scope.
- Focused proof, typecheck, and browser evidence were preserved through English desktop and exact 390px Spanish mobile
  flows, including preview, confirmation, execution, Schedule create/sync, overflow, console, and local request checks.
- Remaining operational gates after source push are publication/deployment, production verification, customer/field
  verification, Build 4 notifications/digests, Build 5 feedback tooling, and any future Clash work. No production or
  customer data was accessed by this source integration.

### RFI List/Log governed PDF correction in local review

- Roberto identified a platform-rule violation: RFI List and RFI Log views were user-facing operational reports
  without governed Print/PDF actions.
- Local correction adds visible Print PDF and Export PDF actions to both RFI views. The route preserves active
  view, status filter, search, project identity, generated timestamp, prepared-by identity, report number,
  page numbering, repeated table headers, readable landscape column widths, and the RFI module design family.
- Product distinction is explicit: RFI List uses Ball In Court as current responsibility; RFI Log uses Sent To Co.
  as historical transmission destination. They are not conflated.
- Source verification passed locally in the isolated worktree. No publish, deployment, production/customer access,
  schema change, or Navisworks/plugin change occurred in this cycle.

### Ruben urgent Meeting workflow correction accepted and pushed in source

- Accepted Meetings source at `bec190ac248fc5134f742b1bafbc673a594e52ec` adds persistent canonical company
  registration from attendee rows, reusable project-directory
  contact selection, attendee canonical directory identity, compact linked RFI controls, exact RFI deep-link navigation
  with Meeting draft return context, and durable server-authoritative new Meeting draft restoration on direct return,
  tab navigation, and refresh/restart.
- The candidate preserves Meeting snapshots and existing RFI/Submittal/Schedule/Lens/legacy behavior; viewing an RFI
  does not mutate the RFI, and RFI status/responsible edits use the canonical RFI route with current authorization and
  stale-update protection.
- Expanded local Chrome proof passed in the isolated `127.0.0.1:55432/bimlog_rfi_test` harness. Source integration
  and normal push are complete. Publication, deployment, production/customer verification, and field acceptance remain
  separate; no production/customer data access or Replit action occurred.

### Built-asset lifecycle operating network roadmap validation

- Roberto approved recording the long-term BIMLog roadmap from construction coordination to verified construction
  record, asset passport, maintenance obligation engine, condition/IoT events, controlled work orchestration,
  contractor/supplier network, executable contract rules, and circular-material recovery network. This is approved
  strategy, not implemented product.
- Validate market assumptions before using them in pricing, fundraising, sales, or product commitments: World Bank
  world GDP baseline, buildings/construction context, BIM-connected activity percentages, governed-value scenarios,
  asset value under management, O&M spend orchestrated, willingness to pay, effective take rates, and business-model
  mix. Do not canonize "3% of world GDP uses BIM" until independently verified.
- Research standards and interoperability implications before implementation: ISO 19650 operations/handover,
  ISO 55000/55001 asset management, IFC, COBie, IDS, ICDD, data templates/dictionaries, IoT/BMS/CMMS interfaces,
  cybersecurity/privacy obligations, contractor qualification, insurance, licensing, payment/settlement, warranty,
  waste/recycling, carbon, and regional compliance.
- Pilot discovery required: owner/operator interviews, Ruben field feedback generalized beyond customer-specific
  needs, asset-passport sample data, warranty/SLA obligation examples, manual inspection workflows, contractor/
  supplier matching constraints, circular-material recovery evidence, and legal/regulatory review.
- Near-term product constraint: keep current construction coordination excellence, verified records, handover
  foundations, and short evidence-backed releases first. Do not start IoT, marketplace, blockchain, payment,
  provider, production, or schema implementation from this roadmap without a separate scoped directive and
  capability preflight.
- Organizational excellence and adoption validation required: verify the current EFQM model/version before any
  formal adoption claim; confirm Prosci ADKAR trademark/licensing/training/use boundaries before branded templates,
  commercialization, certification claims, or copied proprietary content; decide which ASQ-recognized tools belong in
  BIMLog's quality toolkit; define PDCA/PHVA pilot templates; test whether customer pilots actually achieve ADKAR
  adoption outcomes instead of only shipping software.

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

### Tracked Replit credential removal accepted in integration source; operator replacement pending

- Accepted candidate `b17d5c730d00947e1c812e1e3a93d58995a7f3dd` removes two secret-like assignments from tracked
  `.replit` value-blind, preserves the guarded Helium development sync, and relies on Replit Secrets/environment
  injection for runtime values.
- The new publication gate scans only explicit environment, Replit, tool/runtime, workflow, package-manager, and
  deployment configuration conventions. Finite fixtures prove representative route, UI, schema, and ordinary source
  modules remain outside that scope while covered files fail closed on literal database URLs or secret-like values.
- The original continuity exception remains active for working credentials not proven exposed. It does not permit a
  known exposed literal to remain in source. Database and JWT replacement, health/session verification, revocation,
  and history remediation require approved operator work and were not performed by source integration.
- Replit remains divergent at preserved local head `096a961818320e9a209b97964900839609582b79`. Preserve its seven
  local commits on a separate branch, create clean `master` from the future authoritative remote only after all source
  integrations finish, then require guarded development sync and a complete non-destructive preview. Publish remains
  blocked.

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
- The last accepted registry snapshot after Batch A contained 94 records: 0 critical, 41 high, 46 moderate, and 7 low.
  Multer contributes zero remaining records. Batch B is separately accepted below; no fresh registry-wide count is
  inferred for the remaining findings.
- Remaining boundary: normal push of the integration and acceptance commits plus exact remote ancestry/equality
  verification. No publish, deployment, production/customer access, or external security testing occurred.
- The one persistent UI safety notice remains one visible notice only and is excluded from Telegram.

### Security Batch B SheetJS correction accepted in source

- Integration commit `d4aa7ed91b1a439f8144956554e4044b95cd6979` reapplies the reviewed candidate
  `b6498cefd4d833c46868426e71db2f6520da3241` directly to Meetings master
  `bec190ac248fc5134f742b1bafbc673a594e52ec` without importing the candidate's older ancestry.
- Both direct consumers resolve the exact provenance-verified official SheetJS CE 0.20.3 tarball; 0.18.5 and its
  seven exclusively used transitive packages are absent. `pnpm-workspace.yaml`, every override, and every platform
  exclusion remain unchanged.
- The canonical spreadsheet policy preserves date-only calendar values independent of machine timezone, normalizes
  only explicit-offset/Z timestamps as instants, preserves or rejects timezone-less date-times without implicit local
  conversion, and keeps unknown cells raw. UTF-8 CSV with and without BOM, XLS/XLSX numeric dates, server/browser
  parity, Finance Budget/Contract, RFI exports, Submittals, Clash Reports, shared extraction, and Complete Package
  conversion have bounded compatibility coverage.
- Exact candidate evidence is retained outside the repository with manifest SHA-256
  `37c6575eed756152af8ad2d318c5670dd56efd58729725da01f7a6e2802fa205`. No fresh registry-wide count is claimed;
  Batches C-I remain unstarted and require separate authorization.
- Publication, deployment, production/customer access, external security testing, and Batches C-I are outside this
  acceptance. Normal source push and exact remote verification are the final source gates for this cycle.
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

## Cost & Financial Control Build 3 Accepted

- Accepted scope: owner/prime contracts, subcontracts, purchase orders, consultant agreements and other commitments, immutable/versioned contract terms, SOV lines mapped to approved cost structures, amendments and amendment lines, separate approval and execution, exact approved-budget reconciliation, controlled over-budget escalation, optional Schedule references, bounded CSV/XLSX SOV preview/confirm, searchable Contract/SOV PDF and native XLSX exports, and internal record-level confidentiality grants.
- Contract workflow is `draft -> submitted -> under_review -> returned/rejected/withdrawn or approved -> executed -> superseded/terminated/voided/closed`. Amendment workflow is `draft -> submitted -> under_review -> returned/rejected/withdrawn or approved -> executed/voided/superseded`.
- Executed records pin exact approved budget snapshot, cost-structure version/nodes, currency, and optional Schedule references. Commitment values change only through authorized execution. Approval and execution remain separate authorities and actions.
- Finance authorities from Builds 1-2 remain explicit. Financial Administrator does not inherit approval or execution. Super Administrator status does not silently bypass the Finance contract. Entitlements, tenancy, project membership, suspension, record grants, maker/checker separation, exact decimal limits, currency scope, stale version, retry, and concurrency are rechecked transactionally.
- Build 3 adds only construction financial contract/commitment control. It does not add payment applications, bank integration, accounting posting, money movement, external subcontractor/vendor portals, automatic AI, AI calls/charges, Build 4 Cost Event work, ERP exchange, or pricing/change-management expansion.
- Reused evidence: Build 3 focused behavior, PostgreSQL, authenticated API, import/concurrency, Build 1/2 regressions, typecheck/build checks, and browser acceptance. Browser acceptance passed English desktop and Spanish exact 390px product assertions; the only retained warning was pre-existing blocked `fonts.googleapis.com` CSS, classified as a platform font warning for Localization/UI.
- Focused current-master shared regression passed 44/44 after stale external harness assertions were corrected without product changes. Reconciliation onto current master preserved Meeting Minutes, Living Brief roadmap/quality-framework content, Telegram Build 6, Security Batch A, Portability, Plans/Entitlements, RFI/Submittals, Navisworks, startup, routing, schema, and sidebar history.
- Sanitized external evidence remains under the retained Finance Build 3 evidence package; shared-regression completion SHA-256: `369ab08d51160d19f83c4373dad3fa39fbe998f662ff2c48485ac011de66fe4a`.
- No deployment or publication occurred. Finance Build 4 remains unstarted. Security Batch B is separately accepted
  above; Security Batches C-I remain unstarted.

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
- The canonical entitlement resolver remains a separate required advisory gate and cannot authorize financial execution. The bilingual Settings -> Financial Controls interface exposes only the current user's redacted effective state unless an explicit Financial Administrator or Auditor grant permits more. No budget, contract, commitment, Cost Event, forecast, payment application, ERP synchronization, financial AI, accounting posting, or money movement was added.
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
- **KNOWN NONDETERMINISTIC TELEGRAM BUILD 3 HARNESS TIMING EXCEPTION - NO STEP 2 PRODUCT REGRESSION PROVEN.** The first complete harness attempt passed 29 checks before the restart-accountability checkpoint observed the queued continuation as `processed` without its delivery message ID settling inside the polling window. Existing delivered-message identity and attempt count remained unchanged, support lifecycle and AI settled/failed state persisted, and no duplicate charge or false delivery was observed. The single clean rerun passed 18 checks before the combined English multi-turn observation checkpoint returned false after its short queue-drain timing window; that failed assertion produced no evidence of cross-user exposure, duplicate charge, false delivery, lost persisted state, failed restart persistence, or a production-source exception. Neither failed checkpoint is claimed as passed, and the full Build 3 suite was not run a third time.
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

### RFI Report Template Settings - Accepted Source Integration

- Accepted source adds governed per-project RFI report settings for Standard PDF and DOCX, including default and
  Ruben lean presets, hide-empty behavior, stable section/field IDs, preview, stale-version protection, and
  export activity settings snapshots.
- Root-cause fix: viewpoint-created RFIs stored the screenshot file but did not persist the file ID
  into `image_presentation_json`; exports could not select the linked source screenshot.
- Source adds source viewpoint screenshot and additional report screenshot controls to the canonical
  report settings model. Independent evidence accepted browser UX, PDF/DOCX parity, image ordering/captions,
  Spanish 390px behavior, and Complete PDF package parity before clean integration.
- Correction supersedes `11c1a322`: Complete RFI PDF now passes the same project report-settings
  snapshot into the embedded canonical RFI page as Standard PDF and DOCX. A deterministic regression covers
  shared settings version/hash, Ruben lean section visibility, and source/additional screenshot fields.
- Final correction gates Project RFI Report Settings visibility to project-admin authority or super-admin
  authority, matching the admin/write API contract instead of showing the control to every broad write role.
- Accepted evidence hashes: browser `50d8890d3f1d9bd685511a799bde245da489dde5c0a3dc1470c33e627cba104b`,
  DOCX V2 `f99fd27c5526232e47125aee2b09549950a3fe44c0b9145cc08a192b0482c1b0`, Complete PDF
  `f431c9a729964c4028a0effebd5d696720ad0a6b0f6586af721937e243e2401e`, Complete PDF verification
  `b79d8fa7f2169a173bb7ce3d9b37a07eedd0fc9f4b07e16c5aa2dc0db78c60cf`, and consolidated final evidence
  `0419a5189f75281aaadda806db25d940bfeef76d56bef19b24a71210ac095eb2`.
- Boundary: clean source integration only; not published, not deployed, no production/customer data access,
  no plugin changes, and Finance is not a release blocker for this RFI integration.

### Replit Constraint Collision Publication-Safety Hotfix - Local Source Candidate

- Exact release baseline: `9cbda7d27c7b9a4695cf47ca7d3afd760b1cf73d`; Finance remains excluded.
- The observed development sync attempted a duplicate PostgreSQL constraint name after 63-byte identifier
  truncation, emitted an error, returned zero, and passed the prior table/index-name-only parity check.
- Local source commit `907a58846ff322138647dd478eb80ead204e5aa3` gives the confirmed-contract-version
  foreign key and uniqueness authority distinct explicit names, preserves existing rows and the historical
  constraint, and adds the new constraints transactionally and idempotently.
- Duplicate confirmed-version references cause a fail-closed startup error; the migration does not delete,
  rewrite, or silently deduplicate records.
- Development sync now rejects database-tool error output even after a zero exit. Parity verifies the exact
  required foreign-key and unique definitions in addition to required table and index names.
- Local proof passed with synthetic PostgreSQL rows for additive reconciliation, a second idempotent run,
  exact definitions, duplicate-data refusal, full transaction rollback, and unchanged row counts.
- Remaining gate: normal source push, exact Replit master alignment, authorized guarded development sync,
  complete constraint-aware parity, and a complete empty or explicitly additive-only preview. Any emitted
  error, destructive statement, missing/truncated log, or unexplained change blocks Publish.

### UI/Auth/Report Export Release - Browser Revalidation Passed

- Superseding local candidate `5c6700cc65b0d46beb5939b33e6a2041ebf8b057` fixes the two browser blockers
  in the serialized UI/auth/report-export release: Spanish exact 390px Dashboard KPI/CVR/helper labels and
  Meetings mobile project identity/context occlusion with mixed-language visible copy.
- Browser revalidation evidence:
  `F:\BIMLog\Evidence\uiux-auth-serialized-release-owner-20260726-final\browser\browser-revalidation-5c6700c-summary.json`
  plus paired Dashboard/Meetings Spanish 390px PNGs. The evidence is sanitized synthetic local interception
  only, with no backend, database, production, customer data, or secrets.
- Remaining release boundary: official final gate, normal push only if remote topology still matches the
  accepted baseline, fetch/remote equality verification, and separate provider/Replit publication preflight.
  Nothing is published or deployed by this local source release step.

## Closed / Shipped

### Platform Build 7 Advanced Contracts v1.60.35.07 - Local Integration Candidate

- The complete verified backend owner series was serialized before the complete UI owner series from
  Build 6 baseline `601bf94aa5505d0137f8ae1858b40356d9f3aaf6`; owner history was preserved without conflicts.
- The integrated scope governs payment creation, submission/review/return/reject, immutable successor
  revision and resubmission, approval, withdrawal/void, exact SOV foreign-key identity, cumulative
  executed-contract/amendment ceilings, stable replay/conflict behavior, and attributable append-only history.
- Local isolated evidence covers additive migration twice, database defenses, authenticated lifecycle and
  record/tenant/project permission denials, two-request revision concurrency, two-session approval concurrency,
  rollback/zero residue, focused production-component UI states, and routed English desktop plus Spanish
  exact-390 behavior including reload, history, denial, and suspended states.
- Release boundary: local clean-integration candidate only. Normal push, provider publication/deployment,
  production migration, and customer/field verification remain separately authorized external gates.
- Sanitized commit-bound integration evidence is retained in
  `artifacts/api-server/evidence/build7-integration/2657c7372f8445f450a711e5d7ff8cf324ac4238.json`.
- Authenticated negative coverage now explicitly proves cross-tenant record hiding and cross-project
  `FIN_SCOPE_MEMBERSHIP_DENIED`, with zero payment/history disclosure and zero mutation. This closes the
  remaining local history-access evidence gap; external source/release gates remain unchanged.
- Pre-push rehearsal found a local runtime-closure evidence-directory race after successful assembly.
  The bounded build correction recreates the directory before writing the terminal receipt; the exact
  authoritative pre-push command must pass at the final clean HEAD before operator handoff.

### RFI List and Log Governed PDFs

Accepted source on 2026-07-23 after replaying reviewed candidate `5e2806c3a36391a32d384bf3913cee54e68b6e07` onto authoritative master without importing old candidate ancestry.
RFI List and RFI Log now expose governed PDF actions that preserve current view semantics, filters, search, sort, project identity, generated timestamp, prepared-by identity where available, repeated table headers, readable widths, and page numbering.
List output uses Ball In Court as the current-responsibility field; Log output uses Sent To Co. as historical transmission metadata.
No schema, Navisworks/plugin, publish, deploy, production/customer access, or unrelated platform PDF build occurred.

### GitHub Merge Reconciliation
Resolved and pushed after manual Shell merge.
Remote master includes the Replit work plus Codex's Replit branding removal commit.

### Replit Branding Removal
Production no longer depends on old bim-log-ignite.replit.app references in searched source paths. Continue to prefer bimlog.app in user-facing URLs and OAuth callback docs.

## Consolidated Living Brief release lineage

- Complete the exact clean local build and artifact-level authenticated Living Brief proof for the current
  consolidated commit after Living Brief metadata reconciliation.
- Preserve server-side eligibility, user identity, and credential-version/revocation checks; eligible access
  remains passwordless and ineligible access remains denied.
- Verify the isolated production artifact contains every authoritative Living Brief asset, binds its source
  commit, and loads all 11 documents through the authenticated API.
- Keep the accepted Linked Items, Project-26 Procore RFI import, clash delete-reason, delete-confirmation, and
  meeting-autocomplete changes plus the clean six-path Generic APU UI in the same local lineage without
  customer database execution.
- Remaining operator gates are explicit: normal push, exact provider target/revision verification, authorized
  publication/deployment, and bounded live browser acceptance. None has occurred in this reconciliation.
- Seal the deterministic regenerated platform inventory with the final clean artifact receipt before any
  separately authorized provider or publication action.
- Retain the accepted Commercial/Financial backend set in the consolidated build while keeping migration and
  customer/production database execution outside this local release step.
- Re-run the scoped APU proofs and consolidated clean build against `384ffcb8…` after the active RFI schema
  reservation is resolved; keep database execution and provider/publication gates separate.
- Run the consolidated clean build and exact-current-artifact acceptance after the Project-26 RFI five-path
  integration; live database, provider, push, publication, and deployment remain separate gates.
- Preserve the exact reviewed database-safety allowlist and regression fixture while running the consolidated
  build; any different destructive DDL remains fail-closed.
- Retain the reconciled passwordless authentication regression in final acceptance; the exact-current API
  build remains blocked on separately owned APU TypeScript defects and the authenticated HTTP proof remains
  a separate approved-database-fixture gate.
- Preserve the exact two-path APU startup registration and its 13/13 proof while resolving the remaining
  pre-existing APU harness type errors before the exact-current API build.
- Preserve the narrow APU harness TypeScript corrections and their focused proofs while completing the
  exact-current consolidated build; the DB-backed authority harness remains a separate approved-database gate.
- Use `pnpm --filter @workspace/api-server test:generic-apu` as the single Generic APU calculation, security,
  persistence, and UI TypeScript acceptance command. The exact local source at `d9869477354aee8c0d5e03e146137044231897ac`
  passes this command plus the API and UI production builds; normal push and separately authorized publication remain.
- Preserve the whitespace-only `TeamPerformanceWorkspace.tsx` release seal at
  `1a45653691c750a5929ba6acd25ec415b66ef26b`; no product behavior or schema gate is reopened by this reconciliation.
- Preserve the exact schema object names and `DESC NULLS FIRST` semantics sealed at
  `08151f39e0db79c0196d50e64cd60b651c4f4992`; any provider preview containing DROP/recreate churn remains a hard no-go.
- Keep `PLATFORM.md` generator-owned and require API build followed by `check:living-brief` to leave the release tree clean.

# Feedback operations v1.60.35.11-F - Remaining External Gates

- Preserve exact accepted local source `2376b3cc5fb561235e61a009237a487820e14354`, tree `5bc5a052108e8839abb71ef4058ce908dd7bbf0f`. It is not pushed, synchronized to Replit, published, deployed, production-activated, customer-verified, or field-accepted. Do not infer any external state from this documentation reseal.
- Preserve integrated controlled Chromium manifest SHA-256 `12B12BB3B225B532BF28B56BFC67039E8323DFD54BA3957FFD4CC147EE7891CF`: exact pre/post head `2376b3cc`, 256 production inputs, isolated bundle, 100/100 assertions, six scenarios, and seven screenshots. Controlled browser evidence does not prove live database, scanner, Telegram, receiver, Replit, customer, or production behavior.
- Preserve visually accepted Build 11 package hashes: PDF `5DACFAB3DFC6CD3751B4BB4E6D752A316E9648DA770E3C992E16D8E12B6A0066`, DOCX `7078DCD2991AFD694A3A4CD173421DE541CD3DC7171114072B6F2BA05FD9E233`, and XLSX `68C752F3F617B38350E458CD3AB23CC0C9188A27A3BB6EF14B67F95B237AF29B`. Regenerate and inspect after any material report or source change; local artifacts do not prove production output.
- Preserve only the truthful disposable PostgreSQL statement: relay schema 61/61 and HTTP/DB 38/38 passed twice at the integrated source, after which the PG18 cluster stopped and the exact disposable root was removed. Do not invent a retained receipt path or digest. A production migration remains separately authorized and verified.
- Before scanner activation, verify the deployed governed executable identity/version, current signature database, startup health, clean/infected/operational-failure receipts, fair concurrent claims, crash reclaim, bounded backoff/manual review, and progress of existing-quarantine backfill. Never mark evidence clean manually.
- Before Telegram activation, verify existing approved value-blind configuration, current consent and enabled Feedback-package preference, connected super-admin recipients, exact DOCX/XLSX byte/hash authority, per-cell idempotency, bounded retry, and unknown/manual-review handling without blind resend. Otherwise remain default-deny and make no provider call.
- Keep the Windows receiver at `F:\BIMLog\Feedback` unmounted until reachable governed TLS, pinned identity, signed receipt/readback, exact-byte projection, backup/restore drill, monitoring, retention, and failure recovery are independently accepted. App Storage remains temporary custody, not proof of receiver backup.
- Only after the exact source is independently accepted may a separately authorized normal push establish remote equality, followed by clean Replit synchronization, non-destructive preview, one authorized publication, bounded deployed verification, and customer acceptance. None occurred in Build 11 local acceptance.

# Feedback backup operations v1.60.35.12-F - Remaining Acceptance and Activation Gates

- Preserve accepted Build 12 product source `35f645aeca7f179befb8de95d5e5b7c4d9bacde6` and controlled-browser harness successor `fbdc23377217bfa5766ec0f6e25bb8a56162df9c`. The exact clean full workspace build/runtime closure passed, and controlled Chromium proof is sealed at 102/102 with manifest SHA-256 `4CFE0B917B099DFCA696FCADEDB238526771F9ECCACA2A0FA231F3B8F2AAE221`. Retain the final docs-only reseal and clean-head verification before normal source push; no external activation is inferred from local acceptance.
- Production backup activation requires a collision-new private App Storage bucket different from the primary bucket, a protected 256-bit AES key and non-secret key ID, exact deployment-scope binding, startup health, controlled clean/tamper/failure evidence, automatic backfill progress, and a retained exact-byte/hash restore drill. Secret values must never enter Git, logs, receipts, UI, or customer data. Key rotation and retention must preserve restore authority for historical envelopes.
- Keep primary evidence available and scanner quarantine fail-closed when backup is unconfigured or degraded; operations readiness must visibly remain blocked or manual-review rather than implying protection. Never mark a backup verified by database edit or by successful upload alone.

# Lens Next v1.0.07-Pro / M7 - Remaining Field Gate

- Preserve exact local repair source `69b5c916cf27a2367400135d590ca6cbf7e9f690`, tree `d5f30a02a70fa506b13429fc01dacac381630373`, and unchanged M7 ZIP SHA-256 `C448827E1B3D657E272E0D82EE4A7D9DD8B42DA4C72CEB500E848B5533A3B356`. The local repair has passed its focused behavior, UI typecheck, production UI build, and artifact verification gates.
- After explicit authorization, push the exact reconciled source normally, verify remote equality, synchronize only through the visible Replit Shell without Replit Agents, build, publish once, and verify the deployed commit before starting the field test.
- Final acceptance must occur in real Navisworks Manage 2021 against project 26 and `C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd`: the embedded panel occupies the available viewport, issue/filter and detail panes remain side by side at the actual dock width, each pane scrolls independently, selecting an issue shows its exact details, and **Open working view** produces a visible temporary Working View without creating or changing Saved Viewpoints.
- Retain bridge port `8766`, native registration, model/database/authentication boundaries, Legacy Lens, and all unrelated BIMLog modules unchanged. Do not begin M8 or enable production publishing from this M7 repair.
- M8 has now begun only in the isolated local successor described below. The M7 field test is still required and must not be backfilled from M8 web evidence.
- Scanner production signature health/backfill, consent-bound Telegram provider delivery, receiver TLS/readback/projection, production database migration, push, Replit synchronization/publication, deployed verification, and customer acceptance remain separate gates. The Windows receiver remains unmounted and `F:\BIMLog\Feedback` receives no bytes from this source build.

# Lens Next v1.0.08-Pro / M8 - Remaining Acceptance And Release Gates

- Preserve exact local product source `98e0ed974a488e4b4a514c40cd47d779a4d067cc`. M8 is limited to controlled status, comment, and responsible-company publishing. Do not extend it to bulk publishing, issue creation/deletion, Navisworks model mutation, Saved Viewpoint mutation, Legacy Lens changes, native registration changes, or automatic conflict resolution.
- Complete disposable PostgreSQL 18 authenticated HTTP evidence for active write authority, inactive/read-only denial, cross-project denial, status/comment/assignment commits, exact idempotent replay, divergent replay rejection, concurrent same-key serialization, stale mutation-version conflict, immutable audit enforcement, and forced audit-insert rollback with zero partial state. No production database may be used for this proof.
- Complete controlled production-bundle browser evidence for review/confirm/cancel, read-only presentation, each action, retry with the same idempotency identity, stale conflict recovery, visible immutable receipt confirmation, refreshed history, keyboard/focus behavior, EN desktop and narrow embedded width, and zero unexpected console/page/network failures.
- Re-run the exact clean full workspace build/runtime closure and Living Brief integrity after evidence reconciliation, then obtain independent source-push acceptance. Push, Replit Shell synchronization/build/publication, production migration, and deployed verification remain separate explicit operations.
- When Roberto returns, complete real Navisworks Manage 2021 acceptance against the governed M7 project/model: confirm the embedded layout and Working View behavior first, then prove M8 status/comment/assignment publishing from the active exact model/project, refresh/history visibility, denied role behavior, stale conflict behavior, and no Saved Viewpoint or model mutation. Until then, M8 is not field-accepted.

# Lens Next v1.0.08-Pro / M8 - Split-pane release gate

- Reconcile implementation unit `11660980e5cff0e3d88d0f5985761a719da15529`, rerun the exact clean full workspace build in Replit Shell, and publish only that reconciled successor. Verify the deployed stylesheet preserves two simultaneous panes at the real Navisworks floating-window width while the complete embedded workspace retains the single visible vertical scrollbar.
- In the live Navisworks Manage 2021 session, select an issue and confirm its details remain visible in the right pane. Separately verify close/reopen, minimize/restore, and **Open Working View** against the governed model and exact issue identity. Do not claim Working View field acceptance from web layout evidence.

# Feedback packages v1.60.35.09-F - External and Acceptance Gates

- Preserve current-report source `9ea04835cab21087ed7c3fdcd49ea59c9a92e00c` and exact controlled Chromium harness `41f4cc2edffe6a523663257b39e39bb8a644250b`: 76/76 assertions, whole-navigation resize/collapse persistence, independent notification-panel controls, current evidence/activity review, assignment, customer messaging, authenticated package/register downloads, bilingual customer capture, non-super-admin denial, zero unexpected requests, and zero browser/page/network failures. Manifest SHA-256 is `28F6329CE196152EC5B010C757B9E4CFBD66B0B3A819B173DFF0D006CDD00EE1`. Push, Replit synchronization, publication, live scanner/backfill, Telegram delivery, and permanent receiver activation remain external gates until executed and verified.
- Preserve database-safety fixture successor `b8622d46f16e98bc4722b35def80cea20ae514c6`; it checks every parity constraint in its owning Feedback or financial schema while retaining all existing destructive-DDL refusals. Re-run the exact fixture in the final build and Replit source build.
- Preserve accepted exact integrated controlled Chromium evidence for harness commit `5a7dc2f55921bcc7d7651fe396134ebb35df0537`: 73/73 assertions, clean 256-input pre/post provenance, legal reviewer states, visible claim, sticky review controls, complete package/master Excel actions, notification resize/collapse/restore, bilingual customer capture, and non-super-admin denial. Manifest SHA-256 is `70292673CC18187A54A9C3A97D353D2DD80F381D71F938FABD0906071B0F7550`. Real Replit/scanner/Telegram/customer verification remains separate.
- Atomically push the final reconciled source to `main` and `master`, synchronize through the visible Replit Shell without Replit Agents, and require an empty Replit worktree plus exact remote/source SHA before building or publishing.
- Preserve FreshClam bootstrap authority `2e9d62c478dc70502d7e5bee7dabd26511859302`: direct launcher SHA-256 `6b70dfb5736d3af809bd3a41afa183817bc60df81b13822a7ff3f97e82ceb354`, committed configuration SHA-256 `6ed4f546ac3efced17ff8ba320cbff2c98e44fe33303a1c9fa2741a9171b3492`, exact declared Nix `clamscan`/`freshclam` paths, private lock, bounded database inventory, four-hour refresh target, 48-hour fail-closed age, and 120-second startup/scan limits. The visible Replit Shell proved the first-run database download and direct clean/EICAR scans, then reproduced FreshClam's signed-database version suffix; the launcher now validates the exact base executable version without rejecting that healthy suffix. Still require governed-wrapper clean/infected/failure receipts, clean synchronized deployment startup health, and automatic backfill of existing quarantined evidence before claiming attachments are available in PDF/Word/ZIP. Never mark attachment rows clean manually.
- Verify the production Telegram authority value-blind. If and only if it is already approved, configured, and linked to an active super-admin, require exact package-document delivery receipts for Word and item Excel. Otherwise retain the audited not-configured state; never invent credentials or claim delivery.
- Publish once only after build and preview gates pass, then verify release `v1.60.35.09-F`, reviewer transitions/claim/layout, expandable notification rail, package formats and clean-image/link inclusion, master Excel, scanner state, and Telegram disposition against the live application.
- Keep permanent Windows custody default-deny until a reachable, authenticated receiver can project exact accepted bytes to `F:\BIMLog\Feedback`. Replit App Storage is temporary custody and cannot directly access Roberto's private drive. Receiver TLS, HMAC/key ring, service identity, firewall, scanner, backup/restore, readback, and monitoring remain a separately accepted activation gate.

- Published operational-intake baseline `0582eb57be47685b9dcfee88ac192348f2e75307` contains valid reviewer/customer deep links, the super-admin-only review queue, owner/package/evidence/follow-up/response controls, post-commit notification delivery with idempotent reconciliation, customer DTO privacy, and governed ClamAV scanner/worker source. Live verification confirms plain `/feedback` and the floating button open **New feedback**, `/feedback?view=mine` persistently opens **My feedback**, direct tab switching remains available, and close/reopen returns to intake. This does not activate the scanner, receiver, transcription, email provider, or customer acceptance.
- Push, synchronize, publish, and live-verify report-link correction `9944f912a071faea744334102879ab1690f15a05`. Required live proof: a newly generated internal PDF, Word report, and item Excel file show PostgreSQL metadata plus private bucket `bimlog-feedback-temporary`; clicking a verified evidence link while signed in opens the exact feedback item and downloads the exact bytes without an `Authentication required` page; no raw `/api/v1/.../download` hyperlink remains; an unauthenticated browser is denied; a missing or invalid `downloadAsset` never starts a download. The private object key must remain undisclosed. This correction does not connect the Windows receiver or create an `F:\BIMLog\Feedback` copy.
- Push, synchronize, publish, and live-verify Office-link resilience successor `14bd3a02dd296e54d797f04676b161be06aae1cf`. Regenerate a Word and item Excel report after deployment; require a visible full BIMLog URL plus an external evidence-page hyperlink in Word, and a clickable evidence-page cell plus copy/paste URL column in Excel. Verify the evidence page opens in the already signed-in browser and its explicit **Download verified file** action returns exact bytes. Microsoft Protected View may still require **Enable Editing** by design; never bypass it with a public object URL, embedded credential, or unaudited bearer token.
- Complete exact clean build and browser/API acceptance for automatic package snapshot source `95bc4614332894f71b692b5b564a70c5a43fa0d3` plus schema-sync corrections through `f3425d2f3bdd9dcff2b1faef40c37104c7b00ca2`, then push the exact reconciled head, synchronize Replit, publish once, and live-verify. Required proof: latest material event produces exactly one customer and one internal PDF/JSON snapshot; exact source-event/hash/byte/visibility lineage is immutable; concurrent workers do not duplicate; a newer event supersedes without deleting history; upload/audit failure leaves no unreferenced object; customer and super-admin snapshot downloads reauthorize and verify bytes/hash; snapshots never expose opaque storage paths to customer DTO/history; current ZIP contains the same canonical record plus only clean evidence. PostgreSQL remains the live master follow-up register rather than a falsely self-updating downloaded spreadsheet. Replit development sync must complete without the prior BigInt serialization error, its strengthened parity gate must verify all governed Feedback constraint names and PostgreSQL-normalized definitions, both governed and already-installed legacy duplicate names must remain declared, and the publication preview must contain no destructive Feedback constraint drop before approval.
- Retain predecessor source-and-harness head `344a0ba7c6dabc0d38c7c8dabf7cbf7646b47458` and its controlled Chromium evidence at `F:\BIMLog\Evidence\feedback-addendum-20260817\final-browser-344a0ba-20260820T142500Z` (58/58 assertions) as historical package/markup proof only. Exact-current controlled coverage is the 68/68 receipt at `F:\BIMLog\Evidence\feedback-addendum-20260817\feedback-ops-final-78374d8-20260820T1905Z`, manifest SHA-256 `5B0DE3E78471C268189AE4CB622FF011583B873CE4197E4EEDBE341A89D98B41`; it does not establish publication, production migration, scanner/receiver/provider activation, live verification, or customer acceptance.
- Preserve the accepted four-page governed PDF proof at `F:\BIMLog\Evidence\feedback-addendum-20260817\package-pdf-governed-29122fa-20260820T132500Z` (SHA-256 `1979DD03FA9DC51243F20C3FC338749EE50F4A2C0954CA4C22566317E8C8979C`). Complete the remaining representative internal/customer ZIP and canonical JSON manifest inspection, customer redaction and secure-link comparison, and exact scanner-clean evidence inventory before release acceptance.
- Complete exact-head authenticated disposable-PostgreSQL API/browser acceptance for immediate super-admin intake visibility, stable-ID deep links, evidence/package detail, owner claim, follow-up CSV, submission receipt under notification failure, reconciliation/backfill, no-reviewer escalation, staff response types, in-app read state, idempotent replay/conflict behavior, customer DTO privacy, customer-visibility authorization, and email-copy default-deny/explicit-opt-in behavior. Do not claim an email was delivered without a real approved-provider receipt.
- Keep the Navisworks plugin build/package boundary H-only under `H:\BIMLogPlugin2021` and `H:\BIMLogPlugin2025`. This release reconciliation does not authorize or claim a plugin build, ZIP, installation, live Navisworks verification, or field acceptance.

- Complete exact-head build and independent acceptance for operational-intake candidate `78374d8bfeb4b41c722a55bd7a3d01cc00fcebdd`. Exact-head controlled browser proof is retained at 68/68, including the expanded super-admin workflow and non-super-admin denial assertions. The candidate preserves `.replit` convergence commit `5fa2033e03161ecfdca17304c580c58b6efaf5c7` in its ancestry; after remaining acceptance, atomically push `main` and `master`, synchronize Replit, and verify `git status --porcelain` is empty before another deployment attempt.
- Preserve private App Storage bucket `bimlog-feedback-temporary` and its exact source-bound non-secret backend, bucket, backend-ID, maximum-read, and default-bucket configuration. Do not repeat deployment `a34f876f-539a-49d6-bc40-d6281bb9d28b`; it failed because Replit had modified tracked `.replit`, not because App Storage authentication or application compilation failed.
- After the corrected exact source is pushed, synchronized, clean, and locally accepted, obtain Roberto's explicit post-failure authorization for one controlled Republish. Then require live startup plus upload/readback/delete health smoke before declaring Feedback custody available.
- Keep scanner and transcription fixtures disabled in production. The ClamAV adapter and worker are source-only until an approved external absolute executable, exact SHA-256, exact version, and bounded runtime settings are configured and startup verification passes. Until then evidence remains quarantined; App Storage persistence does not imply malware-clean or receiver-delivered status.
- App Storage is temporary persistent custody for publication, not the final Roberto-controlled receiver. Preserve objects until verified transfer/readback, then use governed deletion; do not rely on the published app filesystem.

- Exact-head API/database, source/receiver, typecheck, database-safety, production-build/runtime, standalone-artifact, secret/mojibake/diff, Living Brief, and zero-residue acceptance is sealed for `962561c3e1ed028260355b5e76409c60dde55cee` by receipt SHA-256 `2c9925e8c7db40de270acb22d9222dce083779a53da326afe7eac8b490e62cbb`. Its artifact database identity is retained only as value-blind hash/status evidence; this local disposable proof does not authorize production migration or any external action. Historical `fcec9e40045e44781a10097d1aea8bc7a7ac587f`, `c8218d58db0daa2f737862f22324a495f5f1e5cc`, `1eb3b73ec78479ece9332378856d23af4df0ee2d`, and earlier `956...` evidence do not prove the current candidate.
- Startup fail-closed receipt SHA-256 `e0c7140ab2bcdd93e4c20b05ceacc2e26214120568ad056dfd50f6f0f76d4e49` is sealed for exact startup head `9e428f3cb249d5b80041ee5f19ded9cfe962d141`. Its uninstrumented negative child exits naturally with code 1 and no listener/readiness when storage authority is invalid; its positive path returns 200 from both readiness endpoints and starts workers only after listening. This supersedes the synthetic invalid-authority receipt at `55149e5c4bdf430cd97891da00e268e5b20644fe`. The full workspace build rerun passed after reconciliation commit `7ef033426b0d34f6617138de95493381f033ceeb`; no local source/runtime/build blocker remains from this gate.
- The controlled-mock browser reseal at predecessor product commit `fcc1e3261c91a830979ae0e426d2d96e7b3afc93`, tree `779559a12b93fc9cacc45f773e949524d2f8ed86`, and manifest SHA-256 `22a313595b9f11f39fa32bdbba92361cec6322f7209c9a3b8a8603825aee8a10` remains accepted predecessor evidence. Exact-final controlled Chromium coverage now passes 68/68 at `78374d8bfeb4b41c722a55bd7a3d01cc00fcebdd`; authenticated full-stack browser acceptance remains pending.
- Preserve the independently source-accepted four-path Procore PG18 correction at `faf4f732e901278451984385616ff878f3164d38`. Its writer-reported real PostgreSQL 18 idempotence, production startup, typecheck, database-safety, secret, mojibake, and diff passes are not a substitute for a hash-bound retained execution receipt. Complete the exact-current Living Brief/build reseal before final browser acceptance.
- Provision and independently accept a direct Roberto-controlled receiver before any production evidence delivery. Required gates include a production signing key and verifier, governed malware scanner, transcription provider/credentials/processing terms/cost authority if transcription is activated, trusted TLS certificate and hostname/SPKI configuration, host/service ACLs, an external storage-authority manifest, backup and exact restore, multi-process/instance durability, resource quotas, and operational monitoring. No active production receiver, receiver URL, certificate, key, scanner, transcriber, or provider storage exists in this candidate.
- Mounting receiver HTTP endpoints, activating the operator-facing projection, approving a retention policy, and enabling signed release/purge remain separate acceptance gates. The implemented receiver purge core is hold-aware and default-deny, but unmounted source capability is not a live retention or deletion service.
- Preserve customer-safe per-asset relay visibility for Queued, Transferring, Receipt verified, Cleanup pending, Delivered, Manual review, On hold, and Expired, including sanitized reasons and history. Do not expose destination identities, object keys, lineage IDs, internal errors, custody reasons, tokens, or host paths.
- Preserve the single `ensureFeedbackSchema` authority; do not reintroduce inline Feedback DDL in `app.ts`. The accepted migration receipt at `4ed5e6a994123e5dcda03af2e35d261b5ae02a92` and purge receipt at `6eb013719a3a34147c5ae1d4caec244d49060ff0` are local isolated evidence only and do not authorize production migration, retention policy, or deletion.
- Replit workspace alignment, source push, Replit publish, deployment, production migration, receiver/provider activation, live verification, and customer verification remain distinct explicit gates. A Git push does not publish Replit, and publication does not prove deployment or customer acceptance. No such external action occurred in this reconciliation.
- Google Drive is excluded from the Feedback receiver architecture and must not be introduced as an implied custody or relay destination.
## Lens Next BIMLog-source Working View acceptance

- BIMLog is the sole viewpoint authority. **Open working view** may read only the selected record's BIMLog visual-state package and pass that package to Navisworks for temporary reconstruction. The click path must never search local Saved Viewpoints, capture the active model, migrate or backfill a record, substitute a similar view, create a Saved Viewpoint, or write the model file.
- A BIMLog record without a package uses Lens Next's governed first-open recovery. Lens Next may read only Original Lens-managed Saved Viewpoints and must prove the selected BIMLog row by exact server/project metadata, exact physical metadata, or a unique exact BIMLog display code. A stale GUID alone, trade, company, floor, title similarity, and model-object search are not identity.
- Install Lens Next v1.0.35 from the canonical H-root package into an authorized Autodesk load path, open the correct project model, select representative historical BIMLog records whose Original Lens identity is distributed across merge comments, and verify **Open working view** captures the exact preserved Saved Viewpoint once, persists its package to the same BIMLog row, and reconstructs the Working View without `409 identity_not_found`.
- Verify ambiguous or missing exact identities remain blocked without substitution, and verify a second open reads the stored BIMLog package rather than repeating local recovery.
- Push and publish the platform source, then repeat connected field verification for camera, selection, visibility, appearance, sectioning, and supported redlines. Installation, push, publication, and field verification remain separate explicit gates.

## Lens Next controlled rebuild — Build 2 entry gate

- Preserve Build 1 as read-only: automatic binding from one unique managed project identity and dual-inventory classification must not create, rename, move, delete, publish, or reconstruct any viewpoint.
- Build 2 must add the governed platform model-binding authority required for a clean Navisworks model with no managed viewpoints. It must prove the active model against BIMLog without falling back to a manually saved project ID, and it must keep ambiguity fail-closed.
- Do not package, install, push, publish, or claim connected 185 River Avenue / 521 East Streetmont acceptance until the applicable later build and release gates are explicitly completed.

## Lens Next controlled rebuild — Build 2 remaining gate

- Preserve the authoritative two-stage binding: native starts unbound with the stable model key, BIMLog resolves only within authenticated project membership, and native accepts only the governed registry result. Manual Project ID configuration, fuzzy model-wide viewpoint search, and cross-project substitution remain prohibited.
- Build 2 platform source, Living Brief reconciliation, generated platform structure, and the exact-clean full workspace production build are complete locally. Preserve this source for Build 3. Do not execute a production schema migration, package or install the H-root plugin, push, synchronize Replit, publish, deploy, or claim connected-model acceptance in Build 2.

## Lens Next controlled rebuild — Build 3 remaining gate

- Preserve the Build 3 plan as preview-only. Do not add an execute button or issue any upload, download, Saved Viewpoint, visual-state, model, database, or publication mutation from this build.
- Build 3 Living Brief sealing and the exact-clean full workspace production build are complete locally. Build 4 may add the first governed BIMLog-to-Navisworks reconstruction path for platform records that already contain complete authoritative visual-state packages; local-only upload and conflict resolution remain later builds.
- Do not package, install, push, synchronize Replit, publish, deploy, migrate production data, or claim connected-model acceptance during Build 3.

## Lens Next controlled rebuild — Build 4 remaining gate

- Preserve platform-package-only reconstruction and the prohibition on click-time local search/capture/backfill. Exact-clean Build 4 workspace closure is complete locally.
- Build 5 may implement separately confirmed upload of exact Original Lens-managed local-only viewpoints into BIMLog. It must not upload unresolved identities, overwrite an existing platform record, or combine upload with Working View open.

## Lens Next controlled rebuild — Build 5 remaining gate

- Preserve the dedicated single-item confirmation, exact local managed GUID resolution, atomic record-plus-package transaction, digest rebind, and no-overwrite conflict refusal. Do not route Lens Next through the legacy bulk `lens-sync` endpoint.
- Build 6 may add creation of a new BIMLog viewpoint from the active Navisworks working state through the full Lens Next issue form. Creation must originate in Lens Next, produce the platform record and visual package atomically, and create or stamp the governed local Saved Viewpoint only after the platform receipt is proven.
- Build 5 is local source only. No production upload, package, install, push, Replit synchronization, publication, deployment, production migration, or connected-model acceptance occurred.
- Preserve the explicit strict-TypeScript method signatures added during exact-clean closure; they are compile-time contract evidence, not a change to upload authority or behavior.
- Preserve the generated PLATFORM.md entries for the dedicated local-upload contract and behavior proof.

## Lens Next controlled rebuild — Build 6 remaining gate

- Preserve platform-first creation order: native capture without Saved Viewpoint mutation, atomic BIMLog issue/package receipt, one local Saved Viewpoint stamp, then exact GUID confirmation back to the same BIMLog row. Never use legacy `lens-sync`, overwrite an existing identity, or automatically save the Navisworks file.
- Build 7 may materialize the user's selected **My View** grouping as governed BIMLog-managed Navisworks folders without changing issue identity or platform authority. Existing unmanaged and Original Lens historical roots must remain untouched unless a later explicit migration plan authorizes otherwise.
- Build 6 is locally validated source only. Packaging, installation, push, Replit synchronization, publication, deployment, production migration, and connected-model acceptance remain later gates.

## Lens Next controlled rebuild — Build 7 remaining gate

- Preserve the dedicated Lens Next My View root, exact publish-marker/GUID eligibility, explicit confirmation, fresh-index move, post-move verification, and prohibition on deletion or automatic NWF/NWD save.
- Build 8 may add ongoing platform-first synchronization and reconciliation using the existing deterministic plan. It must preserve explicit conflict handling and may not let local folder placement or labels override BIMLog identity or visual authority.
- Build 7 remains local source only. Packaging, installation, push, Replit synchronization, publication, deployment, production migration, and connected-model acceptance remain later gates.

## Lens Next controlled rebuild — Build 8 remaining gate

- Preserve one explicit reconciliation confirmation and the whole-run preflight barrier: any manual conflict or blocked item must prevent all mutation. Platform packages execute before exact managed local-only uploads; stale recorded Navisworks GUIDs are conflicts, not permission to replace identity.
- Build 9 must complete recovery, audit, and interrupted-run acceptance without introducing automatic background reconciliation, overwrite, deletion, or automatic model save. Retrying after partial progress must start from freshly loaded BIMLog and Navisworks inventories and must never create duplicates.
- Build 8 remains locally validated source only. Packaging, installation, push, Replit synchronization, publication, deployment, production migration, and connected-model acceptance remain later gates.

## Lens Next controlled rebuild — Build 9 release and acceptance gates

- Builds 1 through 9 are locally implemented and validated. Preserve platform-first authority, exact managed identity, whole-run conflict blocking, ordered execution, idempotent interrupted-confirmation recovery, immutable audit history, and the prohibitions on overwrite, deletion, legacy bulk sync, background reconciliation, and automatic NWF/NWD save.
- Before release, create a governed H-root Navisworks 2021 package from the accepted source, verify its hashes and installation receipt, integrate/push the exact platform commits through the authorized Git workflow, synchronize Replit source, publish only from an exact clean source, and verify the live BIMLog release separately.
- Connected field acceptance remains mandatory on controlled copies of representative models: empty local model pulling from BIMLog, exact Original Lens local-only upload, mixed inventory, conflict refusal, new viewpoint creation, My View materialization, interrupted confirmation retry, repeated reconciliation idempotence, manual model save/reopen, and exact Working View reconstruction. Local completion is not installation, publication, deployment, live verification, or customer acceptance.

## Lens Next Build 10 remaining field gates

- Run the consolidated acceptance matrix in real Navisworks Manage 2021 and 2025 on controlled copies where applicable: clean model, historical Original Lens model, mixed inventory, missing package, stale/ambiguous identity, interrupted confirmation, duplicate rerun, unauthorized user, manual save/close/reopen, and exact Working View reconstruction.
- Verify no unrelated Saved Viewpoint, Original Lens structure, or model geometry changes; verify the model is never automatically saved. A field failure reopens only the exact failed matrix item.
- Push, Replit synchronization, publication, production migration, installation, and customer action remain separately gated and are not authorized by the Build 10 local candidate.

## Lens Next v1.0.35 — Ruben Navisworks 2025 field gate

- Deliver H:\BIMLogPlugin2025\LensNext-v1.0.35\BIMLog-Lens-Next-Navisworks2025-v1.0.35.zip and its .sha256 sidecar to Ruben.
- Ruben must extract the complete ZIP, run INSTALL-BIMLOG-LENS-NEXT-2025.bat with Navisworks closed, retain the visible installer result, and complete FIELD-ACCEPTANCE-CHECKLIST.txt in Navisworks Manage 2025.
- The release is locally packaged and validated, not installed, live-verified in Navisworks 2025, or customer accepted. A field failure reopens the exact failed acceptance item; it does not authorize changing Original Lens or bypassing H-root/package integrity gates.

## BIMLog v1.60.35.13-F — Release and live acceptance gate

- Commit the accepted Living Brief reconciliation successor, atomically advance GitHub `main` and `master`, synchronize a clean Replit release branch, and require the complete Replit workspace build to pass before publication.
- Publish once, then verify the live header reports `v1.60.35.13-F`, the selected historical record follows exact local activation → capture → same-record persistence → BIMLog reconstruction, and a missing/ambiguous local identity performs no save or duplicate creation.
- Verify separately on Ruben's Navisworks Manage 2025 machine that the bridge badge remains connected during a recoverable business failure and that successful migration survives refresh and a second Open Working View operation from the stored BIMLog package.

## Lens Next v1.0.44 / BIMLog v1.60.35.16-F — Remaining field and release gates

- Install the complete v1.0.44 package with Navisworks closed and verify both installed Lens Next DLLs report file version `1.0.44.0` before reproducing. A report showing `1.0.42.0` is stale deployment evidence and cannot accept or reject this correction.
- Push and publish BIMLog v1.60.35.16-F only through the separate authorized release gate. Then repeat one create/upload failure path and retain the native `Visual digest diagnostics` line plus the server `LensNextDigestMismatch` record. If the digests differ, the first field/value pair is the actionable defect; if they match, investigate the next exact failure without changing digest semantics.
- Confirm successful create, refresh, second open, and model save/reopen in Navisworks Manage 2025. Verify no duplicate issue, Saved Viewpoint, or model save is produced by retry.
- Decide separately whether BIMLog web viewpoint records need a new governed XML export. Do not relabel the existing Navisworks Saved Viewpoints XML export or infer that it contains platform-only viewpoints.

## Lens Next v1.0.49 — Remaining live acceptance gate

- Use only Roberto's one-time authorization already granted in this release task for the exact 2021 target `C:\ProgramData\Autodesk\ApplicationPlugins\BIMLogLensNext2021.bundle`; do not infer authority for the 2025 target or any other C-root path.
- After that authority exists, install the hash-verified 2021 package with Navisworks closed and execute the complete project 26 / ELA01 ELARA EAST matrix against `1185 RIVER AV MODEL-06-11-26.nwd`: dynamic inventory, filters/search, every row open result, unique historical migration and second open, missing/ambiguous errors, expiry renewal without visible reload, responsive chrome, settings, diagnostics, disposable create/cleanup only when safe, and validated XML export with before/after receipts.
- Navisworks Manage 2025 is absent on this host. Its package/static gates are complete; live 2025 field acceptance remains pending an installed, authorized host and a non-customer acceptance model.

## Lens Next v1.0.49 — Reconciled publication and acceptance gates

- Commit this Living Brief reconciliation successor, atomically advance GitHub `main` and `master`, then align a clean Replit `master` to that exact pushed commit without merging preserved checkpoint history. Require the complete workspace build to pass before the one authorized publication attempt.
- After publication, verify the production health/readiness surfaces, deployed source identity where exposed, Lens Next route loading, platform-authoritative dynamic inventory, and the absence of periodic embedded-workspace navigation or session-expiry flicker. A failed build or publication attempt stops the release and requires complete-log inspection before another authorization.
- Install and field-test the hash-verified 2021 v1.0.49 package only under the separately granted exact C-root authority, with Navisworks closed before installation, then execute the project 26 / ELA01 ELARA EAST matrix against `1185 RIVER AV MODEL-06-11-26.nwd`. Navisworks 2025 remains unavailable on this host; deliver its exact package for Ruben's separate 2025 acceptance without claiming local 2025 runtime proof.

## Lens Next v1.0.50 — Publication and exact 1185 acceptance gates

- Commit this Living Brief reconciliation after implementation unit `a855e167290098ea12c0b4855360c6f71e09ea61`, advance GitHub `main` and `master`, merge the reconciled successor into the preserved Replit publish-wrapper descendant, and require the complete Replit build to pass before publication. Publish once, then verify the deployed Lens Next route in Chrome before installing the 2021 native package.
- Install only the hash-verified 2021 v1.0.50 bundle under Roberto's already granted exact `C:\ProgramData\Autodesk\ApplicationPlugins\BIMLogLensNext2021.bundle` authority, with Navisworks Manage 2021 closed. Reopen `C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd`, verify header version, project 26 / ELA01 ELARA EAST binding, dynamic platform counts, filters, responsive layout, settings, diagnostics, validated Navisworks Saved Viewpoints XML export, token renewal without page reload/flicker, and all safe create/refresh/open controls through the Chrome-connected workspace.
- The current project-26 pull contains 20 dynamic BIMLog rows, but those rows have no stored Navisworks GUID, visual package, digest, or screenshot, and the tested NWD does not contain exact BIMLog-managed source viewpoints for them. Do not claim that those historical rows can open or reconstruct. They must remain visibly blocked without 409 or local fallback until the exact intended original view is displayed and the separately confirmed repair persists its complete package to the same BIMLog row.
- Navisworks Manage 2025 is absent on this host. Static/package verification and Telegram delivery are complete; live 2025 installation and connected acceptance remain Ruben's separate field gate.

## Lens Next v1.0.50 — corrected installer, production publication, and remaining field gates

- Commit and push this Living Brief reconciliation successor, merge it into the preserved Replit publish-wrapper descendant, and require the complete Replit workspace build to pass before one production publication. After publication, use the existing signed-in Chrome session to verify `1 issue`, `Review synchronization plan (1 item)`, the full dynamic `20 issues` state, project 26 binding, and zero browser errors.

- Preserve BIMLog as the sole viewpoint source of truth. The 20 current project-26 records have no complete platform visual packages, so normal Open Working View must remain disabled without a 409 or local fallback. Do not run the separate repair until the operator has displayed the exact intended historical Navisworks view; then one explicit repair may attach that current state to the same BIMLog row and a second normal open must use the stored platform package.

- Native automated gates cover settings, diagnostics, and validated Navisworks Saved Viewpoints XML export for both 2021 and 2025. The current live 2021 acceptance has not yet clicked the legacy WinForms Settings, Diagnostics, or XML save-dialog controls, and Navisworks Manage 2025 is absent on this host. Do not claim those live field gates or 2025 runtime acceptance until they are executed on an authorized host.

## Lens Next v1.0.51 — publication and live digest-repair gates

- Commit this reconciliation successor, rerun the complete pre-push production gate with a collision-new restricted `F:` proof root and isolated loopback `bimlog_rfi_test` database, and atomically advance GitHub `main`, `master`, and the release branch. The proof must retain the six-second Linux and eight-second Windows readiness budgets introduced by `077452fa93e882fd18343379cd19d1c075335285`. Align the preserved Replit publish-wrapper descendant to that exact pushed successor through Replit Shell, require the complete Replit build, and publish only after the build is green.
- Publish the compatible API before installing or distributing v1.0.51. The published server must accept a verified current v1.0.50 native capture that differs only by legacy .NET/JavaScript floating formatting, continue rejecting a materially changed camera value, and expose no new browser errors. Existing v1.0.50 clients should be able to retry after publication without reinstalling.
- On the authorized Navisworks Manage 2021 host, close Navisworks before any v1.0.51 install, verify the installed manifest and both DLL hashes/versions, reopen `C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd`, confirm project 26 binding and dynamic platform inventory, then retry only the operator-selected exact current-view repair. A successful repair must persist to the same BIMLog row and a second normal open must reconstruct from the stored platform package without a 409 or duplicate.
- Deliver the hash-verified 2025 ZIP with its BAT installer to the authorized Telegram recipient only after server publication. Navisworks Manage 2025 remains unavailable on this host; Ruben's install, exact-model connected repair/open test, save/reopen proof, and complete field checklist remain separate acceptance gates.

## Lens Next Stage One recovery — remaining gates

- Review and explicitly authorize the model-binding schema migration before any production database change. The proposed forward constraint is a project-scoped active uniqueness rule on `(project_id, model_binding_key)` plus a non-unique lookup index on `model_binding_key`; first inspect production rows and prove zero within-project active collisions. Rollback may restore the global key uniqueness only after proving that no legitimate cross-project duplicate keys exist.
- After Stage One review, separately authorize any version change, packaging, installation, push, Replit synchronization, publication, or Telegram delivery. None is implied by the source recovery commit.
- Execute connected field acceptance in Navisworks Manage 2021 and 2025 on controlled models: authoritative/ambiguous binding, dynamic platform inventory, create without Saved Viewpoint or model save, persisted display ID and thumbnail after refresh, exact platform-only Working View reconstruction, tamper rejection, minimize/maximize/resize, independent pane scrolling, settings, diagnostics, and XML export.
- Project 30 access/provenance, the historical project-26 target identity, Ruben's 2025 runtime proof, and production source identity remain unverified and must not be inferred from Stage One automated evidence.

## Lens Next v1.05.N01-P01 — remaining release and field gates

- The production binding-index migration is complete and verified. Do not restore the former global uniqueness rule unless a rollback audit proves that no legitimate cross-project active keys exist.
- Complete the repository-wide build/pre-push gates, commit the schema/version/package reconciliation, and advance governed source branches only from the exact green commit. Replit publication must use Shell, not Replit Agent, and must pass the complete workspace build before publication.
- Before installing either native package, close the matching Navisworks process and verify the ZIP hash, manifest release `v1.05.N01-P01`, year, Autodesk series, BAT launcher, and native DLL file version `1.5.1.1`.
- Connected Navisworks Manage 2021 and 2025 field acceptance remains required: authoritative project binding, dynamic platform inventory, create without a Saved Viewpoint/model save, persisted display ID and thumbnail, exact platform-only Working View reconstruction, tamper rejection, minimize/maximize/resize, pane scrolling, settings, diagnostics, and validated XML export. Do not claim 2025 runtime acceptance on this host because Navisworks Manage 2025 is not installed here.

## Lens Next N02 Working View recovery — remaining acceptance gates

- Do not build or distribute an N03 candidate until Roberto reviews the N03 Working View Recovery Report. At packaging time, increment only Lens Next counter N and preserve the latest independently owned Platform/APU P counter exactly; the locally observed shared identity is currently `v1.05.N02-P01`.
- The automated recovery gates are green, but connected local Navisworks 2021 proof has not run against commit `ca6862d6086f9b91964e6fd0de69b6bc1664f41a`. A separately authorized installation is required before testing `C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd`: create from a distinctive full visual state, refresh, move away, open once through actual completion, verify camera/sectioning/visibility/appearance/selection, restart Navisworks, and reopen the same BIMLog issue.
- Record real small, medium, and Ruben-scale package timings from the new stage telemetry before defining a no-progress watchdog or performance target. Total elapsed time is telemetry, not failure, while stages advance. Do not substitute another fixed total timeout.
- Navisworks Manage 2025 remains unavailable on this host. After local 2021 acceptance and Roberto's explicit package/delivery approval, Ruben's controlled 2025 sequence remains the customer field gate, including >20-minute session stability and absence of window flicker or duplicate apply.

## Lens Next v1.05.N03-P01 — authorized release gates

- The earlier N03 review prohibition is satisfied and superseded by Roberto's explicit build, push, Replit Shell publication, and Telegram-delivery authorization. Release commit `95c8e5140d75c7b456cd52fcd5773bd4ffc0aac9` and both deterministic N03 archives are complete.
- Advance only exact green descendants to the governed GitHub branches. In Replit, use Shell only—never Replit Agent—align the preserved publish-wrapper lineage to the pushed successor, run the complete build, and publish only from the exact passing source. Verify the live Lens Next route and browser console after publication.
- Deliver only the hash-verified Navisworks 2025 ZIP `BIMLog-Lens-Next-Navisworks2025-v1.05.N03-P01.zip` with SHA-256 `A9020A628DDA1EB9424122B914C840A4638E5008E607D6B4FD20C6B5C6BC9E99` to Roberto's authorized private Telegram recipient.
- Publication and delivery do not establish Navisworks acceptance. On this host, installed 2021 acceptance must still prove a distinctive full-fidelity create/refresh/open/restart/reopen sequence on the governed 1185 model. Ruben's 2025 host must separately prove exact package installation, long-running full-fidelity Open Working View, save/reopen persistence, session stability, no flicker, no duplicate apply, diagnostics, settings, and validated XML export.
## Lens Next digest v3 coordinated release gates

- The Platform v3 contract report, Living Brief, clean production artifact, and publication-source gates are complete. Implementation commit `92f93ce9d2f824a47d7a290bfe516de0a3a2a000` remains the behavioral source unit; report proof is recorded through `33b9e015ce4a69704b49af6e8288d48c4cc237ae`.
- Push and publish the Platform-owned `v1.05.N05-P02` change only through the approved Replit Shell release path; verify production v1 and v2 compatibility plus v3 acceptance/tamper denial.
- Do not let Main 04 emit v3 or create an N06 field package until production Platform v3 support is verified.
- After Platform approval, Main 04 must consume the exact shared A–L fixture, implement native v3 canonicalization and ElementReference/ModelReference v2, and complete the previously approved create → persist → fetch → apply → restart → apply proof before any field delivery.
## Lens Next v1.05.N07-P02 release completion gates

- Merge exact commit `f62adc2c3de01bf31d2ad0532797c2171176b19c` into the preserved Replit publish-wrapper history through Replit Shell only, run the complete governed production build, publish once, and verify the deployed health and Lens Next surface in Chrome. No database migration is authorized or required.
- On the installed Navisworks Manage 2021 host, open `C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd`, create one brand-new issue from a distinctive camera, verify human-readable ID and thumbnail with no Saved Viewpoint, move away, open once, restart Navisworks, and open the same issue again. Any failure produces one report before another product patch.
- After the production and connected acceptance gates pass, deliver only the hash-verified 2025 N07 ZIP to Roberto's authorized private Telegram recipient. Ruben's actual Navisworks 2025 runtime acceptance remains a separate customer field gate.
### N07 final publication successor

- Reconcile through generator-fix commit `b45c5ac3ade23b7a67c26423cb96d56b4dcb85b7`, require the exact Replit Shell production build to pass, then publish once and execute the already recorded Chrome and connected Navisworks acceptance sequence before Telegram delivery.

## Lens Next v1.05.N08-P02 release completion gates

- Commit and push only the exact green N08 successor, then align the preserved Replit publish-wrapper
  lineage through the visible Replit Shell. Require a clean workspace and the complete governed build
  before one publication; no database migration is required or authorized by this repair.
- Verify production health and the Lens Next route in Chrome. Explicit current v1/v2/v3/navigation
  packages must retain their prior acceptance/tamper behavior, while a metadata-less historical package
  with unavailable canonical evidence must return the dedicated quarantine explanation without mutation.
- Send only `BIMLog-Lens-Next-Navisworks2025-v1.05.N08-P02.zip` with SHA-256
  `E2E24810C6A6693C6DAA98DAF31490927A5987C54D6BB21FCFE5B66466B5E112` to Roberto's authorized private
  Telegram recipient after publication verification.
- Telegram delivery is not Navisworks 2025 acceptance. Ruben must install N08, create a brand-new issue,
  move to a different camera, open once, restart Navisworks, and open the same issue again. Historical
  metadata-less packages remain honestly quarantined and are not valid N08 success fixtures.

## Lens Next v1.05.N08-P03 release completion gates

- Exact-artifact startup proof is complete for source `a9fabd537c6c5fba70d3dae392c8501c73143992`:
  invalid durable storage authority exits naturally in 982.8 ms with no TCP/readiness, and valid restricted
  storage plus the isolated loopback proof database reaches both readiness surfaces in 7,014.4 ms after the
  ordered database-startup queue completes without PostgreSQL deadlock.
- Rebuild and verify both Navisworks years as `v1.05.N08-P03` / `1.5.8.3`, preserving N08 and advancing only
  Platform-owned P03. Record deterministic archive and core/native/manifest hashes before distribution.
- Push only the exact green commit. Through the visible Replit Shell—never Replit Agent—align the governed
  publish lineage, run the complete build, publish once, then verify production health and Lens Next in Chrome.
- After verified publication, send only the hash-verified 2025 P03 ZIP to Roberto's private Telegram. Ruben's
  connected Navisworks 2025 install/create/open/restart/open acceptance remains a separate field gate.
## v1.05.N09-P04 startup publication completion gates

- Complete generated Living Brief, root-build/runtime-closure, focused startup, and both Navisworks package/test
  gates are green against source `b2a9df745ba39e2d99c362468086e898850bf212` plus reconciled documentation.
- The exact 2021/2025 package and component hashes for `v1.05.N09-P04` / `1.5.9.4` are recorded in STATUS,
  PLUGIN, AUDIT, and the tracked build receipts. N09 is preserved and only Platform-owned P04 advanced.
- Push the exact green head. In visible Replit Shell, align to that exact remote source and rerun the governed build.
  Publish once; Promote must complete without `/api` health failure. Do not use Replit Agent or retry a failed paid
  publish without consuming the new failure evidence.
- In Chrome, verify live `/api`, `/api/v1/healthz`, the shared release label, authentication, and Lens Next loading.
  Then send the single verified 2025 P04 ZIP to Roberto's private Telegram. Ruben's connected Navisworks field test
  remains separate from deployment acceptance.
