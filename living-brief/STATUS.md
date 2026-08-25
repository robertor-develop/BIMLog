# STATUS.md - Current Accepted Platform State

## BIMLog v1.60.33.06 Build 6 Team Capacity local candidate - 2026-08-14

- The local production-artifact proof now accepts an explicit caller-selected non-privileged
  loopback PostgreSQL port while retaining exact loopback-host, database-name, explicit-URL,
  and runtime identity checks. This removes a test-harness collision with an unrelated managed
  local PostgreSQL service without weakening production or remote-database refusal.
  The same exact-runtime proof now expects the canonical `/api` health response to remain 200
  instead of retaining its stale pre-health-route 404 assertion.
  Synthetic proof rows live only for the lifetime of the required fresh disposable database;
  the harness no longer attempts to delete immutable entitlement history before disposal.

- Exact-390 Spanish browser QA found and corrected the Resource Scheduling methodology remaining
  in English. The production component now presents the canonical methodology in Spanish while
  preserving the server-owned English contract; focused bilingual SSR and frontend typecheck pass.

- Release-gate verification on 2026-08-15 proved isolated PostgreSQL persistence, tenant and
  membership refusal, concurrent version conflict, idempotent and divergent replay behavior,
  persisted financial redaction, stale refusal, transaction rollback, and zero partial apply.
  Review found that mutation limits were process-local and therefore bypassable across deployed
  processes. The corrected candidate persists additive database-backed buckets shared by every
  process and fails closed if the limiter authority is unavailable. Browser, artifact, final build,
  independent review, and clean-commit gates remain separately recorded until evidenced.

- Team Performance now uses employee-owned, append-only availability, working-day, and leave
  profiles; missing profiles remain visibly unknown and no default capacity is invented.
- Project leaders can compare authorized cross-project commitments and verified Job Operations
  role, workflow, scope, package, and deliverable evidence without inferred skill scores or
  automatic personnel ranking. Financial rates remain server-redacted unless the viewer has both
  managerial and required Commercial financial authority, and this surface cannot edit rates.
- Immutable what-if staffing scenarios bind current profile, workload, evidence, task, and direct
  assignment versions. Applying a reviewed scenario is transactional, project-scoped, idempotent,
  stale-safe, reasoned, and limited to eligible direct task assignees. Existing priced resource
  assignments stay under Job Operations authority; advisory hours, costs, values, and rates are
  never written to live work.
- Focused backend and production-component SSR behavior, broader Team Performance regression,
  API/frontend typechecks, diff, secret, database-source-safety, and mojibake gates pass locally.
  Persisted scenario evaluations now redact nested person and aggregate financial values for
  viewers without rate authority, all four mutation routes have bounded per-actor/project rate
  limits, and Navbar and Help Center identify the same `v1.60.33.06` candidate. Full build and
  clean-commit completion remain local gates; independent review, push, Replit availability/build,
  publication, deployment, production database verification, customer acceptance, and live
  acceptance remain separate pending states.

## BIMLog v1.60.32.05 Build 5 Document Connections local candidate - 2026-08-13

- Job Operations now persists typed connections from canonical tasks or work
  packages to canonical same-project RFIs, exact file revisions, and
  transmittals. A connection is only a junction: it neither copies nor replaces
  the source record and creates no competing document authority.
- Selectors and the persisted connection list are bounded and expose separate
  `total`, `limited`, and `max` metadata. The UI discloses capped results and
  fails visibly if present metadata is malformed instead of presenting an
  apparently complete list.
- Link and unlink authority is evaluated against the current target controller.
  If a canonical source later becomes unavailable, the stale connection remains
  visible and removable to an authorized controller, but it exposes no dead
  anchor or deep link.
- Canonical RFI, file-revision, and transmittal links navigate to the exact
  positive-integer record after destination data loads. Invalid or missing
  targets fail visibly without selecting a substitute, and existing destination
  filters remain in force while the exact target is located and highlighted.
- The Document Connections surface and manual guidance are English/Spanish.
  Focused backend and UI behavior, frontend typecheck/build, diff, and mojibake
  checks pass locally. The implementation is committed locally at
  `3d22c6a64e311575f1de9c8478d4ecebda9d26a3`; this remains
  `v1.60.32.05` local source-candidate evidence only. Push, publication,
  deployment, production database verification,
  customer acceptance, and live acceptance remain separately authorized.

## BIMLog v1.60.31.04 Build 4 local release candidate - 2026-08-12

- Build 4 completes active contract and budget activation on the canonical
  multi-contract Job Intake path. Activation generates one project budget
  aggregate across all activated contracts, immutable per-contract APU/pricing
  and Contract Item financial baselines, Budget Accounts grouped by project
  cost node, Project -> Contract -> Contract Item -> Budget Account drill-down,
  and an immutable execution baseline. Persistence remains transactional,
  fingerprinted, idempotent, tenant-scoped, and protected from update/delete.
- Help, Job Intake, Job Operations, Cost & Value Planner, Team Performance, and
  Project Controls now use the governed Print PDF flow. Existing visible
  filters are inherited; pages without suitable filters present PDF-only
  section choices; confirmation downloads a generated PDF. Blank tabs,
  `window.print`, browser screenshots, draft-print wording, and duplicate nested
  print controls are not accepted behavior.
- The complete bilingual user manual and release information now identify
  `v1.60.31.04`. The navigation brand separates the release number from the
  BIMLog wordmark for legibility.
- Generic APU, database safety, focused Build 4 backend and PDF behavior,
  strict API/database/frontend TypeScript, and production UI build checks pass
  locally. This is local source-candidate evidence only; push, Replit pull,
  publication, deployment, production database verification, customer
  acceptance, and live acceptance remain separately authorized.

## BIMLog v1.60.28.03 Smart Intake multi-contract activation local candidate - 2026-08-11

- Build 3 extends the one canonical Job Intake draft with up to 50 independent
  contract profiles. Each profile preserves its own legal identity,
  counterparty, dates, currency, selected APU or pricing version, optional
  workflow override, and budget mode. Every Contract Item is assigned to one
  owning contract rather than inheriting one project-wide APU.
- Activation creates or reuses the canonical Commercial contracts, freezes the
  selected APU or pricing snapshot independently for each contract, applies
  project-to-contract-to-item workflow inheritance, and records the related
  Contract Item and budget relationships. It remains idempotent and does not
  create a second Intake, contract, APU, workflow, or budget authority.
- The Smart Intake spreadsheet mapping, 100-plus-row bulk editor, optional
  source documents, original provenance, and ordered draft persistence remain
  in the same English/Spanish guided workflow.
- This source candidate is tracked at commit
  `69f1791fe623faed546ae1da7a0d8498b00ffbac`, and GitHub `main` and `master`
  resolve to that exact commit. The final source correction aligns the Team
  Resource Planning release-version assertion with `v1.60.28.03`; it changes
  no application behavior. Replit pull, publication, deployment, production
  verification, customer acceptance, and live acceptance remain pending and
  separately authorized.

## Smart Intake and bulk Contract Item local candidate - 2026-08-11

- The current local candidate extends the one canonical Job Intake draft with
  bounded XLS/XLSX/XLSM/CSV workbook inspection. The user explicitly selects
  the sheet and header row and maps Contract Item Name and Quantity before any
  rows are appended. Ambiguous or truncated previews cannot be confirmed.
  Original document identity, source hash, sheet, row, header, and mapped
  columns remain attached as provenance; PDF and Word extraction remains
  manual-review evidence and cannot silently create financial records.
- The responsive bulk editor defaults to only Contract Item Name and Quantity,
  accepts pasted two-column Excel ranges and more than 100 rows, supports row
  add/remove and quantity-wide edits, and hides generated stable IDs, inherited
  unit/currency/APU/rate/workflow, calculated value, and per-row overrides under
  Advanced. Confirmed imports append to the existing autosaved revision and
  never replace unrelated entered or imported rows.
- This phase adds no Intake, contract, APU, workflow, or budget store. Drafts
  remain in `job_intakes.data`; activation continues creating the shared
  operational baseline and, when entitled, canonical Commercial Contract Item
  snapshots with source provenance and per-item workflow inheritance.
- This is local source-candidate truth only. It is not pushed, published,
  deployed, production verified, customer accepted, or live accepted.

## Invitation and Job Intake accepted source - 2026-08-11

- Pushed commit `1a45653691c750a5929ba6acd25ec415b66ef26b`, present on both
  GitHub `main` and `master` per the authorized operator report, repairs
  project membership onboarding around one canonical company-bound invitation
  path. Existing BIMLog users are added directly; new-user invitations retain
  the inviting company and project; normalized-email registration accepts all
  matching pending project invitations transactionally. Registration,
  membership, and directory invite paths serialize competing identity and
  membership work and fail closed on ambiguous legacy identities.
- Job Intake now prefills available project metadata, treats source documents
  as optional, accepts PDF, DOCX, XLS, XLSX, XLSM, and CSV sources up to 25 MB,
  and exposes ordered draft autosave with visible pending, saving, saved, and
  attention-required states. Upload, removal, and activation flush the latest
  draft and bind mutations to the saved revision so stale work cannot silently
  replace a newer revision.
- The Team, registration, Intake, Help Center, and operating-manual wording is
  maintained in English and Spanish. This is accepted pushed-source truth, not
  publication, deployment, production verification, customer acceptance, or
  live acceptance.

## Operational-register live-acceptance correction - 2026-07-31

- Local branch `codex/platform-pdf-consistency-20260730` contains a bounded
  descendant correction for the customer-visible Activity Log and Coordinator
  Command Center PDFs. It removes internal/governance labels and visible trace
  IDs and uses a dedicated measured-row table helper for long operational text.
- The correction is local only. It is not pushed by this task, published,
  deployed, production verified, customer accepted, or live accepted.
- Focused source checks and regenerated affected artifacts pass locally. The
  final production-build closure receipt, complete denominator binding, and
  independent every-page acceptance remain release gates.

### Reconciled UI acceptance paths - 2026-08-01

- The same local descendant now also carries the previously accepted UI-only
  corrections for ProjectDetail, ProjectSidebar, MasterSidebar, Integrations,
  Pricing, and Features. The reconciliation excludes the separate runtime and
  security commits from the historical `2af082ba` branch.
- Project access states distinguish loading, denied, missing, and retryable
  failures; sidebar and integration requests expose accessible sanitized error
  states; stale notification results cannot replace a newer request; and the
  existing Pricing and Features presentation is bilingual.
- This remains a local candidate pending the single successful production-build
  closure, complete browser/artifact QA, and independent acceptance. It is not
  pushed by this task, published, deployed, production verified, or customer
  accepted.

### Deterministic runtime-closure recovery candidate - 2026-08-03

- The clean F-root descendant at
  `9506e5e3139665dd53fc519fea17f3ebc9603a0c` replaces child-process package
  staging with an in-process, lockfile-bound installed-package graph assembly.
  It materializes regular files only, records deterministic content hashes and
  exact importer/package/snapshot bindings, and fails closed on incomplete,
  mismatched, escaping, cancelled, or timed-out closure assembly.
- The focused proof covers direct, transitive, workspace, file-descriptor, and
  peer-qualified lock bindings plus cooperative copy/hash/validation timeout
  paths, with zero package-manager, install, or network invocation. The
  correction changes no PDF or UI behavior, dependency or lockfile bytes,
  schema, database, provider, credential, or customer data.
- This source remains a local candidate. The corrected F-root source and
  reconciled Living Brief passed the strict-offline production build on
  2026-08-04, including all gates, typechecks, UI verification, deterministic
  13-package runtime closure, isolated capability proof, and readiness 200.
  Replit Linux build/promotion, push, publication, deployment, production
  verification, customer verification, and independent UI/artifact acceptance
  remain separate gates.
