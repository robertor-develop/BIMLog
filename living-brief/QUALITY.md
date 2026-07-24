# QUALITY.md - BIMLog Quality 4.0 Doctrine

This document translates the Calidad 4.0 source material into BIMLog's build doctrine.
The original PDFs are Spanish scanned source documents; this Living Brief entry is the
English operational version for BIMLog, IgniteSmart, BIMCapital, and all AI development
partners.

[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md) is the permanent product-doctrine authority
beneath Roberto's explicit current instruction and owns BIMLog's permanent product laws. This
document owns operational Quality 4.0 acceptance requirements and evidence outcomes. Verified
standards titles, editions, applicability, evidence expectations, and claim restrictions belong
only in [STANDARDS_REGISTER.md](./STANDARDS_REGISTER.md).

## Source
- Calidad 4.0 Part 1.pdf: 120 scanned pages.
- Calidad 4.0 Part 2.pdf: 36 scanned pages.
- OCR extraction completed page by page on July 8, 2026.
- Local OCR text lives in:
  `C:\Users\soporte\Desktop\BIMLog Version 1.60.6\_extracted`.

## Core Interpretation
Calidad 4.0 is not a separate theory from BIMLog. It is the operating philosophy behind
how BIMLog should be built.

The central idea is that quality has evolved from inspection, to assurance, to total
quality, and now to connected digital quality. In Quality 4.0, quality is not a department
and not a final report. It is a live system of people, process, data, technology, ethics,
and continuous improvement.

For BIMLog, that means every module must do more than store records. Every module must
help the user make better decisions with clean, traceable, connected, exportable, and
auditable construction data.

## BIMLog Quality Law
BIMLog must stay spreadsheet-simple for field users while quietly producing data that is
twin-ready, audit-ready, report-ready, and AI-ready.

This is an operational quality requirement under the permanent product laws in
[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md), not a replacement authority.

Every feature must answer:
- What is the record?
- Where is it in the project?
- Who owns it?
- Who is responsible?
- What changed?
- Why did it change?
- When did it happen?
- What is the current state?
- What proof is attached?
- What decision should happen next?

If a feature cannot answer those questions, it is not finished.

## Human First, Digital Second
The Calidad 4.0 material is clear: technology amplifies quality but does not replace human
judgment. AI, sensors, dashboards, blockchain, digital twins, and automation only create
value when they support responsible decisions.

BIMLog must therefore:
- Keep users in control of final decisions.
- Show sources and evidence behind AI assistance.
- Separate low-cost text assistance from expensive file-reading AI.
- Warn users before consuming AI credits.
- Keep every automated action auditable.
- Avoid silent fallbacks that make the system look correct when it failed.
- Design workflows that reduce confusion for real users like Ruben, not just impress in demos.

## Data as the Raw Material of Quality
Calidad 4.0 treats data as the raw material of improvement. BIMLog must treat project data
the same way.

Required BIMLog behavior:
- Data must be structured at entry, not cleaned only at export.
- Reports, PDFs, Excel, dashboards, and AI must all read the same source records.
- UI fields must use human labels, never raw database names.
- Imports must normalize data into reusable project structures.
- Exports must be client-ready without manual cleanup.
- History must be scoped, understandable, and useful, not dirty noise.
- Deleted test data must not contaminate real reports.
- Lineage must be preserved whenever an item is edited, reassigned, voided, resolved, or superseded.

## Traceability and Auditability
The source material repeatedly connects Quality 4.0 with traceability, transparency,
cybersecurity, ethics, and reliable evidence.

BIMLog must make traceability visible:
- RFIs need custody, sent status, responses, attachments, linked records, and final resolution.
- Submittals need submitted by, submitted to, responsible company, ball in court, due dates,
  product data, attachments, review responses, revision history, and exportable logs.
- Lens viewpoints need active state, revision, supersedes/superseded-by, group, floor, trade,
  report type, responsible company, and Navisworks sync state.
