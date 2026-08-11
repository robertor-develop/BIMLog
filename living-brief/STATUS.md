# STATUS.md - Current Accepted Platform State

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
