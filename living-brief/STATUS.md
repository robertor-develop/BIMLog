# STATUS.md - Current Accepted Platform State

Status: Active current-state record
Accepted source reconciled through: `81007cafddd1d59880259af2255863986715ed56`
Reconciliation date: 2026-07-21

This file states accepted `origin/master` source truth. Accepted source, deployed source, database-mirror
synchronization, and field/customer verification are separate states. The current semantic-content
reconciliation is an independent integration candidate and does not become accepted or deployed truth until
its review, clean commit, push, and later deployment gates pass.

Current urgent local candidate: Living Brief credential persistence and controlled recovery. It is based on
accepted `origin/master` `81007cafddd1d59880259af2255863986715ed56`, is not reviewed, pushed, published, or
deployed, and must not be treated as production truth until independent review and controlled rollout.

Current governance amendment in the same local candidate: safe defensive security execution and Batch A reconciliation
order. Security Batch A candidate `01c60a1bc24649153afd70b5c061b4cb01d79789` on parent
`2c1ffc4b5c08618610cdb70b42fcb08556726f1c` remains preserved, clean, local, and unpushed. It is not Ready only
because the root production build stopped at the Living Brief semantic-impact gate while separate Living Brief edits
were pending. The safety notice shown after its terminal result is a content-safety interruption, not evidence of
account suspension, product compromise, or a failed code correction.

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

- Coordinator Command Center Build 1: a Lens/Viewpoints-first read-only project action register for
  actionable current Lens Viewpoints, RFIs, Submittals, Meeting actions, and Schedule tasks. Canonical
  modules remain authoritative; exact identity/deep links, current authorization and entitlement checks,
  bounded deterministic pagination, visible partial-source failures, honest empty results, bilingual
  desktop/mobile behavior, and zero mutation/AI use are accepted. Clash aggregation and Build 2 remain deferred.
- RFI Builds 1-7: canonical lifecycle and attachments; non-destructive crop/replacement/show-hide;
  Standard PDF, editable DOCX, factual Audit PDF, native-fidelity Complete PDF, and four-sheet RFI
  Register Excel. Build 8 has not started.
- Telegram Product Builds 1-5: secure account linking, controlled AI foundations, bilingual
  assistant/support, Delivery Concierge foundation, user preferences, reliable outbox, and Notification
  Center. Module adapters shown as coming later remain unavailable; Build 6 has not started.
- Plans, Entitlements, and Feature Controls Steps 1-2: advisory catalog/resolver,
  company/project/user policies and preferences, support matrix, and append-only project-company history.
  Step 3 has not started; tiered billing and add-ons remain approved direction rather than shipped enforcement.
- Meeting Minutes M1-M4: immutable links to canonical same-project RFIs, Submittals, and Clashes; M4
  links and synchronizes canonical Schedule Buckets/tasks from linked Submittals without duplicating them.
- Cost & Financial Control Builds 1-2: effective-dated authorities, exact-decimal/currency controls,
  versioned cost structures, budgets, maker/checker approval, immutable snapshots/history, bounded
  import/export, and bilingual UI.
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
- The full dependency audit records 94 pre-existing findings (7 low, 47 moderate, 40 high) outside the
  tar-only correction. They require a separately scoped dependency-security review and are not silently
  folded into the publish unblock.
- Security Batch A remains a preserved local candidate, not accepted source. It must wait until the credential
  persistence and cost-control/governance Living Brief corrections are independently reviewed and, if authorized,
  integrated. Then it may be rebased/reapplied onto accepted master, reconcile only its effective security/report
  design impact, rerun only invalidated gates, and return as a clean Ready candidate. SheetJS/Batches B-I remain
  unstarted.
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

- Living Brief Content Reconciliation Build 2: independently reconciled review candidate only.
- Replit verified pull of `178462e`, actual 12-table preview, explicitly approved publish, runtime/mirror
  reconciliation, and deployed browser verification.
- Navisworks v1.60.18: Ruben 2025 field acceptance pending.
- RFI Build 8, Telegram Build 6, Entitlements Step 3, Meeting Minutes M5, and Finance Build 3: not started.

See [OPEN_LOOP.md](./OPEN_LOOP.md) for actions and [AUDIT.md](./AUDIT.md) for dated evidence.