- Schedule items need source type, due date, responsible party, status, and source record link.
- Every PDF must fingerprint the data snapshot.
- Every material change must leave an activity trail.

Traceability should not make the UI heavy. The main table should stay clean; deep evidence
belongs in details, history, reports, and audit panels.

## Interoperability
Calidad 4.0 emphasizes that systems create real value only when they talk to each other.
BIMLog must avoid isolated tabs.

Required interconnections:
- RFI, submittal, transmittal, change order, schedule, files, directory, clash reports, and
  Lens viewpoints must be linkable.
- Schedule should pull live due dates from RFIs and submittals instead of requiring duplicate entry.
- Submittal Tracker should be a live view inside Submittals, not a disconnected product.
- Navisworks plugin data and platform data must share the same display contract.
- Responsible company/contact should reuse the project directory.
- Files and attachments should belong to the same record graph used by reports and AI.

## Predictive and Preventive Quality
Calidad 4.0 moves quality from reactive inspection to predictive prevention. BIMLog should
move in that direction module by module.

Near-term examples:
- Flag missing due dates, missing companies, missing attachments, and unresolved ball-in-court.
- Detect stale RFIs and overdue submittals.
- Warn when a report is about to include superseded, voided, or dirty test history.
- Detect viewpoint chain inconsistencies before PDF export.
- Show schedule pressure by floor, trade, company, and week.
- Identify repeated responsible-company issues.

Long-term examples:
- Predict which RFIs and submittals are likely to become delays.
- Score contractor response performance.
- Recommend coordination meeting agenda items.
- Generate project CEO briefings from live project data.
- Feed owner handover and digital twin operations from verified construction records.

## Digital Twin Direction
The source material discusses digital twins, IoT, simulation, augmented reality, blockchain,
and integrated data ecosystems. BIMLog's path is practical: build the verified construction
record first, then expand into owner operations.

BIMLog should become the construction memory layer:
- Viewpoints, clashes, RFIs, submittals, files, photos, reports, companies, contacts, floors,
  trades, systems, costs, dates, and decisions become the evidence graph.
- That evidence graph becomes the foundation for owner handover.
- Owner handover becomes the foundation for digital twins, portfolio dashboards, facilities
  intelligence, energy, IoT, GIS, legal evidence, and asset lifecycle management.

This is how BIGDOTS becomes practical inside BIMLog: BIM 4D through 10D+ is not a slogan;
it is a connected decision system built from trustworthy records.

## Blockchain / Immutable Evidence Direction
Calidad 4.0 treats blockchain and distributed ledgers as tools for trust and traceability,
not as decoration.

BIMLog should not rush blockchain features. First, the platform must produce clean,
consistent, auditable records. Later, high-value events can be fingerprinted or anchored:
- report snapshots,
- dispute evidence,
- signed approvals,
- handover packages,
- compliance certificates,
- payment milestones,
- public-sector transparency records.

The immediate rule is simple: every important record must be hashable, reproducible, and
explainable before it can ever be anchored externally.

## AI Quality Rules
AI must be used as a controlled quality assistant, not as a magic black box.

Rules:
- AI suggestions must be optional unless explicitly approved by product design.
- AI usage must be logged by user, project, feature, billing mode, and credit unit.
- Super admin must see AI cost and usage across all users.
- Users should see their own AI usage and know when a feature may consume credits.
- Cheap text assistance and expensive file reading must be separate buttons.
- AI-generated text must be editable before save.
- AI must never hide missing data, failed uploads, failed imports, or uncertain matches.
- AI outputs must preserve source links when possible.

## User Experience Quality
Quality 4.0 fails if users cannot operate the system. BIMLog must be professional,
predictable, and self-explaining.