- The root build runner now invokes the library TypeScript compiler through its
  portable Node entrypoint and runs artifact typechecks directly instead of
  nesting the same workflow through an additional pnpm process or relying on a
  shell-specific bare `tsc` shim. This preserves the exact checks while
  removing the locally reproduced silent runner failure; package dependencies
  and the lockfile are unchanged.

### Passwordless eligible-user Living Brief candidate - 2026-08-05

- Accepted source commit `06f2dfbdd5f9ca504cefacdeeb914deb961f7ab3`
  is integrated into this F-root candidate. A currently authenticated eligible
  user receives the short-lived Living Brief token without entering a separate
  BIMAI360 gate password. Eligibility remains server-derived from current
  Super Administrator state or the explicit `can_access_living_brief` grant.
- The document middleware still binds the brief token to the authenticated
  user, rechecks current eligibility, and rejects stale revocation versions.
  Ineligible users continue to receive 403. The 11-document source bundle,
  ordering, mirror reconciliation, and Super Administrator access-management
  controls are unchanged.
- The focused seven-assertion passwordless source proof, affected API and
  BIMLog UI TypeScript checks, and the single authorized replacement
  strict-offline full build pass locally. The build includes tracked-secret,
  database-safety, mojibake, 11-document Living Brief, all-workspace
  typecheck/build, deterministic 13-package/10,777-file runtime closure,
  isolated production-artifact capability, and readiness-200 evidence.
  Exact Replit-source verification, publication, deployment, live F5
  verification, and independent acceptance remain separate operator gates.

## Current recovery truth - 2026-07-28

This section supersedes any conflicting current-state wording below. Older
entries remain historical records and must not be interpreted as the current
accepted, deployed, or live state.

- Canonical local recovery repository: `F:\BIMLog\Repositories\bimlog`.
- Recovery branch: `recovery/platform-print-pdf-successor-20260728`.
- Preserved platform-PDF candidate base:
  `c3430f4ac121cbbb00445a0ff72d87d423bf6c10`. It exists on the remote
  release branch but is not merged into `origin/main` and is not accepted or
  deployed by this recovery.
- Preserved successor: `0fd469acbbafa7af323629dc0cbad1126b5aaeb4`.
- The successor contains exactly 19 PDF/report UX paths. It is a local,
  unvalidated recovery candidate. It is not independently accepted, pushed,
  deployed, production verified, customer verified, or live accepted.
- Local completion review corrected the remaining successor defects: Project
  Insights PDF-only section choices now live inside the shared Print PDF
  modal, and the filtered Submittal Log PDF now preserves an honest zero-result
  view with repeated table headers and numbered branded footers. Activity Log
  operational action/date filters now expose exact bilingual accessible labels,
  and Schedule inherits visible operational filters while keeping PDF-only
  sections inside the shared modal. Clash Reports list printing now binds to
  its actual visible list target, and Schedule default-bucket creation is
  atomic under parallel first-load requests. Contracts now withholds all
  financial controls, including Print PDF, when financial access is denied
  while preserving the normal project shell. Shared and domain-specific PDF
  footer stamping now suppresses footer-only trailing pages without changing
  report content or authorization. Focused frontend and API
  typechecks and the local production build pass; independent artifact/UI
  acceptance remains a separate gate.
- The continuation working tree on accepted source `ac63d72f` now contains the
  bounded production correction for the post-publication PDF findings:
  governed current-view PDF generation replaces native browser print on
  Reports Hub, Integrations, Clash Reports, and Required Submittal Register;
  report-family titles and filenames no longer add `Filtered`, `PDF`, or
  `Report` to current-view identity; nested Reports & PDFs output binds the
  exporting member's authorized company identity; Submittal record and
  current-view layouts use bounded title/value regions; and sparse Project
  Performance, Document Audit, Meeting Minutes, Change Order, and Transmittal
  reports use structured context, KPIs, tables, repeated headers, and numbered
  governed footers without adding inferred analytics. Frontend and API
  typechecks, source safety checks, and the single local production build
  pass. Fifteen representative governed PDFs covering every affected family
  were regenerated from the built API, rendered into 28 pages, and inspected
  with a compact contact sheet plus page-level text/page-number checks; no
  blank or footer-only page remains. Real desktop/exact-390px EN/ES state
  evidence remains blocked because the connected Chrome control runtime
  fails during initialization with `Cannot redefine property: process`.
  Independent review therefore remains an acceptance gate; this working tree
  is not deployed or live accepted.
- The bounded successor on sealed local candidate `4f69ba8c` removes the
  misplaced `Validate and Download` Files shortcut from Integrations, enforces
  the committed `{Module} — Current View` visible-title separator, and binds
  RFI record artifacts to the audited project-company identity while retaining
  `BIMLog by IgniteSmart` as secondary attribution. No permission, tenancy,
  financial authority, provider, schema, or record data behavior changes.
  Focused desktop/exact-390px EN/ES browser acceptance and rendered-page
  inspection passed with synthetic local fixtures, including corrected
  record-level Submittal wrapping and RFI project-company identity. The local
  successor is ready to seal; provider, production, push, publication, and
  deployment remain excluded.
- The current bounded Lens reporting successor on clean base `5e0508f` replaces
  Ruben's manual PivotTable step with generated hierarchy and summaries,
  defaults reports to Open items, preserves source viewpoint identity/links,
  and scopes non-admin exports to the authenticated responsible company or
  person while retaining full project scope for roles carrying existing admin
  permission metadata. It also corrects the two remaining uppercase
  Submittals current-view separators and repairs the affected log's Ball in
  Court column allocation and bounded wrapping. Focused typechecks, one
  successful offline production build, actual manager/assigned XLSX generation,
  every-sheet workbook inspection, and every-page Lens/Submittals PDF inspection
  passed with synthetic local fixtures. The clean local seal is the remaining
  step; no schema, Meeting Minutes, Proposed-RFI,
  provider, production, publication, or deployment behavior is included.
- The same report owner has a bounded production-PDF family addendum on sealed
  Lens candidate `352586b`. It applies compact deep-blue customer/project chrome
  and canonical current-view identity across the supplied 18-family regression
  set, removes RFI metadata collision and cover-page waste, corrects Submittal
  continuation wrapping/chrome, and keeps Lens revision history with sign-off.
  Nineteen synthetic local artifacts cover the full 18-family set plus the
  changed record-level Submittal; all 45 rendered pages form the final owner-QA
  set. The supplied production originals remain read-only references. Evidence
  is bound at local candidate sealing; no provider,
  production/customer data, database mutation, push, publication, or deployment
  is included.
- Current GitHub, Replit, and production equality are not established by this
  recovery. The last known deployment evidence does not prove the current
  PDF/report UX.
- The current registry contains 157 worktrees: 143 clean and 14 dirty, with
  zero missing or unreadable in the corrected scan. All 14 dirty worktrees
  remain `UNKNOWN-PRESERVE`. None is authorized for cleanup, deletion, reset,
  or reuse until separately classified.
- Roberto-approved BIMTech architecture is planned direction only. It does not
  claim implemented Shop Drawing Production, SharePoint/Excel/Access
  ingestion, Microsoft connectivity, Power BI projections, customer-data
  migration, or live BIMTech behavior.
- Normal BIMLog development remains paused until the F: repository is
  registered as the saved Codex project root and Roberto explicitly chooses
  which existing task to resume.

Status: Active current-state record
Accepted source reconciled through: `6f96a3f2385a08c3e364099178617d4ec16dfcf5`
Reconciliation date: 2026-07-23

This file states accepted `origin/master` source truth. Accepted source, deployed source, database-mirror
synchronization, and field/customer verification are separate states. The current semantic-content
reconciliation is an independent integration candidate and does not become accepted or deployed truth until
its review, clean commit, push, and later deployment gates pass.

### Ruben T1 current-view export and sidebar release candidate - governance reconciled

The accepted local lineage is `5db399450adc5df92420012c2d30380444d681f5` ->
`6cb212b368a20c6aaf5af61f34de5cc28c7e501d` -> `122d3b5216266fedd1eaee9f723ac398f2791281` ->
`2be2ac0fa464ecc86ce95b7f5194e29a0dd7bfa1` -> `05fe1390739a433dfac392b03ee7f51e90dd3de2`.
Independent source reviews accepted the RFI Ball in Court and inclusive end-date parity correction, the nullable
`Rfi.ballInCourt` OpenAPI/generated React contract correction, and the one-file viewport-height sidebar layout
correction for combined final gates.

Offline dependency materialization, the TypeScript library prerequisite, and frontend typecheck passed on
`05fe1390`. The production build then stopped only at stale Living Brief reconciliation, before application
compilation or bundling. Isolated startup, real-app English desktop and Spanish exact-390px browser acceptance,
RFI/Submittal PDF generation and every-page inspection, provider alignment, push, publication, deployment,
production verification, customer verification, and live acceptance remain not run. The broader generated-client
provenance decision for the already-narrower Orval/Zod RFI response models remains a separate open concern; this
candidate neither regenerates nor claims reconciliation of those models.

UI/auth and report-export UX release bundle is accepted in local serialized integration source at $head. It combines the Living Brief authentication gate durability correction, Headquarters global navigation and shell clarity, Meetings report-generation UX, Headquarters Admin/Total Control polish, and Finance Budget/Contract export UX labels. The integrated source preserves the frozen baseline c3d135c24c1432b63d74898a1de83e67ba54c394, excludes superseded Headquarters Slice 2 commit d7bcf76be2d14eae49ef0c7a10d17d55a198f59e, and remains not published, deployed, production verified, customer verified, or live accepted. Replit/provider publication remains a separate fail-closed step tied to the exact final pushed commit and preview.

UI/UX Foundation Phase A is accepted in the current serialized source candidate based on authoritative master
`6fc0f8ef48c23c07f89a3ad6b3928f6c552bcdfe`. The shared project shell now adds grouped project navigation,
desktop expanded/collapsed behavior, Spanish exact-390px drawer behavior, foundational responsive spacing tokens,
and a representative Reports Hub hierarchy without changing RFI export behavior, schema, dependencies, security,
Telegram product code, plugins, Replit, or production/customer data. This source state is not published, deployed,
production verified, customer verified, or live accepted.

Project Insights API release correction and Activity presentation are accepted in the current combined source
candidate based on authoritative master `715fd6ad8ff0a9e80f69b6e969cfde3ff3c511b0`. The Project Insights backend
now preserves tenant isolation while allowing a legitimate legacy same-company project-admin read when older binding
metadata is absent, calculates company metrics through the real files-to-users-to-companies relationship, emits live
Command Center query names, and restores readable Spanish unavailable-reason copy. Activity presentation now renders
safe human-readable details across Dashboard, Admin, Profile, Total Control, and Project Activity without exposing raw
JSON payloads or internal implementation keys. This source state is not published, deployed, production verified,
customer verified, or live accepted.

RFI report generation and Visual Evidence usability are accepted in clean source integration on authoritative master
baseline `7532a8d4f879aeca01136535a0abfd5cefc5eb00`. Every single-RFI PDF, DOCX, and Complete PDF export action opens
the Generate RFI Report modal that loads active project defaults, supports one-time per-export section/field,
attachment, source-viewpoint screenshot, additional-screenshot, and empty-field choices, and allows only authorized
project authorities to explicitly save project defaults. The export routes consume one canonical settings model for
standard PDF, DOCX, and Complete PDF, reject malformed one-time choices with a client validation response, and do not
export soft-deleted RFIs. The related Autodesk legacy connector guard is scoped so unavailable Autodesk behavior does
not shadow later RFI/cloud routes. The RFI detail experience now makes Visual Evidence unmistakable with source
viewpoint and additional screenshot management, preview thumbnails, captions, ordering/removal, and explicit
PDF/DOCX/Complete PDF inclusion wording while preserving the approved normal-zoom RFI layout. Editable
response-capable states expose exactly one Save Response action. This source state is not published, deployed,
production verified, customer verified, or live accepted.

