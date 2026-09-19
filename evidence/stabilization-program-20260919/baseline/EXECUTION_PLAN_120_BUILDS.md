# BIMLog stabilization, completion, and release program — 120 builds

Date: 2026-09-18 EDT / 2026-09-19 UTC  
Owner: BIMLog MAIN 04  
Coordination: MAIN-00 / Norte  
Starting production identity: source `07d024ef3de739abb436da58fe29797af5304b8a`, Replit receipt `9bb79bc6`, visible Platform `v1.05.N17-P32`  
Program shape: 24 blocks, five builds per block, 120 builds total

## Current execution position

- Completed: Builds 001-004 — baseline, source/worktree reconciliation, release-procedure inventory, and machine-readable defect/risk ledger
- Evidence: [BUILD_001_AUTHORITATIVE_BASELINE.md](BUILD_001_AUTHORITATIVE_BASELINE.md), [BUILD_002_SOURCE_WORKTREE_RECONCILIATION.md](BUILD_002_SOURCE_WORKTREE_RECONCILIATION.md), and [BUILD_003_RELEASE_PROCEDURE_INVENTORY.md](BUILD_003_RELEASE_PROCEDURE_INVENTORY.md)
- Completed builds: `4 of 120`
- Remaining builds: `116`
- Current unpublished builds: `4 of maximum 10`
- Next build: Build 005 — program branch, build ledger, report templates, and exact local/remote identity checks
- Next push: after Build 005
- Next publication and full authenticated Chrome smoke: after Build 010
- Active blocker: none

## Program outcome

Deliver one coherent, secure, supportable BIMLog platform whose web application, data contracts, reports, integrations, and Navisworks plugin are release-identifiable and live-verified. Lens Next becomes the only supported Lens plugin. Original/Legacy Lens remains available only as a bounded migration reader until historical evidence has been preserved, then disappears from new installations and is removed by the verified upgrade path.

This program does not authorize deleting customer records, rewriting historical audit evidence, force-pushing, using Replit Agents, or treating local tests as production acceptance.

## Execution and release rules

1. Each build produces one bounded, reviewable result with focused tests and an evidence note. A build may be implementation, reconciliation, test infrastructure, migration safety, or acceptance work; it must not be an empty numbering exercise.
2. Each five-build block ends with the full relevant regression suite, secret scan, database/destructive-change check, clean-tree proof, and a concise status containing completed block, current state, remaining builds, next block, authorization status, and exact blocker if one exists.
3. **Push cadence:** push the clean exact block head after Builds 005, 010, 015, and every subsequent fifth build through 120. Use a normal non-force push. Remote head must equal the reviewed local head.
4. **Publication cadence:** publish only at the named milestones below, normally every two blocks. A block may be pushed without immediate production publication when its paired milestone is incomplete.
5. **BIMLog publication path:** exact reviewed GitHub source -> signed-in Replit project -> Replit Shell synchronization/build -> existing schema/restore and zero-destructive-change verification when applicable -> one controlled Replit Publish -> visible live Chrome verification. Replit Agents are prohibited.
6. A `.ignitesmart.ai` edge or Cloudflare screen does not replace BIMLog's proven Replit origin publication path. Provider identity must be read from the actual project and release receipt.
7. Existing authorization to execute an approved block and its named release remains valid through completion. No magic phrase or repeated authorization request is part of this plan.
8. If a real test fails, fix the defect within the active block and repeat the failed gate. A broken local fixture or browser connector is a tooling defect to diagnose; it does not invent a new product HOLD.
9. Every production milestone records candidate commit, GitHub head, Replit workspace head, schema effects, backup/restore result when applicable, deployment receipt, live version/asset identity, rollback readiness, and smoke result.
10. Live smoke testing uses visible Chrome and includes both canonical Super Admin and an ordinary scoped account where relevant. Destructive actions, external sends, payments, and real customer writes remain excluded unless the milestone explicitly requires and authorizes a controlled specimen.

## Standard block acceptance

Every block must satisfy:

- Five bounded build outcomes are present and traceable.
- Focused tests and the relevant aggregate suite pass.
- No unresolved secret finding or unreviewed destructive database operation exists.
- Source identity, generated artifacts, and release metadata agree.
- Working tree is clean except explicitly owned evidence artifacts.
- Block head is pushed and verified against the remote.
- The next block and the exact remaining build count are reported automatically.

## Standard production smoke

Every publication milestone runs, at minimum:

- Public root and health/readiness response.
- Exact deployed source/release/asset identity.
- Canonical Super Admin login and Total Control load.
- Ordinary tenant-scoped login and authorization boundary.
- Dashboard, navigation, search, language, theme, and session restoration.
- One representative create/read/update journey using controlled test records when the release changes writes.
- Desktop and exact 390 x 844 responsive pass on changed surfaces.
- Broken-image, horizontal-overflow, console-error, failed-request, and stale-asset checks.
- Data-count and schema-version comparison before/after deployment.
- Rollback command/receipt readiness without performing rollback unless required.

---

## Block 01 — Authoritative baseline and release inventory (Builds 001-005)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 001 | Freeze the starting truth: production source, GitHub heads, Replit receipt, visible version, database version, and installed Native identities. | One signed inventory has no inferred or substituted identities. |
| 002 | Reconcile canonical checkout, published source, active worktrees, and branch ancestry without merging or cleaning anything. | Every dirty or ancestry-unmerged worktree has an owner/status classification. |
| 003 | Inventory all release scripts, provider instructions, schema checks, rollback paths, and historical receipts. | One proven BIMLog release path is identified; stale alternatives are labeled non-authoritative. |
| 004 | Convert current audit findings into a machine-readable defect/risk ledger with severity, owner, dependency, and evidence link. | All S1-S3 findings map to a build or an explicit accepted limitation. |
| 005 | Establish the program branch, build ledger, block report template, and exact local/remote identity checks. | Full baseline checks pass; clean block head is pushed. |

**Block release:** push Build 005; no production publication.  
**Smoke:** read-only baseline smoke against unchanged P32 for comparison evidence.

## Block 02 — Dependency security and supply-chain hygiene (Builds 006-010)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 006 | Triage all 34 production dependency advisories by runtime reachability and exploitability. | Each advisory is fixed, mitigated with evidence, or retained with a bounded rationale. |
| 007 | Upgrade the highest-risk HTTP/upload/archive dependency paths without broad framework churn. | Upload, archive, routing, and malformed-input negative tests pass. |
| 008 | Upgrade image, temporary-file, form-data, and utility dependency paths. | File lifecycle, size limits, cleanup, and failure behavior pass. |
| 009 | Lock dependency provenance, package-manager version, integrity metadata, and forbidden-install checks. | Clean install is deterministic and secret/license scans pass. |
| 010 | Run complete security regression and close or explicitly document remaining advisories. | No unreviewed high-severity production advisory remains; block head is pushed. |

**Milestone M01 — Security baseline:** publish Build 010 through Replit and run the standard production smoke. Roll back if authentication, upload, reports, or startup regress.

## Block 03 — Release identity and version coherence (Builds 011-015)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 011 | Define one executable Platform/Native combined-version source of truth. | Platform label, API metadata, Native constants, package manifests, and tests derive from the same contract. |
| 012 | Replace stale P12 Lens release assertions with contract-driven identity tests. | Current-version positive and stale/mixed-version negative tests pass. |
| 013 | Expose immutable live source/release identity through authenticated diagnostics and safe health metadata. | Live identity can be proven without provider-console inference or secret disclosure. |
| 014 | Bind Replit publication receipt, Git commit, built asset manifest, and database migration level into one release receipt. | Any mismatch fails before publication and reports the exact field. |
| 015 | Reconcile historical release records and mark superseded identities without rewriting history. | Current release chain is singular, traceable, and block head is pushed. |

**Block release:** push Build 015; no production publication.

