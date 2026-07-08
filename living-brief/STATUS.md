# STATUS.md — Current Build State

Updated manually after each feature ships. Reflects the real state of the platform.

## Last updated
- 2026-07-02

## What shipped since 2026-06-24 — Lens Viewpoints hardening + Responsible Company

### Workflow change
- The platform monorepo is now cloned locally (github.com/robertor-develop/BIMLog, branch
  `master`; `main` is a stale March snapshot). Two AI agents edit the real repos directly:
  Claude Code and Codex. Replit is the host/deploy only (Neon + Publish), no longer used as
  an AI editor. RULE: one agent per session, always commit before switching.
- Plugin uses semantic versioning (v1.6.x). Every package ships README + a per-revision
  update .txt + the zip, built at `H:\BIMLogPlugin2025` via `Build-Package-2025.ps1`.
  Current: v1.6.3. 2021 build at `C:\Dev\BIMLogPlugin` (Roberto/Navisworks 2021), 2025 build
  at H: (Ruben/Navisworks 2025). `BIMLogLensPanel.cs` + `BIMLogApiClient.cs` are the shared
  source; keep both in sync across 2021/2025.

### Platform (all committed + pushed to master)
- Lens table View controls: Active-only default + All-revisions toggle; per-column show/hide
  (Group/Lifecycle/Rev); ID format toggle. ID short code is now `FI-001` (2-letter trade +
  seq) everywhere — table, report register, Excel — matching the plugin.
- Group column shows the `G:XXXX` token (first 4 of issueGroupId, same as plugin); column
  headers have plain-language tooltips.
- Supersession lineage on the successor row: "left-arrow supersedes FI-001".
- Stats strip above the table (Open/Follow Up/Waiting/Approved/Resolved + Superseded/Voided);
  report Executive Summary has a lifecycle line.
- Report: "Include revision history" toggle; VOID-RECORD rows excluded from the register;
  short `FI-001` ID by default.
- Report-history per-entry delete. Deleting a lens viewpoint now ALSO deletes its
  `activity_log` rows (no orphaned revision history resurfacing in reports).
- Admin test-reset (`POST .../lens-viewpoints/reset-test-data`, admin-write) + a danger-zone
  button: wipes a project's lens viewpoints + sequence counters + reports + events + lens
  activity-log for a clean test baseline.
- Floor-correction expanded to grouped viewpoints + chain repair for orphaned superseded rows
  (Codex).
- Responsible Company (v1.6.2): `responsible_company` column (schema + startup migration);
  stored on sync; returned in lens-pull; suggestions endpoint; batch set across group/chain
  (`.../batch-responsible-company`); table column + Set-Responsible-Company modal (datalist);
  Excel + PDF; carried forward on Edit/Reassign.

### Plugin (v1.6.x, 2021 deployed + 2025 packaged)
- DisplayName rework DONE (shared display contract): names are now clean —
  `ID | Trade-Seq | [R{n}] | [SUPERSEDED->succ / VOIDED] | ReportType | Floor | Priority |
  Note[RL] | [G:xxxx] | [<-predecessor]`. Who/why/when/reason moved to plain-text
  `[BIMLog history]` comments (invisible to the metadata parser).
- Sync duplication fixed: `lens-sync` push skips viewpoints that already have a serverId or a
  pending placeholder (edit/reassign copies are created by the action endpoints, not re-pushed).
- Sync-first GUARDRAIL: Edit/Void/Reassign on an un-synced viewpoint pops "Sync required
  first" (Sync now / offline anyway / Cancel) instead of silently queuing offline.
- Done Managing Viewpoints button; RefreshCounter fixed (synced = server knows the name OR the
  viewpoint has a serverId — edit/reassign copies have new names but real serverIds).
- Group token `G:xxxx`; `<-predecessor` lineage on reassign copies; offline seq reads
  `pending` (not `PEND004`).
- Guidance dropdown (Codex): topic help (Daily workflow, Save, Markup, Edit/Reassign/Void,
  Floor corrections, Clean duplicates, Create RFI, Troubleshooting) + Show-guidance toggle.