The deterministic Replit API artifact closure is accepted locally in source at product commit
`76addb6eb7b791a7579ca5c2e7d95a6526b544a1`. The production build now bundles compatible pure-JavaScript
dependencies and creates a lockfile-backed, artifact-local runtime tree for native, asset-bearing, and remaining
external packages. An esbuild metafile, complete link-containment check, workspace-link verification, and
artifact-only capability/startup proof fail the build before publication if the runtime closure is incomplete.
The isolated proof executes PDF generation/parsing, image processing, canvas rendering, email/archive/DOCX/auth
imports, the historical non-5xx `/api` contract, and truthful `/api/v1/healthz` readiness without production
credentials or database access. This source acceptance does not prove a Replit Linux build, promotion, deployed
health, or customer workflow; preservation of Replit's dirty Agent edits, clean master realignment, and one
explicitly authorized Republish remain separate operational gates.

The bounded Replit startup-risk correction is accepted in source at product commit
`3ae00ec0138fb2c443eae320b80b7b3383fe36fc`. During the finite application-import window, exact `/api`
preserves its historical non-ready Express-style `404` behavior required by the Replit artifact promoter, while
`/api/v1/healthz` and every other path remain `503` until the real application is ready. Import completion,
failure, and the ready transition now have bounded, sanitized phase timing, and a 45-second timeout fails closed.
The only verified pre-log subprocess, top-level `which ffmpeg`, is removed from module initialization; capability
discovery is lazy, bounded, cached, and invoked only by meeting-audio transcription. This eliminates an objective
startup risk but is not claimed as the proven cause of the Replit-only stall. Republish, promotion, deployed
health, and customer verification remain separate operational gates.

The Replit early-port startup hotfix is accepted in source at product commit
`048bb095bd2d4cd553eb6eedd27e0b63969d768a`. The production entrypoint now binds the configured port before
asynchronously importing the application, returns `503` while initialization is starting or failed, and delegates
to the existing Express handler only after a successful import. The repository-authoritative Replit startup probe
now targets the mounted `/api/v1/healthz` route. Deterministic cold-start proof covers delayed import, ready
transition, and failed import with preserved error logging. This source acceptance does not prove a successful
Replit build, promotion, deployment, or customer workflow; exact remote alignment and Roberto's separately
authorized Republish remain operational gates.

The final-six Replit preview correction is accepted in source at product commit
`86a30f23a1d4999b630fe71a6a8ff4e90cd04e7e`. Read-only development/production catalog comparison proved that
three coordinator indexes in production use `DESC NULLS FIRST`, while development was plain ascending. Declarative
and startup authority now preserve the production semantics explicitly. The three RFI report-settings foreign keys
now use the existing PostgreSQL `_fkey` names instead of Drizzle-generated replacement names. The exact six-authority
drop/recreate preview is retained as a fail-closed fixture. Source acceptance does not prove Replit alignment or
authorize publication; exact source attestation, guarded development sync, complete regenerated preview, explicit
GO, Publish, deployment, and production/customer verification remain separate operational gates.

Complete Replit publication-preview name alignment is accepted locally in source at
`a761ff82b65226ac9c7fd782b6f69a60a3e1da1b`. It binds the 105 constraint/index authorities from the rejected
complete preview to their existing production-safe names, preserves their definitions and records, and adds the
complete preview as a permanent destructive-SQL regression fixture. Disposable PostgreSQL proved first-run and
repeat declarative application with zero destructive statements. This source state is not yet pushed, rerun in
Replit, previewed, published, deployed, or production/customer verified. Publish remains blocked until Replit uses
the final accepted master, guarded development synchronization passes, and the complete regenerated preview is
empty or contains only explicitly inventoried additive SQL with zero destructive statements.

Database publication safety is accepted in local integration source at
`f5d2ef4bd76115bb9f595ad803adcbdf2e9a2104`. It adds a fail-closed destructive-SQL gate, exact remote-master source
attestation, guarded Replit Helium-only development synchronization, source table/index parity, disabled direct
force-push, and complete-preview/additive-inventory controls. The current source contract contains 132 Drizzle
tables, 140 indexes, and all 92 startup-created tables. This does not prove that Replit-managed database migration
authority can be disabled, and it does not authorize a database sync or Publish. Replit repair, guarded Helium sync,
read-only parity, complete regenerated preview, verified restore point, affected-table counts, owner approval,
publication, and post-publication verification remain separate gates.

Tracked publication credentials are removed in accepted integration source at
`b17d5c730d00947e1c812e1e3a93d58995a7f3dd`. The four-path correction removes two secret-like assignments from
tracked `.replit`, preserves guarded development synchronization, retains the value-blind whole-file continuity
fingerprint, and adds a fail-closed tracked-configuration/current-diff gate with finite scope fixtures. It does not
rotate or validate credentials, update Replit Secrets, align the divergent Replit workspace, connect to a database,
publish, deploy, or prove runtime recovery. Those operator and deployment gates remain pending.

Roberto-approved built-asset lifecycle roadmap: approved strategy is being recorded for BIMLog's long-term expansion
from construction coordination into verified construction records, asset passports, maintenance obligations,
condition/IoT events, controlled work orchestration, contractor/supplier networks, executable contract rules, and
circular-material recovery. This is roadmap authority only. No asset-passport module, maintenance engine, IoT/BMS/
CMMS connector, marketplace, executable contract, payment/settlement, material passport, carbon accounting, or
circular recovery behavior is implemented, deployed, or customer verified by this documentation build.

Ruben urgent Meeting workflow correction is accepted and pushed in source at
`bec190ac248fc5134f742b1bafbc673a594e52ec`. It adds inline canonical company registration, reusable
project-directory attendees/contacts, canonical attendee directory identity, compact linked RFI status/responsible
controls, exact View RFI/Ver RFI deep links, and server-draft restoration when returning from RFI navigation or
refreshing `/meetings`. It is not published, deployed, production verified, customer verified, or field accepted.

Living Brief credential persistence and controlled recovery are accepted in source at
`c3a7c809643022abb04b8fe58db043ccd5d828ff` after reconciliation onto Coordinator master
`81007cafddd1d59880259af2255863986715ed56`. This is not published, deployed, production verified, or live mirror
verified until the separate controlled rollout completes.

Urgent lockout hotfix accepted in source at `3da420d9068e26d80169aa74aefca67eba860b47` on Telegram Build 6 master
`e67ca65be7ff633aa888241c941c557818c446d9`: Roberto reported the deployed Living Brief still rejected the gate
password, and source review found a circular Super Administrator recovery path because reset required a brief-access
token that could only be obtained with the unavailable gate password. The accepted source fix removes that circular
dependency for authenticated, transaction-time revalidated Super Administrators while preserving audit, version,
rate-limit, rollback, and session-invalidation controls. Publication, deployment, production verification, and
Roberto's field access confirmation remain separate pending rollout steps.

Coordinator Command Center Build 2 is accepted in source at integration commit `4572882561684bbfe6472a6a0ecca414a4d4f152`, directly based on
authoritative master `999589c7ed5cf9414cda12b4031ce475e16a5303`. Preserved candidate
`bb2925eb0a2fe45d4bb5e60d2e0d4fe76cd125b8` was reapplied as reviewed content only; its older ancestry was not
imported. Build 2 adds personal saved views, operational filters/defaults, and authorized cross-module navigation while
preserving Build 1 canonical ownership, exact Lens identity, honest empty/partial behavior, and zero canonical mutation or
AI use. Clash aggregation and Build 3 remain deferred. This source acceptance is not publication, deployment, production
verification, customer verification, or field acceptance.

Security Batch A is accepted in source at integration commit `97e32503a641c37ff55c0e96806c1cf58af57ae1`, directly based on accepted
master `b67ae0118b4f8eb85f9de2aaf55c5aad399a7ea6`. The preserved candidate
`01c60a1bc24649153afd70b5c061b4cb01d79789` remains provenance evidence only; its ancestry was not imported.
The accepted correction is not published, deployed, production verified, customer verified, or extended to
SheetJS/Batches B-I. Security Batch B is separately integrated below.

Security Batch B is accepted in source at integration commit
`d4aa7ed91b1a439f8144956554e4044b95cd6979`, directly based on Meetings master
`bec190ac248fc5134f742b1bafbc673a594e52ec`. Reviewed candidate
`b6498cefd4d833c46868426e71db2f6520da3241` remains provenance evidence; only its content was reapplied.
The correction resolves both direct SheetJS consumers to the provenance-verified official CE 0.20.3 artifact,
removes 0.18.5, and applies the canonical date-only/explicit-instant/timezone-less/raw-cell policy across the
post-Finance spreadsheet inventory. It is not published, deployed, production verified, customer verified, or
extended to Batches C-I.

Coordinator Command Center Build 4 is accepted in source at integration commit
`6f96a3f2385a08c3e364099178617d4ec16dfcf5`, directly based on Security Batch C master
`5d71fe6150c332b28f3e2274afeebdcf0a7fc146`. Reviewed candidate
`a918c60c1e75a6c89a86ff16ec1e7ea31889e59b` remains provenance evidence; only the reviewed Build 4
product-boundary content was reapplied, without importing candidate ancestry. Build 4 separates the Act -> Understand/
Report surfaces: Coordinator Command Center remains the operational execution surface for current actionable records,
My Items, overdue/due soon/blocked work, responsibility/ball-in-court, saved operational views, selection, governed
actions, and only four contextual counters: actionable, overdue, due soon, and blocked. Analytics is renamed
Project Insights & Reports / Perspectivas e Informes and becomes the analytical/reporting surface for compliance,
bottlenecks, company performance, RFI aging/status performance, honest unavailable states, and governed report links.
Recent Activity, Recent Files, operational task lists, and the Schedule placeholder are removed from Insights because
Activity Log, Files, Command Center, and Schedule own those surfaces. Shared server-side metric definitions now govern
counts, status buckets, date boundaries, and permissions so Insights deep-links to exact filtered Command Center
records without granting authority. Lens/Viewpoint identity, Coordinator Build 3 bulk actions, Clash deferral,
AI/notification boundaries, publication, deployment, production/customer access, field verification, and Build 5
remain unchanged and out of scope.

Security Batch C is accepted in source at integration commit
`cf2edd9125d797109215ed0e03d0e08d27f13ff0`, directly based on accepted Coordinator Command Center Build 3 master
`ed8b94bd4f7e73f3ad5bbb1d236f4b474f4fae1a`. It deterministically resolves the production SendGrid client's
transitive Axios transport to exact 1.18.1 through the canonical `pnpm-workspace.yaml` override authority while
retaining `@sendgrid/mail@8.1.6`, `@sendgrid/client@8.1.6`, and `form-data@4.0.5`. The email wrapper adds a fixed
10-second timeout, 512 KiB request bound, 64 KiB response bound, and zero redirects without changing provider
destinations, credentials, recipients, templates, authorization, or delivery semantics. This source acceptance is
not published, deployed, production verified, customer verified, or extended to Batches D-I.

Coordinator Command Center Build 3 is accepted in source at integration commit
`18154f359ea45783eda54fe3a52111d9f45fb41a`, directly based on Security Batch B master
`9cf0fe6cd83c781d1a3f46367d47e88f0474fe8f`. It adds controlled bulk actions from the Lens/Viewpoints-first
Command Center using existing canonical Meeting and Schedule relationships: supported RFI/Submittal links to
Meeting Minutes and supported Submittal Schedule Bucket create/sync. Lens/Viewpoints remain first-class navigation
items with exact identity and no Build 3 mutation path. Clash aggregation/substitution, Build 4 notifications,
AI behavior, publication, deployment, production/customer access, and field verification remain out of scope.