## Block 04 — Database migration, backup, restore, and startup safety (Builds 016-020)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 016 | Produce an exact production schema inventory and compare it with the 223-table/273-index/184-startup-table source contract. | Differences are classified; no hidden startup mutation remains. |
| 017 | Make the disposable `bimlog_rfi_test` fixture deterministic on Windows with correct UTF-8 identity and bounded cleanup. | Fixture creation, tests, and cleanup repeat twice without manual repair. |
| 018 | Prove every pending migration on a restored disposable database and detect DROP/rename/data-loss behavior. | Migration preview is additive or has an explicitly proven transformation and rollback. |
| 019 | Verify backup creation, restore, migration replay, startup serialization, and idempotent restart. | Restored database reaches the exact expected checksum and application readiness. |
| 020 | Consolidate the production migration operator and schema receipt into the proven publication procedure. | Clean release rehearsal passes; block head is pushed. |

**Milestone M02 — Release identity and database safety:** publish Build 020, apply only proven migrations, compare pre/post schema and counts, then run standard smoke plus restart/session restoration.

## Block 05 — Living Brief and current-state reconciliation (Builds 021-025)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 021 | Separate current truth from historical candidates in STATUS and OPEN_LOOP. | Published P32 and later program state are no longer labeled pushed-not-published. |
| 022 | Classify all 126 unchecked OPEN_LOOP entries as active, superseded, accepted limitation, or closed-with-evidence. | No unchecked item lacks disposition and evidence. |
| 023 | Update Platform, Plugin, Quality, and release documentation to match executable behavior. | Documentation links and architecture/freshness matrices pass. |
| 024 | Record Lens Next as the sole supported Lens product and Legacy Lens as migration-only. | No document describes both as parallel supported products. |
| 025 | Add automated contradiction checks for release state, version identity, provider path, and Lens product status. | Contradictory status text fails CI; block head is pushed. |

**Block release:** push Build 025; no production publication.

## Block 06 — Worktree and branch reconciliation (Builds 026-030)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 026 | Classify all 142 registered worktrees, the prunable entry, 18 dirty worktrees, and 61 ancestry-unmerged branches. | Each has keep/integrate/supersede/evidence-only/retire status without deletion. |
| 027 | Diff product-default and next-200 histories against published behavior. | Unique product changes are mapped to this program or proven superseded. |
| 028 | Reconcile dirty Lens, feedback, Native field, and prework branches by effective behavior. | Needed patches have clean candidate locations; generated evidence remains preserved. |
| 029 | Define recoverable cleanup manifests for obsolete worktrees and misplaced generated artifacts. | Exact targets and preservation destinations are reviewed; no broad recursive action exists. |
| 030 | Integrate only accepted non-overlapping corrections into the program lineage. | Full regression passes, lineage is clean, and block head is pushed. |

**Milestone M03 — Reconciled source authority:** publish Build 030 if it changes runtime behavior; otherwise record a documentation-only no-publish milestone and run identity/health smoke against unchanged production.

## Block 07 — Test harness and release-gate reliability (Builds 031-035)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 031 | Eliminate generated-bundle file-lock races and ensure natural test/build process termination. | Two consecutive full builds complete without manual process killing. |
| 032 | Move disposable proof roots into approved deterministic temporary locations. | Feedback and workflow proofs run without F-root permission improvisation. |
| 033 | Provision named empty workflow databases through one repeatable fixture command. | Delivery/economic HTTP proofs create, run, and remove fixtures safely. |
| 034 | Convert stable P0 security checks to blocking and classify the 65 P1 findings. | Blocking categories have zero findings; deferred P1s have owners. |
| 035 | Produce one full local release command and machine-readable gate receipt. | A clean candidate runs all required gates exactly once; block head is pushed. |

**Block release:** push Build 035; no production publication.