Each workflow should have:
- obvious primary action,
- clear back/navigation path,
- editable record details,
- attachments where users naturally expect them,
- linked records where decisions depend on other modules,
- client-ready PDF and Excel exports,
- guidance that can be turned on/off,
- no duplicate counters,
- no misleading success messages,
- no disconnected "views" that only look at data but cannot act on it.

If a screen only displays data and the user cannot understand what to do next, it is not a
finished screen.

## Implementation Method
Use this sequence for every meaningful feature:
1. Define the real field workflow.
2. Define the structured data contract.
3. Define the current state and history model.
4. Define the required links to other modules.
5. Define the PDF and Excel output.
6. Define the user guidance and error states.
7. Define the audit/activity events.
8. Define the AI assist option, if useful.
9. Build in small verified steps.
10. Run tests, mojibake scan, build, and targeted UI review.

## Quality 4.0 Build Checklist
Before calling a feature done, verify:
- It works from empty state.
- It works with real imported data.
- It works after browser refresh.
- It works after publish/rebuild.
- It has no mock data.
- It fails loudly on real errors.
- It has professional empty states.
- It has edit, delete/void/close, and history where the workflow requires them.
- It has PDF output if the module is reportable.
- It has Excel output if users will manage tabular work.
- It respects filters in exports.
- It logs activity.
- It links to related modules.
- It has clean UTF-8 text.
- It passes `pnpm run check:mojibake`.
- It passes `pnpm run check:living-brief` when Living Brief governance is in scope; the root
  production build enforces both checks before typecheck and package builds.
- It does not create duplicate, contradictory counters.
- It does not create dirty historical report data.

## Evidence and Release Quality Gate

### Capability quality gate

Capability assumptions require evidence. Before Git, publish, deployment, production schema, external notification,
administrator, GUI, or protected-filesystem work, record tested capability and the operator-only split. Review fails
if a known `.git`-write restriction is discovered only after paid work, an isolated background copy is asked to change
main history, or empty/noise commits are postponed to a cleanup commit. User-run Git commands require verified
ancestry/state, authorized scope, backup/rollback, and discard-risk review. Acceptance evidence identifies every
platform-blocked and manually performed operation.

Expected migration inventories are derived from the complete latest-master schema and compared read-only with the
actual target immediately before approval. A carried-forward numeric expectation is not an authority; fresh evidence
must correct it when incomplete. Approval uses the exact final preview and classifies every create/alter/drop,
constraint/index action, conversion, copy, and data write. Candidate `9297740` demonstrates the rule: 12 additive
creates are pending, including `living_brief_documents`; this observation is not proof they were deployed.

Publish supply-chain acceptance uses the actual publish firewall/policy and the entire frozen transitive lockfile,
not a development-only install. It covers all workspaces and optional packaging/build chains, proves the prohibited
version has zero resolutions, proves the bounded replacement satisfies every dependent range, and runs a frozen clean
install plus affected builds. Security diffs are exact-file reviewed; broad `commit -am` and identical blocked retries
fail the gate. Runtime, development, packaging, and optional-tooling provenance remain explicit.

Automatic Replit checkpoints are never accepted by existence. Review records status, HEAD/origin, last-commit stat,
and effective diff. A large lockfile delta must prove semantic changes for importers, versions, integrities, optional
dependencies, and resolution paths using the pinned package-manager version. Required supply-chain evidence includes
the exact override diff; lockfile semantic delta; zero blocked-version count; replacement resolution count; dependency
path/range compatibility; frozen clean install; supported Electron/sync-agent build; API/frontend builds; and security
scan. Broad checkpoint churn is replaced before push, not followed by a cleanup commit.

Tool ownership is a quality control. Controlled local worktrees own edits, dependency resolution, evidence, review,
commits, integration, and push. Replit owns verified pull, actual preview, explicitly approved publish, runtime
verification, authorized read-only diagnostics, and terminal deployment reporting. A publish-only failure that needs
source change returns to local review; Replit does not improvise the correction. Exceptions require Roberto's scoped
approval after capability preflight.