Portability Phase 1A is accepted in source at integration commit
`6f9c3f18d524723361f5f0ab45cf18f160566311`, directly based on authoritative master
`988b5cef9312737f1d64447aa6b5b642b927e4ab`. It reapplies only the two corrected files from reviewed candidate
`63ab0f873e9294a1c0ce7e3cee9b7a3119bd848d` without importing candidate ancestry: the non-secret continuity
exception record and a value-blind protected-configuration guard. The protected configuration and credential behavior
remain unchanged. Normal push/remote verification is the remaining source gate; publication, deployment, production,
customer, provider, callback, authentication, credential mutation, and Phase 1B remain separate and unstarted.

Owner credential continuity decision in the same local candidate: current working integration credential material must
remain operational and unchanged during ongoing platform development. This temporary owner-approved exception is not
launch architecture. It blocks any credential rotation, revocation, deletion, replacement, relocation, regeneration,
invalidation, disclosure, testing, provider/callback/authentication behavior change, or forced credential re-entry
unless Roberto gives fresh explicit approval. Before public/production launch, it becomes a mandatory hardening blocker.

Terminal-turn notification governance in the same local candidate: every explicitly assigned work cycle that stops
sends one honest sanitized Telegram return-to-computer alert before the final response. Ready, partial safe stop,
Blocked, Needs Input, Failed, Paused/Held, no-change audit, and Completed are distinct terminal outcomes; Completed
is reserved for genuine completion.

## Shipped and accepted in source

- Portability Phase 1A: owner-approved temporary credential continuity exception, value-blind credential-category and
  recovery ownership inventory, future managed-secret cutover design, mandatory public-launch blocker, and a
  byte-preserving guard that prints no protected value or fingerprint.
- Coordinator Command Center Builds 1-4: a Lens/Viewpoints-first project action register for
  actionable current Lens Viewpoints, RFIs, Submittals, Meeting actions, and Schedule tasks, plus bounded personal
  saved views, operational filters, personal defaults, built-in work views, shareable authorized navigation, and
  controlled confirmed bulk actions for canonical RFI/Submittal Meeting links plus Submittal Schedule Bucket
  create/sync. Build 4 keeps the Command Center focused on operational execution and moves analysis/reporting into
  Project Insights & Reports with shared server-side metric definitions and exact filtered deep links back to the
  Command Center.
  Canonical modules remain authoritative; exact identity/deep links, current authorization and entitlement checks,
  deterministic pagination, visible partial-source failures, honest empty results, bilingual desktop/mobile behavior,
  and zero AI use are accepted. Lens/Viewpoints are navigation-only for Build 3 mutation scope, and Clash aggregation
  remains deferred.
- RFI Builds 1-7: canonical lifecycle and attachments; non-destructive crop/replacement/show-hide;
  Standard PDF, editable DOCX, factual Audit PDF, native-fidelity Complete PDF, and four-sheet RFI
  Register Excel. Build 8 has not started.
- Telegram Product Builds 1-5: secure account linking, controlled AI foundations, bilingual
  assistant/support, Delivery Concierge foundation, user preferences, reliable outbox, and Notification
  Center. Module adapters shown as coming later remain unavailable.
- Plans, Entitlements, and Feature Controls Steps 1-2: advisory catalog/resolver,
  company/project/user policies and preferences, support matrix, and append-only project-company history.
  Step 3 has not started; tiered billing and add-ons remain approved direction rather than shipped enforcement.
- Meeting Minutes M1-M4: immutable links to canonical same-project RFIs, Submittals, and Clashes; M4
  links and synchronizes canonical Schedule Buckets/tasks from linked Submittals without duplicating them.
- Cost & Financial Control Builds 1-3: effective-dated authorities, exact-decimal/currency controls,
  versioned cost structures, budgets, upstream and downstream contracts/commitments, SOV lines,
  amendments, separate approval and execution, controlled over-budget escalation, immutable
  snapshots/history, bounded import/export, searchable PDF/XLSX exports, and bilingual UI.
- Security Batch B: exact official SheetJS CE 0.20.3 artifact, one accepted resolution across the two direct
  consumers, raw UTF-8 BOM/non-BOM CSV handling, machine-timezone-independent date-only semantics, explicit-offset
  instant handling, timezone-less date-time preservation/rejection, and bounded post-Finance compatibility evidence.
- Shop Drawing Control filter correction: UI and PDF/Excel outputs share normalized filter semantics.
- The source-authoritative 11-document Living Brief architecture is accepted: one catalog drives checks,
  deterministic PLATFORM generation, authenticated API, exact mirror, bilingual UI, copy, and export.
- Schema reconciliation `9297740` is accepted and pushed. It aligns reviewed Drizzle declarations and
  preserves an additive-only expected production migration boundary.
- Publish dependency correction `178462e` is accepted and pushed. The canonical
  `pnpm-workspace.yaml` override resolves all four affected Electron packaging paths to `tar@7.5.20`,
  removes `tar@7.5.11`, preserves every existing override/exclusion, and passed semantic lockfile review,
  frozen install, full build, and Windows Sync Agent packaging.

## Deployment and operational boundary

- Replit has not published `9297740` or `178462e`. The latest failed publish stopped during dependency
  installation before migration or application build because the supply-chain policy rejected
  `tar@7.5.11`; that source blocker is corrected, but the publish must be retried from verified pulled
  `178462e` only after the actual preview is reviewed and Roberto approves.
- Rejected Replit checkpoint `0d60d7a` remains unpushed and undeployed evidence. Its competing root
  override authority removed established workspace controls and introduced unrelated packages/platform
  binaries. It must never be merged, cherry-picked, or reused.
- Read-only production comparison establishes a pending 12-table additive deployment inventory:
  Meeting Minutes M4 (2), Finance Build 2 (9), and `living_brief_documents` (1). No existing-column
  change, drop, type conversion, data copy, or destructive constraint/index replacement is expected;
  only the actual final Replit preview can authorize publication.
- Production Living Brief source-commit configuration, mirror synchronization, runtime health, and
  deployed browser verification remain controlled later gates. Source or local mirror timestamps must
  not be labeled deployed truth.
- Roberto reports a fifth recurrence where the deployed Living Brief gate rejected the existing password
  after Replit publication and displayed a reset form. Source audit shows the current accepted startup path
  seeds a hardcoded gate hash if the legacy `platform_settings` row is absent. The local correction moves
  authority to a dedicated durable credential table, migrates any existing legacy hash once, removes default
  seeding, removes the locked-screen reset form, and requires revalidated Super Administrator reset with audit.
  Production credential preservation still requires later controlled migration/publish verification; no
  production credential, secret, or database was accessed by this candidate.
- The historical full dependency audit recorded 94 findings (7 low, 47 moderate, 40 high) outside the tar-only
  correction. Batch B removes the two known applicable SheetJS advisory records from the exact accepted resolution,
  but no fresh registry-wide count is claimed; remaining findings require separately authorized bounded batches.
- Security Batch A is accepted in source at `97e32503a641c37ff55c0e96806c1cf58af57ae1`. It uses exact Multer 2.2.0 and centralized
  bounded multipart parsing across 20 accepted upload endpoints with controlled bilingual failures and durable
  storage compensation. Frozen install, finite multipart and Living Brief matrices, typecheck, one complete build
  sequence, semantic lock audit, encoding, privacy, and diff gates passed. Normal push and exact remote equality
  verification remain the release boundary. Batch B is separately accepted at `d4aa7ed91b1a439f8144956554e4044b95cd6979`.
- The owner credential continuity exception is active only during ongoing platform development. Public/production
  launch requires separately approved managed-secret migration, durable backup/recovery, controlled rotation/revocation
  as appropriate, callback continuity, rollback proof, history remediation, and independent verification.
- July 3 production counts/findings in `AUDIT.md` are dated historical evidence, not a current audit.

## Navisworks boundary

- Accepted platform history includes Project Import/Rebind with scoped idempotency, project boundaries,
  physical identity persistence, controlled conflicts, and Pull parity.
- v1.60.7 is the protected physical mutation baseline. Later identity safeguards surround its
  detached-copy, final-name, insert, and fresh-reacquisition sequence; they do not replace it.
- v1.60.18 is a frozen local candidate. Its 2021 exact-model and final 2025 handoff evidence are verified,
  but Ruben's 2025 install, exact workflow, Pull/Reconcile repetition, save/reopen, and field acceptance
  remain pending. It is not Completed.

## Current candidates and next work

- BIMLog Platform Build 7 Advanced Contracts v1.60.35.07 is integrated locally from the verified
  backend and UI owner lineages. It adds governed contract payment applications against exact executed
  SOV identities, immutable revisions and attributable lifecycle history, maker/checker separation,
  cumulative-ceiling serialization, stable denial/conflict mappings, and bilingual responsive controls.
  Disposable PostgreSQL migration/restart safety, authenticated HTTP permissions, revision/approval
  concurrency, rollback, focused UI behavior, routed browser evidence, and TypeScript checks are local
  evidence only. Nothing was pushed, published, deployed, or run against production/customer data.
  The sanitized integration receipt is retained under `artifacts/api-server/evidence/build7-integration/`
  and binds the tested implementation tree, owner heads, local gates, and external-release limitations.
  The final authenticated history-read proof also covers a different-company project member and a
  same-company viewer assigned only to another project. Both receive fail-closed record isolation,
  disclose no payment/history identity, and leave contract, payment-version, line, and history counts unchanged.
  The exact repository pre-push rehearsal also exposed a runtime-closure receipt-directory race after
  successful assembly. The build now recreates that evidence directory immediately before its terminal
  receipt write, preserving the same runtime contents and fail-closed validation contract.

- Replit publication-preview alignment: local source commit
  `a761ff82b65226ac9c7fd782b6f69a60a3e1da1b` preserves the accepted constraint-collision correction and aligns all
  105 rejected preview constraint/index names to the existing database authorities. Focused fixtures, source
  safety, complete-preview regression, typechecks, builds, and disposable PostgreSQL first/repeat application
  passed. Normal push, Replit guarded development sync, complete regenerated preview, and Roberto's explicit
  Publish decision remain pending.
- Security Batches C-I: not started and require separate authorization.
- Living Brief Content Reconciliation Build 2: independently reconciled review candidate only.
- Replit verified pull of `178462e`, actual 12-table preview, explicitly approved publish, runtime/mirror
  reconciliation, and deployed browser verification.
- Navisworks v1.60.18: Ruben 2025 field acceptance pending.
- Telegram Product Build 6: clean integration accepted locally on current master with 38/38 final built-runtime
  evidence. It adds only the deterministic RFI notification adapter and saved-RFI contextual controls on the
  Build 5 foundation; normal push verification remains pending, and nothing was published or deployed.
- UI/auth/report-export release: superseding local candidate `5c6700cc65b0d46beb5939b33e6a2041ebf8b057`
  resolves the browser-acceptance blockers from the serialized release candidate. English desktop remained
  accepted; Spanish exact 390px Dashboard and Meetings revalidation passed with no document overflow, no
  runtime/request failures, Spanish KPI/CVR/helper labels, and unobstructed Meetings project identity/context.
  Normal push, remote equality verification, and any Replit/provider publication remain pending.
- RFI Report Template Settings: independently accepted for clean source integration. It adds project-scoped
  RFI PDF/DOCX report template settings, a Ruben lean preset, canonical source/additional screenshot report
  controls, additive settings storage, and RFI-only UI/API wiring. Complete RFI PDF honors the same project
  settings snapshot as Standard PDF and DOCX, and the settings UI is gated to project-admin or super-admin
  authority. Publication, deployment, production/customer verification, and any Replit action remain separate.
- RFI Build 8, Entitlements Step 3, Meeting Minutes M5, and Finance Build 4: not started.