## Block 08 — Authentication, session continuity, and authorization (Builds 036-040)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 036 | Test canonical Super Admin, PMO/Finance, project administrator, member, and denied-user matrices. | Server-side decisions match visible navigation and direct-route behavior. |
| 037 | Verify login, logout, refresh, expiration, clean restoration, and multi-tab session continuity. | No valid cookie is overwritten by a stale response; two-tab tests are deterministic. |
| 038 | Verify Total Control, Living Brief, pricing, catalogs, workflows, and feedback route authority. | Super Admin passes; ordinary users receive correct bounded access or denial. |
| 039 | Repair tenant/company/project context switching and zero-project states without privilege leakage. | RRY zero-project context and global Super Admin scope are distinct and truthful. |
| 040 | Bind authenticated real-browser acceptance into the release gate. | Release fails on stale assets, wrong role, broken restoration, or old deployed identity; block head is pushed. |

**Milestone M04 — Identity and access:** publish Build 040 and run the standard smoke with canonical Super Admin plus one ordinary BIMCorp-scoped account and two-tab restoration.

## Block 09 — Global UX shell, accessibility, and responsive behavior (Builds 041-045)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 041 | Normalize page titles, one `h1`, landmarks, skip links, and focus order across all authenticated routes. | Automated accessibility structure passes on the audited route matrix. |
| 042 | Stabilize sidebar resize/collapse, utility controls, notification drawer, and content offsets. | Desktop and exact 390-width layouts have no overlap or horizontal overflow. |
| 043 | Normalize loading, empty, denied, offline, and error states without silent fallback. | Every major route shows an actionable truthful state. |
| 044 | Verify language ES/EN parity, theme persistence, reduced motion, keyboard navigation, and touch targets. | Changed surfaces pass bilingual and interaction matrices. |
| 045 | Complete a visual regression set for shell, dashboard, administration, and critical mobile routes. | Reviewed screenshots show no clipping, broken assets, or control misalignment; block head is pushed. |

**Block release:** push Build 045; no production publication.

## Block 10 — Company directory, catalogs, pricing, and Intake authority (Builds 046-050)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 046 | Reconcile canonical companies, aliases, clients, disciplines, services, phases, and PMO authority. | New selections use active canonical values while historical records remain unchanged. |
| 047 | Complete Company Pricing Templates with versioning, audit reason, publish state, and immutable historical use. | Draft/publish/supersede and unauthorized negative tests pass. |
| 048 | Verify Delivery Workflow templates and governance policy across default and company-owned definitions. | Only authorized reusable definitions reach project Intake. |
| 049 | Complete Job Intake persistence from customer and convention through contract, APU, budget, EDT, staffing, and activation. | Refresh/reopen reproduces the exact saved draft and activated project state. |
| 050 | Run Lorena PMO/Finance and Super Admin end-to-end acceptance on controlled data. | Catalog-to-Intake journey passes with correct role boundaries; block head is pushed. |

**Milestone M05 — Company setup and Intake:** publish Build 050 and run standard smoke plus controlled company-template and Job Intake create/reopen/activate verification.

## Block 11 — APU, budget, and financial correctness (Builds 051-055)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 051 | Lock unit price, quantity, total, currency, tax, overhead, contingency, and rounding semantics. | Golden financial vectors pass across input, persistence, display, and export. |
| 052 | Permanently regress the historical whole-plan-price/unit-rate mapping defect. | A fresh project cannot reproduce the invalid $480,000 outcome; preserved evidence is unchanged. |
| 053 | Verify APU components, direct-production allocation, phase totals, and budget reconciliation. | Component and roll-up totals reconcile exactly with explicit rounding rules. |
| 054 | Verify revision, approval, supersession, and audit history without silent recalculation. | Before/after state and approving authority are immutable and readable. |
| 055 | Run controlled finance role and export acceptance. | PMO/Finance and denied-role matrices pass; block head is pushed. |

**Block release:** push Build 055; no production publication.