`pnpm-workspace.yaml` is the canonical override/exclusion authority. Override review proves the entire previous set
survives and the semantic lockfile delta is limited to the intended dependency path. A fix is rejected if it removes
the blocked version while adding unrelated packages, changing importers/resolutions, restoring excluded platform
binaries, or weakening other controls. Tar remediation specifically requires zero dropped controls and a tar-only
delta plus frozen install/package/build proof.

### Defensive security quality gate

Security work is quality work only when it stays authorized, defensive, bounded, and local to BIMLog-owned code or
disposable fixtures. The default proof pattern is source review plus finite below-limit and just-above-limit tests,
not exploit reproduction, unbounded payloads, resource-exhaustion benchmarking, external targets, credential-theft
flows, persistence/evasion behavior, destructive behavior, production data, or customer systems. If an automated
safety notice interrupts output, the correct response is to stop repeating or circumventing that specific blocked
request/output, preserve the candidate, rephrase toward bounded defensive application-quality verification, and
continue other safe engineering steps. Repeated retries, circumvention, model shopping, duplicate tasks, and unchanged
expensive reruns are quality failures.

Security candidates remain separate from pending Living Brief corrections. A security build may fail the semantic
impact gate because an owning Living Brief candidate has stale declarations; that does not justify fabricating impact
records or weakening the gate. Preserve the security candidate, accept the governing Living Brief correction first,
then rebase/reapply and declare only the security candidate's effective changed paths and genuinely affected
authorities. Sanitized summaries and notifications omit exploit instructions, vulnerability internals, sensitive
architecture, repository metadata, secrets, credentials, customer data, and private billing information.

### Terminal-turn notification gate

Every assigned work cycle that stops must produce exactly one structured Telegram terminal-turn notification before
the final response or idle state. The alert means Roberto should return to the computer and review the task; it does
not by itself mean the overall build is complete. Quality review fails silent terminal stops, duplicate EventIds for
the same stopped cycle, Completed status on anything short of genuine completion, unsanitized summaries, periodic
noise during active work, or a final report that omits provider acknowledgement/message ID or the exact delivery
blocker. Future orchestration directives include this rule explicitly.

### Temporary credential continuity gate

Roberto-approved working integration credentials are temporarily preserved as operational continuity, not as launch
architecture. During this exception, quality review fails any task that rotates, revokes, deletes, replaces, relocates,
regenerates, invalidates, prints, copies, quotes, transmits, tests, or changes the provider/callback/authentication
behavior for those credentials without fresh explicit Roberto approval. A build may not require Roberto to re-enter
them. Evidence remains value-blind.

The exception does not protect a known exposed literal in tracked configuration. Quality fails any candidate that
retains or introduces credential-bearing database URLs or literal secret-like assignments in explicitly recognized
tracked configuration. Removal stays value-blind, runtime values come from governed environment/secret injection, and
replacement/revocation remains a separately approved operator action with health and session-impact proof.

Before public/production launch, the exception is a mandatory blocker. Launch hardening requires a separately approved
managed-secret migration, durable backup/recovery, controlled rotation/revocation as appropriate, callback continuity,
rollback proof, history remediation, and independent verification. This continuity rule is separate from and does not
weaken the Living Brief gate-password durability correction.

Living Brief gate-password durability includes non-circular recovery. Quality fails any reset path that requires a
brief-access token when the stated purpose is locked-out Super Administrator recovery. The safe recovery contract is
ordinary app authentication plus transaction-time Super Administrator revalidation, current BIMLog account password,
exact confirmation, bounded reason, rate limit, stale observed-version protection that does not grant document access,
locking, atomic update/version increment, durable audit, rollback, and prior-session invalidation.

### Built-asset lifecycle quality gate