See [OPEN_LOOP.md](./OPEN_LOOP.md) for actions and [AUDIT.md](./AUDIT.md) for dated evidence.

## 2026-08-05 consolidated local Release lineage

Living Brief runtime-source packaging and commit identity, Linked Items creation UX, Project-26 Procore RFI
import, clash-report delete-reason auditing, and the accepted delete-confirmation/meeting-autocomplete paths
plus the clean six-path Generic APU UI are integrated locally. Focused source checks are reconciled against this exact lineage. Nothing in this line
is pushed, published, deployed, or applied to a customer database; the live Living Brief failure remains open
until a separately authorized replacement build and deployment are accepted.

The clean-build reconciliation regenerated the deterministic platform inventory for the integrated Linked
Items, Procore RFI import, and Generic APU paths; this is local build metadata, not deployment evidence.

The accepted 12-path Commercial/Financial backend set is also integrated locally: Financial Budget import,
service, HTTP behavior, and Generic APU engine/persistence/schema paths. Its supporting proofs are local and
credential-free; no customer or production database execution occurred.

The frozen Generic APU backend readiness follow-up is integrated as exact commit `384ffcb8c8aa5f6d9780648ae211b175f5a30b63`.
It adds only the accepted service, contract, budget-control route, behavior evidence, and schema/route exports;
no database, provider, publication, or deployment action occurred.

The frozen Project-26 Procore RFI end-to-end five-path handoff is integrated locally as `0643e999aef5b000e01c8b3e57ab20ce3f9a9a02`.
Its 43-row and 43-check atomic-store proofs pass with RFI materialization, activity/notification evidence,
rollback, and concurrency coverage; database connections and customer mutations remain zero.

The independently accepted two-file database-safety correction is integrated locally. Its fixture and full
source scan pass while narrowly recognizing the reviewed Generic APU constraint replacement; it does not
execute DDL or connect to any database.

The Living Brief authentication regression harness now reflects the accepted passwordless architecture:
eligible authenticated unlock, ineligible denial, user-bound tokens, current credential-version/revocation
checks, and no password read or verification. Its focused matrix passes 14/14.

The narrow Generic APU persistence startup registration is integrated in `7a410c7ab794776a7d8320f8299c50c4ad560246`.
Its focused startup behavior passes 13/13 with zero network connections and zero database mutations; the
registration preserves current `app.ts` changes and does not imply migration execution.

The three pre-existing APU test TypeScript blockers are narrowly corrected in commits `c94bfe261440f5fa738e6c5b4a04304ac448cae2`
and `1f6c8671f457128f5b6e5ff7e6bd476820abb226`. The persistence harness import now follows the extensionless
repository convention, and the authority-state journal property supports transactional replacement while
retaining a readonly event array. Focused proofs pass 19/19 and scoped API TypeScript passes without database access.

The Generic APU now has one repeatable package command, `test:generic-apu`, at local commit
`d9869477354aee8c0d5e03e146137044231897ac`. It runs the calculation, edge, persistence, startup,
authority HTTP, authority transaction, disposable PostgreSQL, API TypeScript, and UI TypeScript checks.
The complete command, API production build with isolated artifact proof, and UI production build pass locally.
No push, publication, deployment, or production/customer database change is included.

Release candidate `1a45653691c750a5929ba6acd25ec415b66ef26b` is reconciled as a whitespace-only
`TeamPerformanceWorkspace.tsx` source change. Application behavior, schema, tests, and build results are unchanged.

Schema-parity repair `08151f39e0db79c0196d50e64cd60b651c4f4992` binds the existing Team Resource Planning
and Project Invitation constraints and indexes into Drizzle without changing migration SQL or data. Focused behavior,
database-safety, schema inventory, API TypeScript, and diff checks pass; publication remains separately authorized.

The PLATFORM generator is now the sole authority for generated platform content. Commit
`3a137aec83283e29c1a6661c3af2812b31ff1768` removes manual commit-specific PLATFORM prose and emits the
schema-parity rule deterministically, preventing API builds from dirtying the tracked Living Brief.

# Feedback operations v1.60.35.11-F - Integrated Local Evidence Accepted

- Exact accepted local source is `2376b3cc5fb561235e61a009237a487820e14354`, tree `5bc5a052108e8839abb71ef4058ce908dd7bbf0f`. Build 11 adds durable scan scheduling at `192903a1`, governed operational activation at `ea25b9f4`, hardened customer/reviewer UI states at `81018499`, normalized scanner proof at `58cb605f`, release alignment at `1be41cdf`, and exact browser-harness corrections through `2376b3cc`. This source remains local: it has not been pushed, synchronized to Replit, published, deployed, production-activated, or customer-accepted.
- Scanner-clean authority remains fail-closed. Quarantined assets now use fair atomic claims, bounded batches, durable attempts/next-attempt, expiring leases, monotonic fencing, database-clock exponential backoff, crash reclaim, and a quarantined manual-review terminal after the bounded attempt ceiling. Backfill progress exposes quarantined, eligible, deferred, leased, manual-review, and oldest-eligible-age counts without exposing customer evidence or raw errors. Production still requires exact ClamAV startup identity/version/signature health and live clean/infected/failure/backfill receipts.
- Telegram DOCX/XLSX delivery now requires a connected super-admin plus current enabled Feedback-package preference and current granted notification consent. Every current-snapshot recipient/artifact cell retains sending, sent, failed, skipped, retry, or unknown/manual-review authority; stale ambiguous sends are not blindly repeated, bounded failures can retry, and overall `sent` still requires every required current DOCX/XLSX cell to be sent. Missing provider, consent, preference, or recipient remains default-deny. No live Telegram call or delivery is claimed.
- Customer and reviewer surfaces now distinguish persistent storage from scan availability, retry scheduling, manual review, and operational readiness. Notification settlement remains durable and idempotent; read state composes without erasing delivery disposition. Reviewer/customer drawer, modal, rail, and Spanish evidence states were hardened without exposing storage keys, worker internals, or provider credentials.
- Exact package proof at `F:\BIMLog\Evidence\feedback-addendum-20260817\build11-package-1be41cdf-20260821T160800Z` contains PDF SHA-256 `5DACFAB3DFC6CD3751B4BB4E6D752A316E9648DA770E3C992E16D8E12B6A0066`, DOCX SHA-256 `7078DCD2991AFD694A3A4CD173421DE541CD3DC7171114072B6F2BA05FD9E233`, and XLSX SHA-256 `68C752F3F617B38350E458CD3AB23CC0C9188A27A3BB6EF14B67F95B237AF29B`. All retained rendered PDF, Word, and workbook pages were visually accepted. These are local controlled artifacts, not production-generated customer files.
- Integrated controlled Chromium evidence is bound to exact pre/post source `2376b3cc5fb561235e61a009237a487820e14354`, 256 production inputs, an isolated bundle, six scenarios, seven screenshots, and 100/100 assertions. Manifest `F:\BIMLog\Evidence\feedback-addendum-20260817\build11-browser-integrated-2376b3cc-20260821T214500Z\evidence\manifest.json` has SHA-256 `12B12BB3B225B532BF28B56BFC67039E8323DFD54BA3957FFD4CC147EE7891CF`. It proves the controlled production UI inputs and scenarios, not a live database, scanner, Telegram provider, receiver, Replit deployment, customer, or production runtime.
- Disposable PostgreSQL 18 evidence at the integrated source passed relay schema 61/61 and authenticated HTTP/DB 38/38 twice. The cluster was stopped and its exact disposable root removed. No retained receipt path or receipt SHA-256 is claimed because none was supplied for this Build 11 run.
- Source gates passed the named Feedback addendum suite, scanner scheduling 22/22, Telegram 34/34, route authority 57, UI suites 52/49/16, API/UI/full typechecks, database safety, tracked-secret checks, and mojibake. The retained browser, package, source, and disposable-database evidence closes local Build 11 acceptance only. Push, remote equality, Replit synchronization/publication, deployment, production scanner/Telegram/receiver activation, live backup/restore proof, and customer acceptance remain external.
- PostgreSQL remains metadata and lifecycle authority; private App Storage remains temporary custody. The Windows receiver at `F:\BIMLog\Feedback` remains unmounted until its separately governed TLS, identity, receipt/readback, backup/restore, monitoring, and retention gates pass.

# Feedback backup operations v1.60.35.12-F - Local Source Candidate

- Exact product source `35f645aeca7f179befb8de95d5e5b7c4d9bacde6` adds a separate encrypted backup authority without changing the Windows receiver boundary. Every new evidence row atomically enrolls a durable PostgreSQL backup job; migration idempotently backfills existing evidence. Fair `SKIP LOCKED` claims, expiring leases, monotonic fences, database-clock retry, crash reclaim, and bounded manual review prevent one failed object from hiding or starving later work.
- Primary and backup App Storage bucket identities must differ. Configuration is sealed and rejects partial, unknown, same-bucket, invalid-key, or excessive-byte authority. AES-256-GCM envelopes contain only opaque identity and exact source byte/hash authority. A deterministic object name prevents random orphan proliferation after a crash. The worker downloads, authenticates, decrypts, and verifies exact bytes and SHA-256 before settling a job as verified; failures remain retryable or manual-review and never claim backup success.
- Super-admin operations now distinguish primary custody, independent encrypted backup, scanner backlog, notification reconciliation, consent-bound Telegram documents, and the still-unmounted permanent Windows receiver. Backup counts expose queued, eligible, deferred, leased, verified, manual-review, and oldest eligible age without revealing bucket credentials, keys, filenames, or evidence contents.
- Local deterministic gates passed: backup authority 15/15, complete Feedback addendum suite, scanner/Telegram/notification/package regressions, route authority 58/58, reviewer UI 50/50, API/UI typechecks, startup bootstrap, database safety, secrets, mojibake, and diff checks. Disposable PostgreSQL 18 passed relay schema 61/61, authenticated HTTP/DB 38/38, and the new exact backup lifecycle 12/12; its loopback cluster was stopped after execution. This section does not claim a production bucket, secret binding, live backup, push, Replit publication, deployment, or customer acceptance.
- Exact controlled Chromium proof is sealed at source `fbdc23377217bfa5766ec0f6e25bb8a56162df9c`, tree `500529da65744464a3350880071a0d38337394e8`: 256 production inputs, isolated production bundle, six scenarios, seven screenshots, and 102/102 assertions. Manifest `F:\BIMLog\Evidence\feedback-addendum-20260817\build12-browser-integrated-fbdc233-20260821T183000Z\evidence\manifest.json` has SHA-256 `4CFE0B917B099DFCA696FCADEDB238526771F9ECCACA2A0FA231F3B8F2AAE221`. English desktop and Spanish 390px operations prove the independent encrypted-backup card, exact-restore settlement language, scanner/notification/Telegram truth, reviewer workflows, customer intake, and zero unexpected browser/network/leak findings. Its API/media boundary is controlled; it does not claim a live backup bucket, database, provider, Replit deployment, customer, or production system.
- The exact clean Build 12 source also passed the full workspace build: database safety reports 188 tables, 254 indexes, and 144 startup tables; all workspace/API/UI typechecks and builds passed; the deterministic API runtime closure assembled 15 direct packages, 15 dependencies, and 16,329 files. Local source acceptance is complete subject to final Living Brief and clean-head verification; normal push and every external activation remain separate.

# Lens Next v1.0.07-Pro / M7 - Embedded Field Repair