## Block 12 — Project activation and Operations lifecycle (Builds 056-060)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 056 | Reconcile activated Intake identity with Operations project, EDT, budget, staffing, and customer records. | One canonical project identity exists across modules. |
| 057 | Complete task/work-package status, ownership, dates, dependencies, and progress persistence. | Refresh/reopen and concurrent-edit tests preserve authoritative state. |
| 058 | Complete cost/progress/change linkage and prevent duplicate financial authority. | Operations references canonical financial records rather than copying them. |
| 059 | Verify command center, activity, team, controls, and analytics projections from canonical data. | Counters and summaries match source records with no stale cache. |
| 060 | Run full Intake-to-Operations acceptance on a fresh controlled project. | Creation, activation, work update, reporting, and audit pass; block head is pushed. |

**Milestone M06 — Financial and operational core:** publish Build 060 and run standard smoke plus one complete Intake/APU/activation/Operations journey and pre/post data reconciliation.

## Block 13 — Coordination records and construction workflows (Builds 061-065)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 061 | Reconcile clash/issue, RFI, submittal, transmittal, meeting, schedule, and change-order identities. | Cross-links resolve to one authoritative record without duplicate state. |
| 062 | Complete lifecycle transitions, reopen/revise/void behavior, reasons, and audit history. | Allowed and denied transition matrices pass. |
| 063 | Verify attachments, reference links, comments, responsible company, and notification triggers. | Evidence remains bound to the exact record/version. |
| 064 | Complete project-level filters, search, pagination, saved view state, and PDF/CSV exports. | Visible filters and exported content match exactly. |
| 065 | Run a multi-record coordination scenario from issue through formal response and closure. | All records, links, actors, times, and exports are traceable; block head is pushed. |

**Block release:** push Build 065; no production publication.

## Block 14 — Lens Next Platform sole-product completion (Builds 066-070)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 066 | Reconcile dirty Lens mockup work against the published Platform and current API contracts. | Only reviewed project/model-bound behavior enters the program lineage. |
| 067 | Inventory every Original/Legacy Lens route, label, API, migration dependency, and installer reference. | Runtime support and migration-only compatibility are mechanically distinguishable. |
| 068 | Complete Lens Next issue list/detail, grouping, filters, screenshots, attachments, RFI/Submittal links, and truthful 3D states. | Desktop/mobile/keyboard/accessibility and negative-state tests pass. |
| 069 | Complete Lens Next create, sync, reconcile, Working View request, stale-response, and conflict behavior. | Exact identity, idempotency, and rollback tests pass. |
| 070 | Remove legacy customer navigation/branding and expose one coherent Lens Next workspace. | No live Platform surface presents Original/Legacy Lens as a supported product; block head is pushed. |

**Milestone M07 — Coordination and Lens Next Platform:** publish Build 070 and run standard smoke plus authenticated Lens Next issue creation/linking/reconciliation against controlled project/model bindings. Native field acceptance remains separate.

## Block 15 — Lens Next Native, installer, and Legacy Lens retirement (Builds 071-075)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 071 | Reconcile Native N18/P33 identity with the published Platform version contract. | 2021/2025 source, DLL metadata, manifests, ZIPs, and Platform compatibility agree. |
| 072 | Consolidate dual-year source and produce deterministic 2021 and 2025 packages. | Clean rebuilds reproduce exact hashes and package-only installer checks pass. |
| 073 | Implement controlled historical Original Lens migration into Lens Next without deleting Saved Viewpoints or BIMLog records. | Exact identity migrates once; missing/ambiguous/tampered cases fail closed. |
| 074 | Build the verified upgrade installer: preserve external rollback evidence, remove `BIMLog.bundle`, remove manifest-bearing rollback bundles from Autodesk's load root, and install only Lens Next. | Clean install and upgrade simulation show one Lens Next ribbon/panel/loader per Navisworks year. |
| 075 | Run real Navisworks 2021/2025 acceptance: create, camera, sectioning, Working View, XML, save/reopen, migration, and duplicate-loader scan. | Both years pass on controlled model copies; Ruben field checklist and exact package hashes are preserved; block head is pushed. |

**Native milestone N01:** push Build 075, package both years, install only through the verified installer on the controlled workstation, and run real-model smoke. Do not publish a new web runtime solely for packaging unless Platform compatibility changed.