Lifecycle-roadmap work is documentation strategy until implemented evidence exists. Quality review fails any claim
that BIMLog already provides asset passports, owner operations, IoT/BMS/CMMS integration, work dispatch, marketplace
matching, executable contracts, payment settlement, material passports, carbon accounting, recycling verification, or
asset-management-system conformity unless a named source scope, implementation, evidence, and acceptance record prove
it.

Future asset passports must preserve lifecycle-data provenance: canonical model/location identity, approved
product/submittal links, commissioning evidence, warranties, SLAs, responsible parties, condition events, work
history, replacement/deconstruction/recovery evidence, author, source, timestamp, confidence, and change history.
Imported owner/operator/IoT/contractor data must be source-labeled and reconciled; it cannot silently overwrite the
verified construction record.

IoT, BMS, CMMS, ERP, and marketplace integrations are safety- and trust-sensitive. Initial connectors ingest and
normalize events only. Direct equipment control, safety-critical action, contractor dispatch, spend commitment,
legal notice, warranty claim, payment eligibility, or settlement requires explicit human approval, authorization,
rollback behavior, idempotency, rate limiting, audit, privacy review, and field evidence. AI may recommend and
explain but may not become contractual authority.

Executable-rule quality requires deterministic inputs, versioned rules, replayable outcomes, exception states,
human approval thresholds, conflict handling, and audit evidence. Blockchain/distributed-ledger anchoring is optional
future infrastructure only after a multi-party trust requirement is proven; it is not a shortcut around permissions,
privacy, rollback, or human authority.

Marketplace and circular-economy quality require neutral eligibility, qualification, insurance/license evidence,
geography, availability, lead time, contract price, conflict checks, chain-of-custody, certificates, and proof for
waste diversion, recovered value, and carbon avoided. No unverified supplier, contractor, recycler, salvage, carbon,
or compliance claim may be shown as accepted truth.

North-star metric quality requires exact non-overlapping definitions, source system, owner, update cadence, and
anti-double-count rules. Governed project value, asset value under management, O&M spend orchestrated, recovered
value, avoided downtime, and BIMLog revenue are separate measures. Scenario percentages, take rates, and market
figures remain hypotheses until supported by sourced data, customer discovery, unit economics, and acceptance.

Organizational excellence and adoption quality requires a layered evidence model for lifecycle pilots and releases.
EFQM-style questions test organization direction, execution, stakeholder value, and results alignment; PHVA/PDCA tests
whether the change was planned, tried, checked with evidence, standardized or corrected, and repeated; ADKAR tests
individual adoption through Awareness, Desire, Knowledge, Ability, and Reinforcement; ASQ-recognized practices inform
rigorous measurement, analysis, root-cause/corrective action, and evidence discipline; BIMLog canonical records preserve
traceability for every decision, change, adoption result, and improvement outcome. A shipped feature with failed user
adoption is not a successful lifecycle release until adoption evidence, corrective action, and reinforcement are
recorded.

### Immediate versus acceptance-time semantic evidence

An immediate-category finding is part of the quality correction itself, not later documentation cleanup. Customer
regressions, repeated/systemic failures, protected baselines, release/data hazards, security/privacy/tenancy/control
findings, repeated permanent instructions, builder-workflow corrections, and field evidence contradicting automation
must be captured or explicitly reviewed in the same chain. The gate rejects an immediate finding labeled as a
deferred minor note. Only small isolated feature detail with no immediate category may wait until the normal
Ready/acceptance boundary, where its semantic declaration is still mandatory before acceptance/push.

### Current cross-cutting acceptance controls

- Database migrations are additive, idempotent, restart-safe, and transactionally tested. Replit publish
  previews must be complete and commit-bound, with zero destructive SQL; unexpected drop, rebuild, rename,
  RLS disable, constraint/index removal, source divergence, or truncated evidence blocks publish. Replit source
  must equal freshly fetched authoritative `master` before guarded Helium sync. A non-empty preview contains only
  explicitly inventoried additive statements tied to the accepted source contract. Future schema publication also
  requires a verified restore point plus exact pre/post affected-table record-count manifests.