- Exact repair source `69b5c916cf27a2367400135d590ca6cbf7e9f690`, tree `d5f30a02a70fa506b13429fc01dacac381630373`, restores the Navisworks launch-mode viewport wrapper and replaces the vertically stacked issue/details flow with a bounded two-pane workspace. The issue/filter browser and selected-issue details now scroll independently; a clear empty detail state occupies the right pane until selection; layouts below 561 CSS pixels intentionally fall back to one column.
- Existing exact-identity, read-only Working View behavior remains unchanged and continues through the established loopback bridge. The repair does not alter the native plugin, bridge port `8766`, model data, Saved Viewpoints, authentication, database schema/data, Legacy Lens, publishing capabilities, or any unrelated BIMLog module. It does not start M8.
- Local verification passed: focused M7 field-repair behavior 18/18, BIMLog UI TypeScript, production Vite build, and build artifact verification. The previously accepted M7 ZIP remains unchanged at `F:\BIMLog\LensNext-Pro\03_Builds\LensNext-v1.0.07-Pro-2021\BIMLog-Lens-Next-Navisworks2021-v1.0.07-Pro-Milestone7-20260820-165226.zip`, SHA-256 `C448827E1B3D657E272E0D82EE4A7D9DD8B42DA4C72CEB500E848B5533A3B356`.
- This is local source/build evidence only. Push, Replit synchronization/publication, deployed verification, and the required real Navisworks Manage 2021 field acceptance remain separate gates.

# Lens Next v1.0.08-Pro / M8 - Controlled Issue Publishing

## Platform-backed temporary Working View reconstruction

- Implementation unit `47303fe9b6cf5af6a5a6814b01e08980d5e48d0e` connects the existing native temporary-view reconstruction engine to BIMLog platform custody. A visual-state package contains exact camera, selection, visibility, appearance overrides, sectioning, redlines, model references, immutable issue identity, model fingerprint, completeness declarations, and native digest. The package is stored separately from the issue list and fetched only for an authorized exact-identity open.
- BIMLog is the sole runtime source of truth for Lens Next Working Views. The user action fetches the exact authoritative visual-state package from BIMLog and sends it to Navisworks only for temporary application. It never searches, opens, captures, or uploads a local Saved Viewpoint and never performs click-time backfill.
- A legacy record without an authoritative BIMLog visual-state package is visibly unavailable and its Working View action is disabled until a separately governed BIMLog data migration completes. Metadata and screenshots cannot recover camera/model state without guessing. The platform-source regression suite 8/8, API/UI typechecks, and the BIMLog production asset build pass locally. Full workspace reconciliation/build, push, Replit publication, migration of incomplete production records, and real Navisworks acceptance remain separate gates.
- Corrective implementation source `fce750315eb95cd29869d4479c1560a34dce96a7` is the first unit that enforces this BIMLog-only runtime boundary; predecessor click-time local fallback behavior is superseded and must not be restored.

- Exact product source `98e0ed974a488e4b4a514c40cd47d779a4d067cc` adds a separate M8 publication contract for status, comment, and responsible-company updates. The legacy status/edit/reassign/void routes, Legacy Lens, native bridge registration, port `8766`, Saved Viewpoints, model files, and the accepted M7 ZIP remain unchanged.

# Lens Next v1.0.08-Pro / M8 - Embedded split-pane correction

- Implementation unit `11660980e5cff0e3d88d0f5985761a719da15529` restores the required simultaneous issue-list and selected-issue detail panes after the whole-workspace scrollbar correction. The embedded workspace continues to use one outer vertical scrollbar; neither pane regains an independent vertical scrollbar. The focused BIMLog production asset build passed locally. This bounded web correction does not change the M8 version, native plug-in package, bridge, database, Saved Viewpoints, model files, authentication, or publishing authority.
- `main` and `master` were atomically advanced to the implementation unit before this reconciliation. Replit Shell then correctly rejected the stale release branch and exposed the required Living Brief reconciliation gate. No deployment or publication of this split-pane correction is claimed until the reconciled successor passes the exact Replit build and the live assets are verified.
- Publishing is server-authorized from the current database user, active project membership, and configured `admin`/`write` permission. Read-only users receive a truthful disabled UI and the server independently refuses mutation. The UI requires a reason, an explicit review step, and a separate confirmation before transport.
- Every request binds the exact project/server/viewpoint/lifecycle/revision identity plus a monotonic workflow mutation version. Stale drafts return a safe current snapshot with HTTP conflict; the UI never silently overwrites. Actor-scoped idempotency is serialized by a transaction advisory lock: an exact retry returns the original receipt and a divergent retry is rejected.
- Status, comment, or assignment publication, mutation-version advance, and the immutable before/after audit receipt commit in one PostgreSQL transaction. A trigger rejects receipt update/delete. Any audit failure rolls the issue mutation back. History projects the recorded actor, company, reason, comment, before/after state, and timestamp.
- Local focused gates pass: controlled publishing behavior 15/15, publishing UI authority 11/11, API and UI TypeScript, database source safety (189 tables, 256 indexes, 145 startup tables), database-safety fixtures, tracked-secret checks, mojibake, diff checks, and the exact full production build/runtime closure (15 direct packages, 15 dependencies, 16,332 files). The successor also rejects unknown nested identity fields and action fields that do not belong to the selected action. This is local source/build evidence only; disposable PostgreSQL HTTP concurrency proof, controlled browser proof, independent QA, push, Replit publication, deployed verification, and real Navisworks 2021 field acceptance remain pending.

# Feedback packages v1.60.35.09-F - Local Candidate

## Reviewer operations and complete package successor

- Current report and workspace successor `9ea04835cab21087ed7c3fdcd49ea59c9a92e00c` stops serving stale stored snapshots as current reports. PDF, Word, item Excel, JSON, and ZIP generation now reads the current PostgreSQL record plus current authorized storage bytes; scanner-clean images are embedded, every evidence row carries an authenticated review link, and clean evidence also carries an authenticated download link. Transient scanner retry events are excluded from human reports and package regeneration authority so repeated scan attempts cannot flood documents or create false package churn.
- The entire desktop navigation—not only the notification inbox—is now width-adjustable, persistently collapsible to an icon rail, and independently restorable. The Feedback reviewer drawer uses current-evidence, activity, package, assignment, status, and customer-message language instead of the former ambiguous review controls.
- Retained current-authority artifact proof is under `F:\BIMLog\Evidence\feedback-addendum-20260817\package-artifacts-current-authority-20260821T1005Z`: the four-page PDF, rendered Word report, and Excel workbook were reopened and visually inspected; DOCX/XLSX media inventories prove embedded clean-image bytes and their evidence links. Exact controlled Chromium evidence for harness commit `41f4cc2edffe6a523663257b39e39bb8a644250b` passes 76/76 at `F:\BIMLog\Evidence\feedback-addendum-20260817\final-browser-current-artifacts-41f4cc2e-20260821T1100Z`; manifest SHA-256 is `28F6329CE196152EC5B010C757B9E4CFBD66B0B3A819B173DFF0D006CDD00EE1`. This is local controlled evidence, not publication or production acceptance.
- Database-safety test successor `b8622d4` validates the unified parity inventory against each owning declarative/runtime schema instead of incorrectly requiring Feedback constraints in the financial-contract file; the fixture passes without weakening destructive-DDL detection or changing database behavior.

- Exact product commit `854d9c16f0e2f8d3177e84ecffcd1dd2ebad5960` completes the super-admin Feedback operating surface for release `v1.60.35.09-F`: only legal lifecycle transitions are offered; owner claim and save outcomes remain visible; the queue has synchronized top scrolling, sticky identity/status/action columns, a sticky header, a fixed review drawer, and explicit action names and explanations.
- The notification inbox is a fixed, internally scrolling side panel whose width is user-resizable and persisted. It can collapse to a 56-pixel icon rail with unread count and can be restored without losing its state; mobile retains a full-width presentation.
- One Feedback package now contains canonical JSON, a governed human PDF, a Word report, an item follow-up Excel workbook, and only hash-verified scanner-clean evidence. Every evidence row retains an authenticated review-record link even while its bytes remain locked; clean evidence additionally receives an authenticated download link, and clean images are embedded in PDF and Word. A separate master follow-up Excel export covers the live PostgreSQL register.
- The automatic snapshot worker now persists PDF, JSON, DOCX, and XLSX objects with exact hashes and backfills predecessor snapshots that lack the new document formats. Retained local proof at `F:\BIMLog\Evidence\feedback-package-proof-20260821T1000Z` was reopened and visually inspected: the PDF has four readable pages with report identity/page numbering/fingerprint; the Word report renders as one readable page with links, evidence table, history, fingerprint, and footer; the Excel workbook reopens with Follow-up, Evidence, and Activity sheets and working evidence hyperlink metadata.
- Telegram document delivery is implemented as a durable, idempotent post-package worker for linked super-admin reviewers. It verifies stored bytes and hashes before sending the Word report and item Excel workbook, then records delivered, failed, or unknown provider disposition. This is source capability only until the existing production Telegram authority is verified as configured and connected; no provider delivery is claimed here.
- Replit Nix source includes ClamAV and FreshClam bootstrap successor `2e9d62c478dc70502d7e5bee7dabd26511859302`, binding direct launcher SHA-256 `6b70dfb5736d3af809bd3a41afa183817bc60df81b13822a7ff3f97e82ceb354`, exact content-addressed `clamscan` and `freshclam` paths under `/nix/store/j01wsla7rfrgjv3605l561mni4b4ka05-clamav-1.4.3`, version `ClamAV 1.4.3`, and governed configuration SHA-256 `6ed4f546ac3efced17ff8ba320cbff2c98e44fe33303a1c9fa2741a9171b3492`. The visible Replit Shell proved the declared Nix `freshclam` requires the governed config, an absent first-run database must return before inventory arithmetic, and a healthy signed database appends its sequence/date to FreshClam's base version. The successor validates that exact base executable version while preserving the database suffix and all fixed-path/hash checks. Startup remains fail-closed until Cisco Talos signature databases are downloaded, verified as bounded regular no-link files, loaded by the exact scanner, and marked ready. Exact governed wrapper clean/infected execution, deployment promotion, and automatic evidence backfill remain pending. Existing ticket metadata remains reviewable while attachment bytes stay quarantined. The scan worker alone may promote exact bytes to clean and trigger regenerated packages; manual database promotion is prohibited.
- App Storage remains temporary publication custody. The intended permanent receiver target is `F:\BIMLog\Feedback`, but a hosted Replit process cannot directly write a private Windows drive. The reviewer UI states this as not connected; permanent transfer requires the separately governed reachable TLS receiver/service, keys, firewall, health, readback, and backup proof. No receiver activation is claimed.
- Focused API/UI typechecks and Feedback evidence/storage/package/follow-up, Telegram worker, route authority, reviewer UI, notification-panel, customer widget, and scanner executable suites pass for the exact product successor. GitHub synchronization, Replit deployment promotion, live evidence backfill verification, Telegram delivery, and permanent receiver activation remain separate external gates.
- Exact integrated controlled Chromium evidence for harness commit `5a7dc2f55921bcc7d7651fe396134ebb35df0537`, tree `47e109fd8d6ab0ee4759770a676f7e9cf3c98f96`, passes 73/73 at `F:\BIMLog\Evidence\feedback-ops-integrated-5a7dc2f-20260821T1230Z`. Manifest SHA-256 is `70292673CC18187A54A9C3A97D353D2DD80F381D71F938FABD0906071B0F7550`. It binds a clean preflight, 256 immutable production inputs, isolated production bundle, EN desktop, ES mobile, notification resize/collapse, super-admin reviewer, non-super-admin denial, screenshots, zero browser/network failures, and identical clean postflight. Its API/media boundary is controlled and does not claim real database, provider, Replit, scanner-process, customer, or production acceptance.

## Replit App Storage publication hotfix