## Block 16 — Feedback, notifications, and delivery (Builds 076-080)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 076 | Finish durable feedback capture, readback, assignment, state transition, evidence, and restore proof. | Customer and reviewer workflows survive restart and restore. |
| 077 | Make `/feedback` composer and `/admin/feedback` review semantics explicit in routing, Help, and tests. | Deep links open the intended surface for each role. |
| 078 | Verify Notification Center preferences, quiet hours, digest frequency, unread state, and revocation. | Delivery decisions are deterministic and auditable. |
| 079 | Verify email/Telegram document-delivery contracts, idempotency, safe failure, and protected recipient binding without sending unrequested messages. | Dry-run and controlled authorized delivery evidence distinguish provider receipt from human visibility. |
| 080 | Run feedback-to-resolution and notification acceptance in production-safe controlled records. | End-to-end state, evidence, and user visibility pass; block head is pushed. |

**Milestone M08 — Native compatibility and communications:** publish Build 080, run standard web smoke, then verify installed Lens Next remains compatible and Legacy Lens has not returned to the load path.

## Block 17 — Files, reports, exports, and handover quality (Builds 081-085)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 081 | Complete governed arbitrary-file download or remove the unsupported HTTP 501 promise from customer surfaces. | Supported files download safely; unsupported types show truthful guidance. |
| 082 | Reconcile upload scanning, metadata, links, retention, authorization, and content-disposition behavior. | Malicious/oversized/cross-project cases fail safely. |
| 083 | Normalize PDF/report generation through shared helpers with native document fidelity. | Representative reports render, paginate, and preserve attachments correctly. |
| 084 | Complete CSV/XML/ZIP exports, manifests, hashes, and re-import or handover readability. | Exported artifacts match visible filters and validate independently. |
| 085 | Build and inspect one complete owner handover package from controlled project records. | Package is legible, traceable, portable, and hash-verifiable; block head is pushed. |

**Block release:** push Build 085; no production publication.

## Block 18 — External integrations and reconciliation (Builds 086-090)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 086 | Verify Procore RFI import/return, cursor/replay, conflict, and attachment behavior. | Idempotent replay and rollback tests pass against controlled fixtures. |
| 087 | Verify SharePoint discovery/linking without duplicate file authority. | BIMLog references canonical external files and preserves provenance. |
| 088 | Verify Outlook/email intake, threading, attachment custody, and bounded failure states. | Messages map once to authorized project records with no cross-tenant leakage. |
| 089 | Verify Google Drive/Dropbox and documented connectors, revocation, expired credentials, and customer-safe errors. | Connector matrix shows truthful supported/unsupported state. |
| 090 | Run an integration outage/recovery and duplicate-replay acceptance scenario. | Recovery is idempotent, auditable, and does not invent success; block head is pushed. |

**Milestone M09 — Documents and integrations:** publish Build 090 and run standard smoke plus file/report/export and controlled connector reconciliation tests.

## Block 19 — AI assistance and controlled automation (Builds 091-095)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 091 | Inventory every AI entry point, model/provider, source context, credit/cost display, and stored output. | Silent or ungoverned AI invocation is absent. |
| 092 | Harden prompt/source boundaries, tenant isolation, refusal, timeout, and provider-error behavior. | Injection, cross-project, unavailable-provider, and malformed-output tests pass. |
| 093 | Make AI drafts editable, attributable, auditable, and clearly non-authoritative. | No AI output silently issues, approves, certifies, or changes project state. |
| 094 | Reconcile Briefing IA, Concierge/coming-later labels, and implemented capability truth. | Customer UI advertises only working capability. |
| 095 | Run controlled AI assistance acceptance with cost, provenance, edit, reject, and audit evidence. | Human authority remains explicit; block head is pushed. |

**Block release:** push Build 095; no production publication.

