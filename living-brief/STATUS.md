# STATUS.md - Current Accepted Platform State

Status: Active current-state record
Accepted source reconciled through: `6f96a3f2385a08c3e364099178617d4ec16dfcf5`
Reconciliation date: 2026-07-23

This file states accepted `origin/master` source truth. Accepted source, deployed source, database-mirror
synchronization, and field/customer verification are separate states. The current semantic-content
reconciliation is an independent integration candidate and does not become accepted or deployed truth until
its review, clean commit, push, and later deployment gates pass.

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

- Security Batches C-I: not started and require separate authorization.
- Living Brief Content Reconciliation Build 2: independently reconciled review candidate only.
- Replit verified pull of `178462e`, actual 12-table preview, explicitly approved publish, runtime/mirror
  reconciliation, and deployed browser verification.
- Navisworks v1.60.18: Ruben 2025 field acceptance pending.
- Telegram Product Build 6: clean integration accepted locally on current master with 38/38 final built-runtime
  evidence. It adds only the deterministic RFI notification adapter and saved-RFI contextual controls on the
  Build 5 foundation; normal push verification remains pending, and nothing was published or deployed.
- RFI Build 8, Entitlements Step 3, Meeting Minutes M5, and Finance Build 4: not started.

See [OPEN_LOOP.md](./OPEN_LOOP.md) for actions and [AUDIT.md](./AUDIT.md) for dated evidence.