Build 8 App Storage source `58b773b6c4a43c3f1c30a4ab47190fc13dc1953a` is pushed to `main` and `master`, synchronized to Replit, and passes the Replit Shell build. It keeps Feedback enabled and uses the official `@replit/object-storage` adapter with opaque object names, exact-byte SHA-256 readback after upload, bounded streaming downloads, retention-hold denial, health-probe cleanup, and fail-closed bucket binding. Replit created bucket `bimlog-feedback-temporary` and wrote its four non-secret Feedback bindings plus `objectStorage.defaultBucketID` into tracked `.replit`; that provider-managed source mutation made the deployment snapshot dirty, so deployment `a34f876f-539a-49d6-bc40-d6281bb9d28b` correctly failed before bundle/promotion. Commit `5fa2033e03161ecfdca17304c580c58b6efaf5c7` binds those exact non-secret settings in source so interactive and deployment workspaces converge. Another paid publish attempt is prohibited until the exact successor passes the full build, is pushed/synchronized, and Roberto explicitly authorizes the post-failure attempt.

- The exact local operational-intake product candidate is `78374d8bfeb4b41c722a55bd7a3d01cc00fcebdd`, tree `62905016ecdcbc899861b67172de7a46f195e00f`, release identity `v1.60.35.09-F`. It preserves the governed package/register/notification and accessible markup scope, valid `/feedback` and `/admin/feedback` deep-link handling, and stable-ID targeting of the Feedback administration tab.
- Exact controlled Chromium evidence at `F:\BIMLog\Evidence\feedback-addendum-20260817\final-browser-344a0ba-20260820T142500Z` passes 58/58 assertions, including the nested markup modal workflow and hidden-parent inspection. This is controlled local browser evidence, not published, live production, or customer acceptance.
- Retained governed PDF proof at `F:\BIMLog\Evidence\feedback-addendum-20260817\package-pdf-governed-29122fa-20260820T132500Z` has SHA-256 `1979DD03FA9DC51243F20C3FC338749EE50F4A2C0954CA4C22566317E8C8979C`; all 4 rendered pages were visually inspected and accepted. This local artifact acceptance does not imply push, publication, production receiver/provider activation, or customer acceptance.
- Focused behavior proof passes for package manifest/PDF/ZIP integrity and redaction, bounded evidence inclusion, atomic original/marked screenshot roles, six-field multipart parsing, follow-up register routing, submission/reviewer/customer notification separation, durable email outcome audit, retryable non-sent delivery, idempotent response delivery, opt-in email, provider default-deny, and HTML escaping. These are local source and deterministic behavior tests, not production receiver, provider email-delivery, publish, or customer evidence.
- The super-admin Feedback queue now exposes immediate PostgreSQL-backed intake visibility, evidence clean/quarantined/rejected counts, package readiness, complete evidence/history detail, owner claim, status control, governed internal ZIP download, PostgreSQL-derived follow-up CSV export, and customer-visible response controls. These are local source capabilities and do not establish publication, production migration, live provider delivery, or customer acceptance.
- The reviewer authorization mismatch is closed at `78374d8b`: the Feedback navigation tab and reviewer panel render only when the authenticated Zustand store user is a super-admin; a non-super-admin deep link resolves to the ordinary administration overview and never mounts the reviewer API surface. Final controlled Chromium evidence at `F:\BIMLog\Evidence\feedback-addendum-20260817\feedback-ops-final-78374d8-20260820T1905Z` passes 68/68 assertions across the prior bilingual customer widget plus super-admin queue/deep-link/detail, optimistic claim, customer response, package/register downloads, and non-super-admin no-tab/no-API denial. The independently computed `manifest.json` SHA-256 is `5B0DE3E78471C268189AE4CB622FF011583B873CE4197E4EEDBE341A89D98B41`; the manifest binds exact head/tree, 0 failures, four scenarios, and zero leak matches. This is controlled in-browser API/media evidence, not a real database, provider, scanner process, Replit, customer, or production result.
- Canonical submission now commits the feedback, acknowledgment, and pending notification-outbox audit state before notification delivery. Customer and super-admin reviewer notifications are attempted after commit; failure returns a durable receipt with `retry-required`, and a periodic idempotent reconciliation worker backfills missing acknowledgments/reviewer notifications or records the absence of an active reviewer. Notification failure therefore no longer rolls back or falsely fails the canonical intake.
- Customer DTOs no longer expose the internal disposition reason. Customer notification links open the Feedback backlog, while reviewer links open the exact super-admin queue item; customer-visible responses and email-copy consent/provider rules remain separately governed.
- Feedback entry-point correction `7fbcb3ec0978b3529ec67c27fa8063b62d108caa` separates creation from follow-up: the floating Feedback button and plain `/feedback` route always open **New feedback**. Reactive-query successor `e9fcee4604669cb2f3b313c038d9b386a943660c` makes in-app and email notification links at `/feedback?view=mine` reliably open **My feedback** instead of being reset to the form. Both changes are pushed and published through exact head `0582eb57be47685b9dcfee88ac192348f2e75307`; live verification confirmed the new-submission form, persistent history query, clean close/reopen behavior, release `v1.60.35.09-F`, and existing ticket `FB-ED3259007843` with zero observed browser errors.
- Report-link correction `9944f912a071faea744334102879ab1690f15a05`, tree `32a5553df69691a301890863119a3c5e88b2e335`, replaces unauthenticated raw API hyperlinks in PDF, Word, and Excel with signed-in BIMLog UI links. The UI resolves the exact stable feedback and evidence ID, then performs the bearer-authenticated, audited download; opening ordinary feedback detail without a `downloadAsset` request does not trigger a false download error. Every generated format now states that metadata is held in PostgreSQL and file bytes are held in the private Replit App Storage bucket `bimlog-feedback-temporary`; the provider object locator remains private and no `F:\BIMLog\Feedback` copy is claimed. Retained local proof is under `F:\BIMLog\Evidence\feedback-addendum-20260817\package-links-and-custody-20260821T1545Z`: PDF SHA-256 `6CA58C25A17139F2A05BB1536F66E57C51CE7463654AFCE537F5F131140D53AC`, DOCX SHA-256 `5B3D9CC373823A6B44E500585841F98B275F2A857D0F2F74DD7B1E562E181CFB`, and XLSX SHA-256 `94DD25AB4005C481A72016EDE80649B935D9BB3F7E486CDB77E1D57039261689`. Rendered PDF/Word and workbook sheets were visually inspected; archive relationships contain only BIMLog-mediated review/download URLs. This is local source/artifact proof pending push, Replit synchronization, publication, and live signed-in verification.
- Office-link resilience successor `14bd3a02dd296e54d797f04676b161be06aae1cf` preserves the private signed-in evidence boundary while addressing Microsoft Protected View. Word now prints the complete BIMLog evidence-page URL beside its external hyperlink and explains Enable Editing/copy-paste recovery. Excel now provides both a clickable **Open in BIMLog, then download** cell and a dedicated copy/paste URL column; both formats land on the authorized evidence page where the reviewer explicitly selects **Download verified file**. Retained proof at `F:\BIMLog\Evidence\feedback-addendum-20260817\office-links-proof-20260821T123000Z` includes DOCX SHA-256 `81EBB7FC4D5A08C37506E07002133D4201276C7DAF531FF668CE31C01F28BABC` and XLSX SHA-256 `6658BC3D151E5766EFAA50CADD2BF07A6825DC715D6F365A2145333B14DED95C`; both were reopened through isolated Microsoft Office instances and rendered for visual inspection. Existing downloaded reports remain immutable and must be regenerated after publication to receive this guidance.
- Automatic package snapshot candidate `95bc4614332894f71b692b5b564a70c5a43fa0d3` turns the PostgreSQL follow-up record into durable customer and internal PDF/JSON snapshots. A post-start worker finds the latest material audit event under an advisory lock, builds the governed package from one transactionally read ticket/evidence/history authority, writes hash-verified PDF and canonical JSON objects to the configured Feedback storage adapter, and records their opaque paths, hashes, byte counts, visibility, source event, release, and package state in an immutable `package_snapshot_created` event. Customer and super-admin routes reauthorize access and verify exact stored bytes/hashes before returning the snapshot; the complete ZIP remains an on-demand composition of the same record and clean evidence. Snapshot/export events are excluded from future package source history to prevent self-triggering or private storage-key leakage. Upload or audit failure compensates stored objects and retries later without changing the canonical ticket. This is a local source candidate pending exact build, browser proof, push, Replit sync, publication, and live verification; it does not activate ClamAV, the Roberto receiver, transcription, or email providers.
- Replit schema-sync corrections `c13263d0b5decd48fc9b49118a48ad241b5f8476`, `e5458c4c14ff10cfada8df2ec10672127666e336`, exact-definition proof `d2baedb3a26686f6533d0d116add4dd048325670`, and compatibility closure `f3425d2f3bdd9dcff2b1faef40c37104c7b00ca2` replace the Drizzle BigInt JavaScript default with an equivalent SQL literal, reject uncaught JavaScript tool errors, bind every governed Feedback foreign-key/expiry constraint under its exact production name and PostgreSQL definition, and retain the already-installed legacy auto-named duplicate foreign keys so Replit cannot delete them during publication. Three publication previews were cancelled before approval because they proposed dropping Feedback constraints; no production migration ran. The strengthened development parity gate refuses any missing, renamed, or definition-drifted governed Feedback constraint, and publication approval still requires a preview with no destructive Feedback SQL.
- Production ClamAV scanner and quarantined-evidence worker source is implemented and Replit's executable plus signed-database bootstrap authority are tracked through `5de30cc8`. Activation still requires exact Replit Shell clean/infected proof and a successfully promoted deployment; until then production evidence remains quarantined and the worker cannot be claimed operational.
- Plugin build and package enforcement is H-only at `c85d7797657f19a179390031ca102b3686b344ab`: the documented canonical roots are `H:\BIMLogPlugin2021` and `H:\BIMLogPlugin2025`, and build/package guards reject nonmatching roots and non-H output paths. This source/document enforcement does not claim a new plugin build, package, installation, Navisworks run, or field acceptance for this Feedback release.
- Accepted source tranches in this ancestry are the authenticated relay migration and exact disposable PostgreSQL receipt at `4ed5e6a994123e5dcda03af2e35d261b5ae02a92` (receipt SHA-256 `6a98583b5e78e520be44e095307a382cce5554c221bee14f498a2404497c088d`), purge-issuance authority at `6eb013719a3a34147c5ae1d4caec244d49060ff0` (receipt SHA-256 `8a116635b6a61b901960fbe94f47745b971185498f9296b5d79d172c227f7288`), customer route/privacy correction `88b0692f6196dfa442dacacb54fb594e0a69c3a0`, bounded storage-read corrections `dc3ff093a9f4e9db90f8198a6ca712cf15eae8b6` and `7714a8ac39957f15f850e20215815b3bb316a21d`, and receiver/purge-adoption correction `d3c23cd4fab0cc3f3cc0aeb7b93a7add26dfaa38`.
- Feedback records carry stable IDs, optimistic versions, reporter/project/page/module/browser/build context, accountable triage states, decision reasons, target release, customer visibility, and immutable audit events. Every customer-visible evidence lineage is returned separately with its current relay state and sanitized history: Queued, Transferring, Receipt verified, Cleanup pending, Delivered, Manual review, On hold, or Expired.
- Microphone and screen capture first require the user to accept the versioned `feedback-capture-v1` notice for the stated purpose. Capture starts only on a later browser gesture. Discarding before submission revokes the associated consent, and a failed revocation blocks close/discard until retry. Imported files do not claim capture consent; imported-audio transcription requires its own explicit processing consent. Screenshot crop provenance retains source hash/linkage, bounds, dimensions, origin, and transformation time.
- Evidence remains fail-closed in quarantine until a governed scanner approves it. External transcription remains default-deny; its result cannot replace reporter text and requires linked consent, hash-bound idempotency, provenance, and explicit accept/reject review. Local scanner and transcription adapters are fixtures only and cannot activate in production.
- The architecture sends clean evidence directly to a receiver controlled by Roberto when a healthy receiver is explicitly configured. PostgreSQL remains the backlog/lifecycle authority and the receiver filesystem is a verified custody projection. No Google Drive path exists for Feedback. With no approved mounted receiver or private encrypted temporary relay adapter, delivery fails closed visibly and no permanent BIMLog/Replit byte custody is inferred.
- The receiver core implements signed request/receipt/readback, bounded streaming, authenticated indexes and journals, generation-fenced backup/restore, hold-aware signed purge commands, authority revalidation, and durable deletion/absence evidence. Retention release/purge is nevertheless default-deny at the product boundary: receiver HTTP endpoints and operator projection are not mounted, no approved production retention policy or signer/key is active, and no production deletion is enabled.
- Package generation reads evidence only through the bounded storage adapter and fails closed when clean evidence cannot be read or its exact byte size/hash does not match. The generated package is an export projection of the PostgreSQL record and verified evidence; it does not activate, mount, or substitute for the Roberto-controlled production receiver.
- The integrated controlled-mock browser reseal at `fcc1e3261c91a830979ae0e426d2d96e7b3afc93`, tree `779559a12b93fc9cacc45f773e949524d2f8ed86`, and manifest SHA-256 `22a313595b9f11f39fa32bdbba92361cec6322f7209c9a3b8a8603825aee8a10` remains accepted predecessor product evidence. Exact-current controlled Chromium coverage is now the 68/68 `78374d8b` receipt above; authenticated full-stack browser acceptance against a disposable PostgreSQL boundary remains pending.
- The final exact-head acceptance receipt at `962561c3e1ed028260355b5e76409c60dde55cee` has SHA-256 `2c9925e8c7db40de270acb22d9222dce083779a53da326afe7eac8b490e62cbb`. It records dynamic disposable-PostgreSQL behavior 99/99, source/receiver behavior 215/215, API/UI/full-workspace typechecks, database safety, production build/runtime assembly, standalone production artifact, secret/mojibake/diff checks, Living Brief integrity, and zero Feedback database residue as PASS.
- Artifact proof used a disposable loopback PostgreSQL database and a bounded durable-filesystem authority. Its database evidence is value-blind identity/hash and aggregate status only; no plaintext binding or secret was persisted or printed. This acceptance does not establish a live receiver, provider, Replit, production database, publication, deployment, or customer outcome.
- Startup receipt SHA-256 `e0c7140ab2bcdd93e4c20b05ceacc2e26214120568ad056dfd50f6f0f76d4e49` binds the real standalone production artifact to `9e428f3cb249d5b80041ee5f19ded9cfe962d141`. With invalid storage authority, the uninstrumented child reports one sanitized `FEEDBACK_STORAGE_AUTHORITY_INVALID`, exits naturally with code 1, never reaches TCP or readiness, and leaves the port reusable without forced cleanup. With valid authority, `/api` and `/api/v1/healthz` return 200 and workers start only after the listener, with duplicate worker start suppressed. This natural-process receipt supersedes the earlier synthetic invalid-authority child proof at `55149e5c4bdf430cd97891da00e268e5b20644fe`; that older receipt remains historical only.
- `ensureFeedbackSchema` remains the sole additive runtime Feedback migration authority. All PostgreSQL receipts are isolated localhost evidence and do not authorize production migration.
- Startup behavior, API/full-workspace typechecks, database-safety source and fixtures, tracked-secret, mojibake, production runtime-closure build, and standalone production artifact pass at `9e428f3cb249d5b80041ee5f19ded9cfe962d141`. After Living Brief reconciliation commit `7ef033426b0d34f6617138de95493381f033ceeb`, the exact full workspace build also passes, including 187 tables, 251 indexes, 143 startup tables, both application builds, and deterministic API runtime closure. This is local source evidence only: it is not pushed, available in Replit, published, deployed, production-migrated, provider-activated, independently release-accepted, or customer-verified. Source push and Replit publication remain separate explicit phases.
- Independent source QA accepted the four changed Procore PG18 paths at `faf4f732e901278451984385616ff878f3164d38` with no source P0/P1 finding. The writer also reported focused behavior, real disposable PostgreSQL 18 first/repeat idempotence, production startup, API/full-workspace typechecks, database safety, secret, mojibake, and diff checks as PASS. Those real-database/startup executions were not preserved in a hash-bound retained receipt, so they are supporting writer evidence rather than a sealed execution receipt. Exact-current Living Brief/build closure and both final browser gates remain pending.
## Lens Next v1.0.08-Pro stale-identity field correction