## Block 20 — Performance, observability, and resilience (Builds 096-100)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 096 | Profile cold startup, API latency, route assets, Lens payloads, and report generation. | Budgets and the existing eight-second startup requirement are measured and enforced. |
| 097 | Remove avoidable blocking work, duplicate fetches, oversized bundles, and cache incoherence. | Performance improves without stale-state or authorization regression. |
| 098 | Add safe structured logs, correlation IDs, health diagnostics, and redaction. | Failures are diagnosable without exposing credentials or customer content. |
| 099 | Test process restart, provider interruption, database reconnect, partial request failure, and browser resume. | Service recovers without data duplication or invalid session overwrite. |
| 100 | Run load, resilience, and rollback-readiness acceptance on the exact candidate. | Budgets and recovery objectives pass; block head is pushed. |

**Milestone M10 — AI and resilience:** publish Build 100 and run standard smoke plus cold-start, restart, multi-tab, degraded-provider, and performance verification.

## Block 21 — Public site, onboarding, Help, and commercial truth (Builds 101-105)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 101 | Reconcile homepage/features/pricing claims with implemented and accepted capabilities. | No roadmap item is presented as live fact. |
| 102 | Complete signup, invitation, onboarding, empty-state, and first-project guidance. | New controlled tenant reaches a useful first project without hidden administrator repair. |
| 103 | Update Help/manual content for roles, workflows, Lens Next-only setup, integrations, and recovery. | Every critical workflow has accurate in-product guidance. |
| 104 | Resolve Mac installer and meeting-recording promises as implemented, scheduled, or removed from active UI. | No unsupported action appears available. |
| 105 | Run public-to-authenticated onboarding and support discoverability acceptance. | Public, signup, login, Help, and first-use flow pass; block head is pushed. |

**Block release:** push Build 105; no production publication.

## Block 22 — Security, privacy, retention, and disaster recovery (Builds 106-110)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 106 | Run tenant/project object-authorization review across API, files, reports, Lens, feedback, and integrations. | Cross-tenant and guessed-ID negative tests pass. |
| 107 | Verify secrets, cookies, headers, CSP, CORS, rate limits, upload boundaries, and audit-log redaction. | Security configuration matches production and exposes no protected value. |
| 108 | Define and test retention, export, correction, archive, and deletion boundaries without erasing immutable evidence. | Each data class has a verified lifecycle and authority. |
| 109 | Execute provider/database restore rehearsal and application rollback rehearsal on isolated copies. | Exact recovery point, time, checksums, and post-restore login are proven. |
| 110 | Perform final independent security/privacy/recovery review of the release candidate. | No unresolved P0/P1 release blocker remains; block head is pushed. |

**Milestone M11 — Commercial and security readiness:** publish Build 110 and run standard smoke plus onboarding, authorization-negative, restore-readiness, and security-header checks.

## Block 23 — Full-system acceptance and defect burn-down (Builds 111-115)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 111 | Run the complete automated suite from clean install against the exact candidate. | All required suites pass with no unexplained skip, retry, or stale fixture. |
| 112 | Run the complete authenticated desktop route matrix and changed-action smoke in visible Chrome. | No broken route, asset, request, console error, or stale release identity exists. |
| 113 | Run exact mobile/tablet/desktop visual, accessibility, keyboard, language, and theme acceptance. | Critical surfaces pass reviewed viewport evidence. |
| 114 | Run complete Navisworks 2021/2025 Lens Next field acceptance and legacy-absence scan. | Only Lens Next loads; historical migration and normal workflows pass. |
| 115 | Burn down all release-blocking findings and reconcile residual limitations into truthful product documentation. | Release candidate has zero open P0/P1 and block head is pushed. |

**Block release:** push Build 115; no production publication. Freeze candidate scope except fixes required by final acceptance.

## Block 24 — Final release, live acceptance, and durable handoff (Builds 116-120)