- Durable credentials and other security authorities are never reseeded by build, startup, restart, publish,
  source-mirror synchronization, or migration. Initialization is create-if-absent only through a controlled
  authenticated bootstrap or one-time migration of existing durable state. Reset requires current Super
  Administrator revalidation, bounded input, explicit reason/confirmation, rate limiting, audit history,
  session invalidation, and authorization proof that ordinary, Project Admin, and Company Admin users are denied.
  Missing durable credential state fails closed without a hardcoded/default password fallback.
- Financial values use exact decimals and explicit currencies. Authorization, tenancy, maker/checker
  separation, idempotency, concurrency, rollback, and immutable approved history are tested at database and API.
- Desktop and 390px mobile workflows are bilingual, readable, free of page overflow, browser exceptions, and
  failed requests. Provider execution is never fabricated; fixtures are labeled and real delivery requires a
  real provider acknowledgement.
- Attachments preserve original bytes, visibility/replacement/crop intent, custody, and privacy. Exports and APIs
  do not disclose storage paths, signed URLs, credentials, or unrelated content.
- Relationships point to canonical records and preserve needed historical snapshots; they do not create competing
  RFI, Submittal, Clash, Schedule, Meeting, financial, or notification authorities.
- Audit and evidence remain attributable through correction. Completion waits for the appropriate artifact,
  deployment, save/reopen, exact-model, or customer field gate.
- Navisworks mutation is preserve-first: create a detached unique copy, apply final identity, insert it, and
  reacquire the saved-viewpoint collection after every mutation. Later identity safeguards surround this rule.
Evidence-based decision-making is part of Quality 4.0, not a reporting formality. Synthetic
evidence is itself a quality failure because it hides the actual condition of the product and
prevents sound corrective action. Human oversight remains mandatory: the builder supplies
evidence, while Roberto or the master coordinator independently decides whether acceptance passed.

Four evidence outcomes are required and remain independent:

1. **Source Gate:** inspect the real diff and exact files, prove the intended architecture in
   source, search for duplicate implementations, exclude unrelated changes, mock production
   behavior, silent fallbacks, and deferred required work, and run relevant typecheck/build checks.
   Compilation and buildability are not behavioral acceptance.
2. **UI/Behavior Gate:** exercise the real workflow, including persistence and reload where
   applicable. Handcrafted HTML, production-lookalike static pages, synthetic screenshots,
   invented controls, grep-as-interaction, and duplicated component markup are not acceptance
   evidence. A test harness may support diagnosis only when it imports the production component,
   stays outside production, identifies its fixtures, and states its limitations.
3. **Artifact Gate:** open and inspect every generated output. PDFs require page-box, rendered-page,
   text, image, numbering, header/footer, fingerprint, and attachment checks where applicable.
   DOCX requires package and section/media inspection plus Office-compatible rendering and full
   visual review. Spreadsheets require every sheet, relevant values/formulas, print setup, and
   orientation review. Shared plugin work requires both documented 2021/2025 builds and package
   inspection; compilation alone is not field verification.
4. **Deployment/Field Gate:** record committed, pushed, present in Replit, Replit-built, published,
   live-verified, and customer/field-verified states separately. Report the highest state actually
   achieved. A successful response, download, build, or file existing is not proof of professional,
   complete output.

Professional outputs must be traceable from source record through displayed behavior, generated
artifact, release state, and field result. If the required environment is unavailable, record the
missing evidence; do not manufacture a proxy. Implementation-complete and validation-pending is a
valid, necessary distinction.

Release activity also requires authorization and human oversight. No publish, production access or
data mutation, production migration, external deployment, DLL installation, new environment,
database, service, system dependency, elevated operation, network exposure, process termination,
paid external service, or task creation/management may be treated as implicit implementation work.
Roberto must explicitly approve it. Destructive schema actions (`DROP TABLE`, `DROP COLUMN`, and
`DROP INDEX`) and force-push are never approved.