- Clean Duplicate Views rebuilds/migrates into one stable `BIMLog Viewpoints` root with
  Open/Follow Up/Waiting Design/Approved/Resolved/Superseded/Voided/Voided Records folders;
  legacy dated folders and old cleanup folders are recognized only for migration.
- Responsible Company field per trade row (v1.6.2) — synced, round-tripped, carried forward.
- KNOWN NAVISWORKS LIMITATION: the `SUPERSEDED->successor` marker on the OLD tree record is
  best-effort — Navisworks marks it read-only after the online round-trip, so the rename can
  fail. The PLATFORM is the source of truth for lifecycle display; the tree name is cosmetic.

### Plugin v1.6.3 (2026-07-02) — Navisworks tree mirrors the platform (plugin-only, no republish)
- **Sync now covers the whole BIMLog tree.** `SyncWithBIMLog` recurses every folder
  (`FindAllBIMLogViewpointLocations`), so viewpoints a prior cleanup filed into subfolders sync
  too — previously only loose viewpoints in the date folder synced, so history (Superseded/
  Voided/Voided Records) was silently skipped after a cleanup.
- **One lifecycle brain.** The counter and the sync push now decide active/superseded/voided the
  same way, via folder-authoritative `EffectiveLifecycle`: own name marker → folder placement →
  loose-in-date-folder = active → metadata last. Folder placement outranks stale metadata, so a
  bad value left by a correction round-trip self-heals instead of flipping current rows to history.
- **Full 8-folder set, created every cleanup even when empty**, mirroring the platform Show +
  Status filters: Open, Follow Up, Waiting Design, Approved, Resolved, Superseded, Voided, Voided
  Records. Active viewpoints file into their workflow-status folder (open/follow_up/waiting_design/
  approved/resolved); history into its lifecycle folder. Change a status on the platform → run
  Clean Duplicate BIMLog Views → the viewpoint moves to the matching folder. Verified two-way.
- Backend unchanged: `lens-pull` already returned `status`, so this was plugin-only (no republish).
- Packaged `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.6.3.zip` + README (Rev 1.6.3) +
  `BIMLog_Lens_Revision_Update_v1.6.3.txt`. Both 2021 and 2025 build clean.

## What is working right now (June 15, 2026)
- BIMLog Lens: Save Viewpoint, Sync, Jump to Viewpoint, Delete, tab persistence, amber refresh
  banner — all working.
- BIMLog Pulse: clash hit sync working — DisplayName = BIMLog Pulse confirmed.
- All 6 modules have soft delete with DeleteConfirmModal and cascade warning.
- All modules have import (any file format), PDF export, and activity logging.
- Lens Viewpoints: 5 viewpoints synced on ELARA EAST with 1185RI-* IDs.
- Jump to Viewpoint: navigates Navisworks directly via `localhost:8765/jump?code=displayId` —
  the no-cors approach is confirmed working.
- Plugin connected: green dot on the platform.
- Scrollbar always visible (grey) on the Lens Viewpoints table.
- Tab persistence on Clash Hits vs Lens Viewpoints using localStorage.
- Living Brief F5 system — built this session: four docs in `/living-brief`, served via
  `/api/v1/living-brief/*`, password gate (default BIMAI360, stored hashed), eligibility (super
  admin or granted), F5 intercept to open the brief for eligible admins, super-admin
  password/access controls. PLATFORM.md auto-regenerates on every api-server build.
- Living Brief F5 system — 5 tabs CLAUDE PLATFORM STATUS VISION AUDIT — password gated BIMAI360 —
  DB-backed editable docs — Copy Full Brief button — Paste to Update on CLAUDE and VISION tabs —
  Export current docs button — auto-regenerating PLATFORM.md on every build.
- AUDIT tab — full wiring audit permanent and accumulating in living-brief/AUDIT.md.
- BIM Coordination Report PDF — professional PDF export for Lens Viewpoints — cover page, health
  score, executive summary, main table, watermark, signature block, SHA-256 fingerprint, report
  number tracking, report history log, pre-generation modal with company info.