| Build | Deliverable | Acceptance |
|---:|---|---|
| 116 | Create final release manifest, artifact hashes, migration/rollback plan, and pre-deployment data comparison. | Candidate, remote, Replit workspace, Native packages, and evidence are exact. |
| 117 | Publish the final web candidate through the proven Replit procedure and capture the provider receipt. | Production serves the exact candidate; schema/data effects equal the approved plan. |
| 118 | Run full live Super Admin, ordinary user, session, critical workflow, responsive, and console smoke. | Standard production smoke and changed-feature smoke pass. |
| 119 | Run final connected Navisworks/customer acceptance and verify clean Lens Next-only installations. | 2021/2025 field evidence and Ruben acceptance are recorded without Legacy Lens loaders. |
| 120 | Reconcile Living Brief, build ledger, open limitations, support/rollback instructions, and remaining roadmap. | GitHub/Replit/live/package identities match, repositories are clean, and final handoff is complete. |

**Milestone M12 — Final stabilized release:** Build 120 closes only after web publication, full live Chrome smoke, dual-year Navisworks field proof, exact identity reconciliation, rollback readiness, and durable handoff all pass.

---

## Push, publication, and smoke milestone map

| Milestone | Builds | Push | Production publication | Required live acceptance |
|---|---:|---|---|---|
| Baseline B01 | 001-005 | Build 005 | No | Read-only comparison smoke |
| M01 | 006-010 | Build 010 | Yes | Security/startup/auth/upload smoke |
| B03 | 011-015 | Build 015 | No | Local/remote identity verification |
| M02 | 016-020 | Build 020 | Yes | Migration, schema, restart, session smoke |
| B05 | 021-025 | Build 025 | No | Documentation/contract checks |
| M03 | 026-030 | Build 030 | Conditional on runtime change | Identity/health or full standard smoke |
| B07 | 031-035 | Build 035 | No | Release-harness rehearsal |
| M04 | 036-040 | Build 040 | Yes | Super Admin, scoped user, two-tab/session smoke |
| B09 | 041-045 | Build 045 | No | Visual/accessibility candidate review |
| M05 | 046-050 | Build 050 | Yes | Catalog, pricing, Intake acceptance |
| B11 | 051-055 | Build 055 | No | Financial golden-vector acceptance |
| M06 | 056-060 | Build 060 | Yes | Intake-to-Operations full journey |
| B13 | 061-065 | Build 065 | No | Coordination workflow candidate smoke |
| M07 | 066-070 | Build 070 | Yes | Lens Next Platform live acceptance |
| N01 | 071-075 | Build 075 | Native package/install milestone | Dual-year Navisworks and Legacy Lens removal |
| M08 | 076-080 | Build 080 | Yes | Feedback, notifications, Lens compatibility |
| B17 | 081-085 | Build 085 | No | Artifact/report/handover inspection |
| M09 | 086-090 | Build 090 | Yes | Files, reports, exports, integrations |
| B19 | 091-095 | Build 095 | No | AI authority/provenance acceptance |
| M10 | 096-100 | Build 100 | Yes | Performance, restart, resilience smoke |
| B21 | 101-105 | Build 105 | No | Public/onboarding candidate acceptance |
| M11 | 106-110 | Build 110 | Yes | Security, onboarding, recovery readiness |
| B23 | 111-115 | Build 115 | No | Frozen full-system release candidate |
| M12 | 116-120 | Builds 116 and 120 receipts | Yes, final | Full web, data, dual-year Native, and customer acceptance |

## Program completion definition

The program is complete only when:

- Builds 001-120 have evidence-backed outcomes; no number is merely declared complete.
- All 24 block heads are pushed and remote-matched.
- All 12 named production milestones have exact receipts or an explicit documented no-publication reason where conditional.
- Production identity, GitHub head, Replit workspace, asset manifest, schema level, and Native compatibility agree.
- Canonical Super Admin and ordinary-role live acceptance pass.
- Lens Next is the only supported and installed Lens plugin in the accepted setup; Original/Legacy Lens remains only as preserved historical migration evidence outside runtime load paths.
- Navisworks 2021 and 2025 real-model acceptance passes.
- No unresolved P0/P1 security, data-loss, authorization, release-identity, or startup blocker remains.
- Living Brief and build ledger state match actual deployed and accepted reality.
- Final status automatically reports completed program, current live state, remaining builds `0`, next roadmap item, authorization state, blockers `NONE`, and exact rollback/support references.