External blockers must not erase learning or implementation. Preserve the binary diff in an
approved recovery location before cleanup, report the location, retain completed source work, and
record what remains validation-pending. This provides corrective-action traceability even when a
runtime, converter, permission, server, or field environment is unavailable.

Recurring customer complaints are quality records and must produce:
- a verified defect,
- a documented root cause,
- corrective action,
- acceptance evidence,
- the affected Living Brief update, and
- an explicit field-verification status.

This closed loop connects customer feedback, corrective action, traceability, professional output,
human oversight, and continuous improvement. A builder may not self-certify it; acceptance remains
provisional until independently reviewed.

## Where This Changes BIMLog
Calidad 4.0 turns BIMLog from a collection of coordination modules into a quality operating
system for construction.

Immediate product impact:
- Submittals must be unified: Submittals, Register, and Tracking Table are views of one module.
- Schedule must become a live coordination schedule for RFI, submittal, model, meeting, and
  milestone dates.
- Lens must keep platform and Navisworks aligned with clear current/history organization.
- Reports must be clean, scoped, filtered, and client-ready.
- AI must be metered, visible, optional, and useful.
- Analytics must surface risk and missing information, not just static counts.

Long-term impact:
- BIMLog becomes the verified construction record.
- The verified construction record becomes owner handover.
- Owner handover becomes the digital twin memory layer.
- The digital twin memory layer becomes the foundation for BIGDOTS, RR-AI, UrbanInvest,
  legal evidence, smart contracts, IoT, GIS, ESG, and portfolio intelligence.

## Guiding Sentence
Build BIMLog so every construction decision becomes structured evidence, every piece of
evidence becomes useful knowledge, and every useful insight helps people act earlier,
clearer, and with less risk.

## Open Loop Control - Mandatory Quality Gate

Customer feedback is now treated as a quality record, not as chat memory.
Every request, bug, complaint, or workflow gap that changes product behavior must be captured in
[OPEN_LOOP.md](./OPEN_LOOP.md) until closed. [STATUS.md](./STATUS.md) records current
implementation state; it does not own unfinished work.

Allowed states:
- Shipped: code/docs/package were built and committed.
- Verified: the real workflow was tested after publish/package by Roberto or the customer.
- Deferred: intentionally not built now, with a reason.
- Rejected: not aligned with BIMLog, with a reason.

Rules:
- Do not call a customer item done just because code was written.
- Do not leave a feature half-built without adding it to the Open Loop Register.
- Do not build a second disconnected version of something that already exists.
- Before adding UI, search for the existing module, route, schema, export, PDF, and activity-log paths.
- Before changing reports, verify the live table filter, PDF output, Excel output, and history scope use the same records.
- Before changing AI behavior, verify credit/cost visibility and whether the action is cheap text assist or expensive file/file-reading assist.
- Before changing plugin behavior, verify both Navisworks 2021 and 2025 source copies or explicitly state which one was changed.
- If a user complaint exposes a wider pattern, update QUALITY.md or STATUS.md so the same mistake is not repeated.

Customer feedback closeout checklist:
- What exactly did the customer ask for?
- Which module owns it?
- Does an existing feature already cover part of it?
- What code paths were changed?
- What exports/reports were affected?
- What was verified locally?
- What still needs publish/package/customer verification?
- Where is the user-facing brief or release note?

This is the prevention mechanism for limbo work: no invisible backlog, no forgotten widget, no orphaned feature, no duplicate workflow.
Additional enforcement:
- [OPEN_LOOP.md](./OPEN_LOOP.md) is the source of truth for unfinished customer feedback.
- A feature is not ready for customer retest until code, exports/reports, guidance, release note, commit/push, publish/package status, and real workflow verification are accounted for.
- If a request includes multiple examples, extract the underlying category and audit the whole category, not only the first example.
