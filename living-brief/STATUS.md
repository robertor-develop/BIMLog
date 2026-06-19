# STATUS.md — Current Build State

Updated manually after each feature ships. Reflects the real state of the platform.

## Last updated
- 2026-06-19

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
- rfi_ball_in_court_history is never written — no writer exists anywhere in the codebase despite
  4 active RFIs.
- change_orders imports createNotification but never calls it — change order events produce no
  notifications.
- GET /api/v1/projects/:projectId/levels endpoint exists but is not yet consumed by any frontend
  page — confirmed via code search, no frontend reference found. Open, not broken.

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