- Web source `b69bca7f96cbf2eafb1055007a0d45cdb56c5085` removes the internal `M8` milestone from the customer-facing header and renders `v1.0.08-Pro` as subordinate text without changing the accepted two-pane, one-whole-panel-scroll layout. The focused UI contract passes 19/19 and the BIMLog production asset build passes.
- The canonical Navisworks 2021 source under `H:\BIMLogPlugin2021\LensNext-v1.0.08-Pro-M8` now keeps exact Navisworks GUID resolution first, but permits an unresolved stale GUID to fall back only to exact BIMLog metadata or one unique exact display code. Ambiguous or non-exact candidates remain denied. H-only package gates pass 30/30 core and 14/14 native tests; ZIP SHA-256 is `6C4A93ADB95014799924CD50264301992D52F8D3B9E13B702C0282C658E09DBE`.
- The exact H-drive package is installed in Autodesk's required Navisworks 2021 load path with core SHA-256 `507B9D3388B85F758A0ED49D2B16DC81F873A011EA156BAF077745A7410AD547` and native SHA-256 `AA550DB157A6183ED1DA098B88399376F1743E0E98F7CDC8358C9F2441E5B5C5`. Navisworks was closed during installation. Live load and real **Open Working View** acceptance remain pending.
# Lens Next - BIMLog-only Working View correction

- BIMLog is the sole runtime viewpoint authority. The selected issue must advertise a stored visual-state package; **Open working view** loads that exact package from BIMLog and sends it to the native bridge for temporary reconstruction. The user action performs no local Saved Viewpoint lookup, native capture, migration, platform backfill, Saved Viewpoint mutation, or model-file write.
- Production read-only inspection on 2026-08-24 confirmed 20 ELARA EAST BIMLog issue records. The inspected historical records do not yet advertise visual-state packages, while their physical Saved Viewpoints may still exist under Original Lens management in Navisworks.
- Lens Next v1.0.35 performs the governed first-open recovery itself. The native adapter considers only Original Lens-managed Saved Viewpoints and merges their managed metadata comments last-write-wins, matching Original Lens behavior. It proves the selected BIMLog row by exact merged project/server metadata, exact merged project/physical metadata, or one unique exact BIMLog display code, and accepts a supplied Navisworks GUID only after that independent BIMLog correlation. It captures the visual state, stores it on the exact BIMLog row, then reconstructs the Working View from BIMLog. No trade/company/title similarity or model-object lookup is allowed.
- The H-only Lens Next v1.0.35 package compiles with zero warnings/errors; core tests pass 30/30 and native 2021 tests pass 21/21 including the real split-comment historical identity pattern. Package `H:\BIMLogPlugin2021\LensNext-v1.0.08-Pro-M8\BIMLog-Lens-Next-Navisworks2021-v1.0.35.zip` has SHA-256 `D759895276A96A50C924BB733BD35BA81221FC6B59AE4F55358DC0A0D8109D08`. The discovered v1.0.19 load came from a stale AppData bundle outside the authorized load paths; installation and connected Navisworks field verification remain separate gates.

## Lens Next controlled rebuild — Build 1 local candidate

- Build 1 replaces the manually persisted project ID as runtime authority. A named active Navisworks document now binds only when its Original Lens-managed Saved Viewpoints yield one unique exact BIMLog project identity; mixed identities or no managed identity fail closed. The detected value is session-only and is not written back as user configuration.
- The native bridge exposes a read-only local inventory containing only Original Lens-managed Saved Viewpoints, including exact merged identity, Navisworks GUID, and folder path. The BIMLog workspace loads platform inventory first, verifies the bridge project/model context, then classifies the two inventories as matched, platform-only, Navisworks-only, conflicted, or unresolved without changing either system.
- Local gates pass: core compile 0 warnings/errors, core contracts 30/30, Navisworks 2021 contracts 22/22, Build 1 inventory behavior, BIMLog and API typechecks, and the verified production frontend asset build. This is a local Build 1 candidate only; it is not packaged, installed, pushed, published, deployed, or field-accepted.

## Lens Next controlled rebuild — Build 2 local candidate

- Build 2 adds an authoritative BIMLog model-binding registry so a named clean Navisworks model can establish its project without Legacy Lens viewpoints and without a manually configured project ID. The native bridge starts unbound with a stable normalized model key; an authenticated BIMLog session resolves that key only among projects the current user may access, then binds the native session to the returned project.
- Existing exact Original Lens-managed project metadata remains admissible bootstrap evidence. If it conflicts with an established registry binding, the session refuses to bind. With no registry entry and no exact local managed identity, BIMLog permits only one unique authorized platform project match from governed project code, name, location, or exact leading street number; no match or ambiguity fails closed.
- The legacy Project ID setting is disabled and cannot write runtime authority. A successful registry binding persists as the session binding source across refreshes and updates the native session header state. Build 2 does not create, rename, move, delete, reconstruct, upload, or publish viewpoints and does not run a production database migration.
- Local gates pass: core contracts 30/30, Navisworks 2021 contracts 23/23, authoritative model-binding behavior, API and BIMLog typechecks, database safety with 190 tables and 258 indexes, both production application builds, and deterministic API runtime closure with 15 direct packages, 15 dependencies, and 16,335 files. The exact-clean full-workspace build passed after generated platform-structure reconciliation. Nothing is packaged, installed, pushed, published, deployed, production-migrated, or field-accepted.

## Lens Next controlled rebuild — Build 3 local candidate

- Build 3 produces a deterministic, read-only synchronization plan from the current BIMLog view and the exact Original Lens-managed local inventory. BIMLog is evaluated first. Exact identity precedence is server record, then BIMLog physical identity, then exact display identity; a match must be one-to-one across the complete platform inventory.
- Each selected platform item is classified as already synchronized, pull from BIMLog, manual conflict, or blocked. Pull is proposed only when BIMLog advertises an authoritative visual-state package and digest. Exact managed local-only viewpoints are proposed for upload to BIMLog; incomplete local identities are blocked. Filtered-out platform matches still reserve their local identity and therefore cannot be misclassified as local-only.
- The workspace displays counts and an expandable per-item explanation. It uses the existing whole-panel scrollbar and exposes no execute control. This build performs no platform write, native bridge write, viewpoint creation/reconstruction, model mutation, schema change, package, install, push, publication, or deployment.
- Focused Build 1 regression, Build 3 behavior, BIMLog typecheck, database safety with 190 tables and 258 indexes, both production application builds, and deterministic API runtime closure with 15 direct packages, 15 dependencies, and 16,335 files pass locally. The exact-clean full-workspace build and Living Brief integrity gate pass. Nothing is packaged, installed, pushed, published, deployed, production-migrated, or field-accepted.

## Lens Next controlled rebuild — Build 4 local candidate

- Build 4 opens a temporary Navisworks Working View only from the selected BIMLog record's complete visual-state package. The fetched digest must match the refreshed issue inventory and the package's embedded native digest before dispatch. Native reconstruction validates exact session/project/model/issue identity, completeness, and digest; it applies supported camera, selection, visibility, appearance, sectioning, and redlines transactionally with rollback, without creating a Saved Viewpoint.
- Missing platform packages are visibly blocked. The click path no longer searches Original Lens Saved Viewpoints, captures local state, or backfills BIMLog. Focused platform-source and Build 4 behavior plus API/BIMLog typechecks pass locally. Full clean-head closure remains pending; nothing is installed, pushed, published, deployed, production-migrated, or field-accepted.