- Shared pdf-kit.ts module — foundation for all future PDF standardization — Round 0 complete.
- BIMLog Quality Standard — documented in CLAUDE.md — applies to all PDFs platform wide.
- Database fix — PROD_DATABASE_URL is now canonical and fail-loud — ENV banner now shows real Neon
  connection — lens_viewpoints data now persists on Neon across all rebuilds.
- lens_viewpoint_reports table — sequential report numbering ELA01-LV-001 format.
- lens_viewpoint_events table — status change tracking for future health score calculation.
- Navisworks 2025 plugin — built and confirmed working on Ruben's machine using his real Navisworks
  2025 DLLs. Build directory is H:\BIMLogPlugin2025 on Roberto's machine, separate from the 2021
  production build at C:\Dev\BIMLogPlugin\BIMLogNavisPlugin. Packaged with a bat file installer and
  sent to Ruben directly. Platform-based download delivery not yet built.
- Building Levels data location — RESOLVED (2026-06-19). The data lives in
  naming_fields.allowed_values where label = "Level", scoped per project's active naming convention.
  Confirmed live for project 26: B1, G0, L1 through L15, RF, ZZ. A new endpoint,
  GET /api/v1/projects/:projectId/levels, now exposes this list to the plugin.
- Redline interception architecture — RESOLVED (2026-06-19). Confirmed via direct reflection: there
  is no public API hook to intercept the native Redline Text/Draw tools before Navisworks creates its
  own viewpoint. Adopted approach instead: users draw native Redline directly, then the plugin copies
  the real auto-created SavedViewpoint object (via CreateUniqueCopy, which preserves the Redline —
  confirmed working via Navisworks' own native Copy/Duplicate behavior) into a BIMLog-formatted
  viewpoint, tagged with a simple "includes Redline markup" flag, with the original leftover removed
  afterward.
- BIMLog Lens Floor dropdown — now pulls real Building Levels via the new /levels endpoint, with a
  user-triggered Sync button and a local offline cache, replacing the previous hardcoded floor list.
- Multi-trade viewpoints — one camera position can now hold multiple independent Trade+Note entries,
  each becoming its own real Navisworks viewpoint with its own per-Trade+Floor sequence number —
  supported in BIMLog Lens.
- Convention Builder Foundational Settings data-integrity fix — EditFoundationScreen now sends a
  scalar-only payload, the backend guards naming_fields rebuilds behind a hasFields check, and a
  repair-needed warning banner shows on any completed convention with missing required field values.
  Project 23 remains the one known affected project, flagged for manual remediation, not yet repaired.
- Storage-adapter abstraction (artifacts/api-server/src/lib/storage-adapter.ts) — files.ts fully
  refactored to route through it: multer now uses memoryStorage and all file I/O goes through a
  buffer-based upload/download/delete interface. The current LocalDiskStorageAdapter is byte-for-byte
  equivalent to the prior on-disk behavior (live e2e verified). This is the groundwork seam for a
  future cloud backend.
- RFI accountability foundation — the silent auto-email on RFI create has been removed (creating an
  RFI never sends mail and never moves ball-in-court). New send_status / sent_at / sent_by_id /
  send_method columns on rfis. A copy-paste email preview is generated via the new
  POST .../rfis/:rfiId/generate-email-preview endpoint (AI-generated, with a graceful fallback to a
  static template on AI failure). The POST .../rfis/:rfiId/mark-sent endpoint is the ONLY place
  ball-in-court flips to the recipient — it writes the first rfi_ball_in_court_history row inside a
  transaction with a guarded conditional UPDATE (send_status != 'sent'), so concurrent callers
  serialize and the loser gets a 409 (verified live under an actual race — exactly one history row,
  not two). A FK (rfi_id -> rfis.id) plus a partial-unique index (rfi_ball_in_court_open_unique on
  rfi_id WHERE to_date IS NULL) enforce one open custody row per RFI at the DB level.
- Create RFI from Navisworks viewpoint — new POST .../rfis/from-viewpoint. It validates all inputs
  (including decoding and zero-byte-checking the screenshot) BEFORE any write, then creates the RFI +
  linked filesTable row inside a single transaction and compensates the uploaded file via
  storage.delete on rollback, so a failure never leaves an orphan RFI (verified via e2e on the
  zero-byte and invalid-priority failure paths — no orphan RFI, no leftover file). Validation returns
  400, helper rejections 422/409, server/storage/DB failures 500. New nullable source_viewpoint_id
  column on rfis, new GET .../rfis/:rfiId for deep-link prefill of brand-new drafts, RfisTab.tsx
  ?rfi= deep-link handling, and a "Jump to Viewpoint" button in the RFI detail panel.
- Plugin endpoints — new GET .../projects/:projectId/levels (Building Levels from
  naming_fields.allowed_values, scoped via requireProjectMember) and GET .../projects/list-for-plugin
  (narrow {id,name,code} shape scoped to the caller's real project memberships) for the desktop plugin.

## Active Investigations
- None open. (Building Levels data location and Redline interception architecture were both resolved
  on 2026-06-19 — see "What is working right now".)

## Core platform
- Auth (JWT), projects, project members/roles, admin panel, super admin.
- Coordination modules: RFIs, submittals, transmittals, change orders, meeting minutes,
  schedule, clash reports (with Navisworks plugin sync), lens viewpoints, files/documents,
  naming conventions, directory, reports, dashboard briefing, intelligence, agents.

## What Ruben needs next
- BIMLog Mirror — bidirectional clash sync — the Clash API is ready in the plugin, not built yet.
- Spell check on the Issue Note field in the BIMLog Lens panel (RichTextBox) and on platform
  textareas (`spellCheck=true`).
- Package the plugin for Ruben — install.bat, ZIP, README with installation instructions.
- Fix Unknown/Unknown trades via ComAPI — element properties are not being read correctly.

## Active build priorities
1. Navisworks 2025 plugin compatibility — build and package for Ruben.
2. BIMLog Mirror — bidirectional clash sync.
3. Full agent heartbeat architecture — 5-layer system.
4. Wire agents to save endpoints.
5. PDF standardization Round 1 — remaining reports.
6. Spell check — plugin RichTextBox and platform `spellCheck=true`.

## Known bugs
- Agents not wired to save endpoints — clash-agent, rfi-agent, briefing-agent exist but do not
  fire automatically on save.
- APS 3-legged OAuth paused — 2-legged confirmed insufficient for ACC hub data — needs a user
  authorization flow.
- IBQ Convention Builder session paused mid-build — needs resuming when IBQ becomes active.
- Reports module partially broken.
- Unknown/Unknown trades in some clash hits — ComAPI needed to read element properties.
- linked_items table has 0 rows — cross-linking exists but is not being populated yet.
- rfi_ball_in_court_history — NO LONGER orphaned as of this session: the new
  POST .../rfis/:rfiId/mark-sent endpoint is its first and only writer. Existing RFIs created before
  this work still have no history rows until they are marked as sent.
- change_orders imports createNotification but never calls it — change order events produce no
  notifications.
- GET /api/v1/projects/:projectId/levels endpoint exists but is not yet consumed by any frontend
  page — confirmed via code search, no frontend reference found. Open, not broken.
- The screenshot file uploaded via POST .../rfis/from-viewpoint lands as a real filesTable row with
  linkedRfiId set, but is NOT yet retrievable through the existing generic download route, which only
  serves system-generated PDFs and returns 501 for binary uploads (the disk path was never persisted
  to the DB — a pre-existing limitation affecting every user upload today, NOT introduced by this
  feature). Needs a small follow-up to extend the download route.
- Cloud storage backend (OneDrive or similar) is designed but not started — the storage-adapter
  refactor is the prerequisite groundwork, now complete.

## Founding partner context
Ruben Crespo (rubenc@bimcorpgroup.com) is BIMLog's first Founding Partner. ELARA EAST is the
live reference project driving every feature. Eventually BIMLog will scale beyond Ruben — but
every decision today is validated against his real workflow.

## Internal Wiring Audit (verified June 14 2026 against production DB)
Evidence-based. "Wired" = code path confirmed by grep AND a real caller (web frontend or
desktop sync plugin) confirmed. "Unused" = wiring is correct but the prod table is empty
because nobody has entered data. "Orphaned" = code exists but nothing calls it. Prod is
lightly used (6 projects, 4 users), so most empty tables are unused, not broken.

### Cross-cutting truths
- activity_log: WIRED and active (108 rows). Written by rfis, submittals, files, change_orders,
  transmittals, meeting_minutes, clash_reports, schedule, project_directory, conventions,
  members, coordination, reports, admin, projects, activity, submittal_reports, linked_items.
  Files (11) / submittals (11) / rfis (10) / admin (10) are the heaviest loggers.
- linked_items: cross-links are ONLY created by POST /projects/:id/links (linked_items router),
  which requires admin-write permission. Module routes (rfis, submittals, change_orders,
  transmittals, meeting_minutes, clash_reports) only READ links for display and DELETE them on
  entity soft-delete — they never CREATE links. Frontend creator is LinkedItemsPanel, mounted in
  RfisTab, SubmittalsTab, LensViewpointsView. Prod = 0 rows: feature is wired but unused (and
  gated behind admin-write, so most users cannot create links).
- Agents on save: NO module triggers a real AI agent on create/update. The only agent_insights
  writes during normal CRUD are "delete_pattern" insights emitted on soft-DELETE in rfis,
  submittals, change_orders, transmittals, meeting_minutes, clash_reports. The real agents
  (runClashAgent, runRfiAgent, runBriefingAgent) run ONLY via the manual agents router endpoints
  (/projects/:id/insights, /briefing, /agents/clash/:clashId, /agents/rfi/:rfiId) — which NO web
  frontend calls. agent_insights = 2 rows. Confirms the existing "agents not wired" known bug.
- Notifications (in-app): createNotification (notifications router) is called in only TWO places:
  transmittals ("transmittal_received") and meeting_minutes ("action_item_due"). change_orders
  IMPORTS createNotification but never calls it (gap). rfis, submittals, files, members, admin
  reference the word "notification" but do NOT create in-app notifications. notifications table =
  0 rows because both source tables (transmittals=0, action_items=0) are empty. Bell UI
  (MasterSidebar) correctly GET/PATCH/DELETE /notifications and global search GET /search.

### Module-by-module (own-table write / activity_log / creates linked_items / agent on save / notification)
- RFIs (rfis -> rfis): YES / YES / no (read+delete only) / no (delete_pattern only) / no. Wired+active (4 rows).
- Submittals (submittals -> submittals,submittal_items,submittal_register): YES / YES / no / no / no. submittals=1; submittal_items & submittal_register=0 (register/items unused).
- Change Orders (-> change_orders, change_order_documents): YES / YES / no / no / NO (imports createNotification but never calls — GAP). Tables=0 (unused).
- Transmittals (-> transmittals, transmittal_items): YES / YES / no / no / YES (transmittal_received). Tables=0 (unused, so 0 notifications).
- Meeting Minutes (-> meeting_minutes, meeting_attendees, action_items): YES / YES / no / no / YES (action_item_due). meetings=1, attendees=14, action_items=0 (that meeting had no action items; insert path exists at create + parse).
- Clash Reports (-> clash_reports, clashes): YES / YES / no / no (delete_pattern only; real clash agent only via manual endpoint) / no. clash_reports=4, clashes=1483 (active via desktop plugin sync).
- Files (-> files): YES / YES / no / no / no. files=4.
- Schedule (-> project_milestones): YES / YES / no / no / no. milestones=1.
- Project Directory (-> project_directory): YES / YES / no / no / no. =0 (unused).
- Conventions (-> naming_conventions, _versions, _fields): YES / YES / no / no / no. Active (5/20/40 rows).
- Members (-> project_members, project_invitations): YES / YES / no / no / no (invites go by email, not in-app). members=7, invitations=0.
- Coordination (-> coordination_intake_events): YES / YES / no / no / no. =7 (active).
- Reports/Intelligence: generates PDFs + intelligence-summary; logs activity; no own persistent table beyond agent/email logs. Existing known bug: "Reports module partially broken" — not re-verified here.

### Tables with 0 rows and why
- action_items (0): wired (created on meeting create/parse); the one meeting had none. Unused.
- change_orders / change_order_documents (0): wired (ChangeOrdersTab create/import); no data entered.
- transmittals / transmittal_items (0): wired (TransmittalsTab create/import); no data entered.
- submittal_register / submittal_items (0): wired; no register imported yet.
- project_directory (0): wired (DirectoryTab import/add); no data entered.
- project_invitations (0): wired (TeamTab); none sent.
- company_profiles (0): wired (CompanyProfile /users/me/company-profile); none saved. NOTE: companies table has 3 rows — different table.
- contact_submissions (0): wired — /contact DOES insert; just no form submissions (email_log=6 is unrelated mail).
- lens_viewpoints (0): wired to desktop plugin sync (autodesk router); none synced yet.
- linked_items (0): wired but unused + admin-write gated (see above).
- notifications (0): source tables empty (see above).
- rfi_ball_in_court_history (0): ORPHANED TABLE — rfis route NEVER inserts BIC history despite 4 RFIs. No writer anywhere. Genuine gap.
- submittal_view_events (0): view tracking not exercised.

### Routes that exist but have NO web-frontend caller
- agents router (/projects/:id/insights, /briefing, /agents/clash/:clashId, /agents/rfi/:rfiId):
  ORPHANED from UI. This is why AI insights are not generated in normal use.
- documents router (/projects/:id/documents/search, /documents/ai-search): ORPHANED — no caller.
- autodesk router (APS token/viewer + plugin sync) and clash_reports lens-pull/plugin-pull:
  NOT called by the web frontend BY DESIGN — these are hit by the desktop Navisworks sync agent.
  Treat as "external-plugin wired", not orphaned.

### Frontend tabs that render but call no working backend
- IntegrationsTab: renders static integration/API docs only — no backend calls (intentional).
- SetupGuide: static docs + a download link to /api/v1/downloads/sync-agent-windows (intentional).
- All other tabs call endpoints that exist and resolve. (Earlier suspected /meetings mismatch was
  a false alarm: the meeting route IS /projects/:id/meetings, matching the frontend.)

### Genuine wiring gaps to fix (priority order)
1. Agents never fire in normal flows — wire clash/rfi/briefing agents to create/update saves, or
   expose the manual /agents endpoints in the UI. (Confirms existing known bug.)
2. change_orders imports createNotification but never calls it — no notifications on change-order events.
3. rfi_ball_in_court_history is never written — BIC history table is dead despite active RFIs.
4. linked_items creation is admin-write gated and lightly surfaced — relationships stay empty in practice.

## Open Loop Register - Customer Feedback and Half-Finished Work

This register exists so customer feedback and interrupted builds do not disappear into chat history.
Every item must end in one of four states: shipped, verified, deferred, or rejected with reason.
If an item is built but not tested by the real user after publish/package, it is not closed.

### Process rule - mandatory from now on
- Before starting new customer-requested work, read this register and decide whether the new work touches an open loop.
- When a customer request is mentioned in chat, add it here unless it is completed in the same session and verified.
- When a build changes a module, update the matching user-facing release note before saying the customer can test.
- Never treat one example as the whole task. If Roberto asks for a review of missing items, mine the whole conversation and update this register.

### Platform, domain, and Replit shell
- Open: BIMLog feedback widget. Roberto liked the feedback function but wants a BIMLog-owned widget, not Replit branding/sign-in. Do not build until explicitly prioritized; keep as open product item.
- Open: Confirm bimlog.app and www.bimlog.app production behavior after DNS/certificate propagation. Replit old URL cleanup was merged and pushed, but live browser verification is still needed.
- Open: Living Brief persistence. QUALITY.md exists as a Living Brief tab, but DB-backed Living Brief docs may still require paste-to-update unless the disk/DB sync path is confirmed. Need eliminate manual paste drift.
- Open: Publishing discipline. GitHub commits are not live until Replit pulls and republishes. Release notes must clearly say: committed/pushed, needs publish, or live verified.

### AI and cost control
- Open: Platform-wide AI usage audit. Admin AI Usage page exists, but every AI call site must be audited to prove usage is logged with user, project, feature, billing mode, and estimated credit units.
- Open: User-owned AI keys and managed-credit model. Internal Roberto/test users may use the current Anthropic/Replit proxy, but external users need a clear own-key or managed-credit path with visible cost controls.
- Open: User-facing AI usage. Super admin can see platform usage; each normal user still needs a simple usage/billing visibility surface.
- Open: Separate cheap text AI from expensive file-reading AI. Description/email assist should be low-cost and easy to trigger; file-reading/OCR AI must require a clear cost warning before use.
- Open: Submittal AI assist. Roberto approved AI Description Assist and AI Email Draft; file-reading assist must remain separate and explicit. Verify final UX and cost logging before closing.

### Submittals and Submittal Tracker
- Open: Submittal Tracker must feel like part of Submittals, not a disconnected sidebar module. Desired layout: Submittals / Register / Tracking Table as left-side internal tabs like Clash Reports, with Import, Export Excel, Export PDF, and New Submittal actions on the right.
- Open: Existing submittals must appear in the Tracking Table when they have enough data. Current concern: Roberto's one manual submittal did not track. Audit register rows vs submittal rows and remove disconnected logic.
- Open: Explain and wire Register. The UI must make clear that Register is the planned/spec item list, while Submittals are actual submissions against those planned items. If that is not the real code behavior, fix the code or rename it.
- Open: Tracker filters requested by Ruben: Building Level, Drawing Type, Date, Review Status. Building Level must come from project convention levels when available, not only from currently loaded rows.
- Open: Excel export quality. Submittal exports must be professional, formatted, human-readable, filter-respecting, and usable even when users create submittals inside BIMLog instead of importing Excel.
- Open: PDF and audit certificate quality. Roberto called current outputs unclear/ugly. Audit certificate needs either a clear purpose and polished output or removal/deferment.
- Open: Attachment UX. Users must be able to add files/images from their computer to submittals and product info. Display names must be human file names, not raw API download URLs. Attachments should appear above Description where Roberto requested.
- Open: Editable detail UX. Submitted By, Submitted To, contacts, emails, responsible company, product information, ball-in-court, status, and review data must be editable in one consistent detail panel and must populate immediately after save.
- Open: Company/contact pickers. Responsible Company, Submitted To Company, Submitted To Contact, Submitted To Email, and Submitted By Contact should choose from the project directory/company list or allow adding a new reusable company/contact.
- Open: Links. Link to RFI, Transmittal, Change Order, and related Submittal must be visible and actually persist. Roberto said this worked before and disappeared.
- Open: Ball in Court guidance. The field is unclear. It should be a controlled choice or guided field, not a mystery text box.

### Coordination Schedule
- Open: Schedule must be useful, not just visible. Calendar, Board, and List need actionable cards that open/edit linked RFIs, submittals, milestones, and model items.
- Open: Add Schedule Item flow. A prior test showed adding a linked submittal/date/title appeared to do nothing. Verify create path, activity log, refresh, and empty/error states.
- Open: Outlook-like calendar and Planner-like board. Ruben asked for calendar and sprint/kanban-style coordination workflow. Current board needs usability verification.
- Open: Add item type: 3D Model. Ruben requested this in Coordination Schedule.
- Open: Building Level selector in Schedule should come from the project's Building Levels / Convention Builder values.
- Open: Schedule should automatically surface RFI and submittal due dates when present, plus allow manual project milestones.

### Lens Viewpoints - platform
- Shipped, needs Ruben verification: Project 30 delete hardening. Ruben could not delete viewpoints due to raw query/returning error. Fix was committed and pushed, but needs Replit publish/backend restart and Ruben retest.
- Open: Viewpoint deletion UX. Errors should be clean user messages, never raw SQL.
- Shipped, needs verification: Issue Age column for Lens Viewpoints. Platform should track accountability by captured date, revision age, last action, responsible company/contact, and status.
- Open: Aging dashboard/report metrics for Lens: open items, closed/resolved, voided, reassigned, superseded, aging by company/trade/status.
- Deferred: True bidirectional Navisworks local delete sync. Needs dedicated design so the server can reconcile local deletions without accidental data loss.

### Navisworks plugin
- Shipped, needs Ruben verification: v1.60.6 2025 package at H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.6.zip.
- Open: Verify Navisworks 2025 with Ruben after latest 2021-to-2025 source sync. Do not assume 2021 success means 2025 success.
- Shipped, needs field verification: Stable root folder doctrine. New root should be BIMLog Viewpoints; new views should go under status folders, not daily folder explosions.
- Open: Cleanup/reconcile workflow must be tested end to end: Sync with BIMLog, Pull from Platform, Clean Duplicate BIMLog Views. It must not delete unsynced local work when the platform is empty.
- Open: Plugin guidance. Add clear in-panel workflow instructions/dropdowns so users know when to Sync, Pull, Clean, Save Viewpoint, Create RFI, and how redline/markup viewpoints work.
- Open: Project switching in Navisworks. Ruben reported changing Project ID in settings required closing/reopening Navisworks. A fix was claimed earlier; needs Ruben's 2025 retest.
- Open: Read-only permission failure. Plugin users with insufficient permission still need a clear 401/403 message and recovery path.
- Open: Unknown/Unknown trades via ComAPI. Element property reading remains unresolved.
- Open: Maintain release documentation. Every plugin version after v1.60.6 should use v1.60.7, v1.60.8, etc., with README and latest revision update file.

### RFI and cross-module workflow
- Open: RFI handover work remains. RFI_HANDOVER.md lists cloud pickers, impact layout, save unification, RFI types config, numbering, and OAuth env details.
- Open: RFI attachment/file handling and generic binary download route. Prior limitation affects uploaded files beyond generated PDFs.
- Open: RFI AI assist should follow the AI split: cheap text/email assist allowed with clear logging; file reading requires explicit warning.
- Open: Cross-linking module UX. linked_items exists but is lightly surfaced/admin-gated; relationships remain empty in practice.

### Reports, PDF, and Excel
- Open: Platform-wide report standardization is not complete. Lens reports improved, but every PDF and Excel export needs Quality Standard review.
- Open: Excel exports must be polished, branded, filtered, auto-sized, and human-readable. No raw DB headers.
- Open: PDF reports must align with on-screen filters and include only the intended records. History appendices must be scoped, optional, and understandable.
- Open: Mojibake prevention. Repo-wide scan for bad encoding patterns must run before publish. User-facing strings containing mojibake block release.

### Data cleanup and admin operations
- Open: Test users 22, 23, and 24 were audited as isolated test data. Safe deletion requires removing their isolated projects/files/RFIs/activity first; do not bare-delete users.
- Open: Production test cleanup tools. Admin-only cleanup must be precise by project/module, not broad destructive buttons.
- Open: Living Brief access. No user had can_access_living_brief in the audit; decide whether Roberto-only is intentional or if specific admins need access.
- Open: Change order notifications. createNotification is imported but is not called in change orders.
- Deferred: Agents auto-firing on every save. Deferred for cost/latency until a managed AI budget model is in place.

### Quality and platform stabilization
- Open: Full top-to-bottom platform audit is not truly complete. Partial audits and targeted fixes were done, but every tab/export/report/tool has not been exhaustively verified.
- Open: Module-by-module Quality 4.0 audit should be scheduled in rounds: Auth/Admin, Projects/Dashboard, RFIs, Submittals, Schedule, Files, Reports, Clash/Lens, Plugin, Integrations, PDFs/Excel, AI/cost.
- Open: Release note discipline. For every customer-facing update, create a user-facing summary before telling Ruben or another customer to test.
- Open: Avoid duplicate disconnected builds. Before adding new UI, search existing tabs/routes/schema and either extend the existing feature or deliberately replace it.
