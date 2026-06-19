INTERNAL WIRING AUDIT — June 14 2026
Verified against production database. Every claim confirmed by grep on actual route and frontend code plus live prod row counts.

CROSS-CUTTING TRUTHS

activity_log — WIRED and active (108 rows). Written by rfis, submittals, files, change_orders, transmittals, meeting_minutes, clash_reports, schedule, project_directory, conventions, members, coordination, reports, admin, projects, activity, submittal_reports, linked_items. This is the one cross-cutting concern genuinely wired everywhere.

linked_items — Cross-links are created ONLY by POST /projects/:id/links (linked_items router), which requires admin-write permission. Module routes only READ links for display and DELETE them on soft-delete — they never CREATE links. The only frontend creator is LinkedItemsPanel, mounted in RfisTab, SubmittalsTab, and LensViewpointsView. Prod = 0 rows: wired but unused, and gated behind admin-write so most users cannot create links anyway.

Agents on save — NO module triggers a real AI agent on create or update. The only agent_insights writes during normal CRUD are delete_pattern insights emitted on soft-DELETE. The real agents runClashAgent, runRfiAgent, runBriefingAgent run ONLY through the manual agents router and NO web frontend calls those. agent_insights = 2 rows. Confirms the existing agents-not-wired known bug with the precise reason.

Notifications — createNotification is called in only TWO places: transmittals (transmittal_received) and meeting_minutes (action_item_due). change_orders IMPORTS createNotification but never calls it — this is a genuine gap. notifications table = 0 rows because both source tables are empty (transmittals=0, action_items=0).

MODULE-BY-MODULE (own-table write / activity_log / creates linked_items / agent on save / notification)

RFIs: YES / YES / no / no / no. Active, 4 rows.
Submittals: YES / YES / no / no / no. submittals=1; submittal_items and submittal_register=0.
Change Orders: YES / YES / no / no / GAP — imports createNotification but never calls it. Tables=0.
Transmittals: YES / YES / no / no / YES (transmittal_received). Tables=0 so 0 notifications fired.
Meeting Minutes: YES / YES / no / no / YES (action_item_due). meetings=1, attendees=14, action_items=0.
Clash Reports: YES / YES / no / no (real clash agent only via manual endpoint) / no. clash_reports=4, clashes=1483 fed by desktop plugin.
Files: YES / YES / no / no / no. files=4.
Schedule: YES / YES / no / no / no. milestones=1.
Project Directory: YES / YES / no / no / no. =0.
Conventions: YES / YES / no / no / no. Active (5 conventions, 20 versions, 40 fields).
Members: YES / YES / no / no / no (invites by email not in-app). members=7, invitations=0.
Coordination: YES / YES / no / no / no. =7 rows active.
Reports and Intelligence: generates PDFs and intelligence-summary, logs activity, no own persistent table. Reports partially broken — not re-verified in this audit.

TABLES WITH 0 ROWS AND WHY

action_items, change_orders, change_order_documents, transmittals, transmittal_items, submittal_register, submittal_items, project_directory, project_invitations, company_profiles, contact_submissions: all WIRED correctly — simply no data entered yet. These are unused not broken.
lens_viewpoints: wired to desktop plugin sync — 5 rows confirmed after plugin testing.
linked_items: wired but unused and admin-write gated.
notifications: both source tables empty so nothing has fired.
rfi_ball_in_court_history: ORPHANED TABLE — rfis route NEVER inserts BIC history despite 4 active RFIs. No writer anywhere in the codebase. Genuine gap.
submittal_view_events: view tracking not exercised.

ROUTES THAT EXIST BUT HAVE NO WEB FRONTEND CALLER

agents router (insights, briefing, agents/clash, agents/rfi): ORPHANED from UI — this is exactly why AI insights never appear in normal use. No frontend page calls these endpoints.
documents router (/documents/search, /documents/ai-search): ORPHANED — no caller anywhere.
autodesk router and clash_reports lens-pull and plugin-pull: NOT called by web frontend BY DESIGN — hit by the desktop Navisworks sync agent. External-plugin-wired, not orphaned.

FRONTEND TABS THAT RENDER BUT CALL NO WORKING BACKEND

IntegrationsTab: static integration and API docs only, no backend calls. Intentional.
SetupGuide: static docs plus a download link. Intentional.
All other tabs call endpoints that exist and resolve correctly.

GENUINE WIRING GAPS TO FIX (priority order)

1. Agents never fire in normal flows — wire clash, rfi, and briefing agents to create and update saves, or surface the manual agents endpoints in the UI.
2. change_orders imports createNotification but never calls it — no notifications on change order events.
3. rfi_ball_in_court_history is never written — the BIC history table is dead despite 4 active RFIs. No writer anywhere.
4. linked_items creation is admin-write gated and barely surfaced — relationships stay empty in practice.

PRODUCTION DB TABLE COUNTS AT TIME OF AUDIT

action_items: 0, activity_log: 108, admin_actions_log: 2, agent_insights: 2, change_order_documents: 0, change_orders: 0, clash_reports: 4, clashes: 1483, companies: 3, company_profiles: 0, config_options: 90, contact_submissions: 0, coordination_intake_events: 7, email_log: 6, feature_flags: 11, files: 4, lens_viewpoints: 5, linked_items: 0, meeting_attendees: 14, meeting_minutes: 1, naming_convention_versions: 20, naming_conventions: 5, naming_fields: 40, notifications: 0, project_directory: 0, project_invitations: 0, project_members: 7, project_milestones: 1, projects: 6, rfi_ball_in_court_history: 0, rfi_responses: 1, rfi_view_events: 1, rfis: 4, submittal_items: 0, submittal_register: 0, submittal_reports: 1, submittal_view_events: 0, submittals: 1, transmittal_items: 0, transmittals: 0, users: 4.

Naming Field Data Integrity Audit — 2026-06-17

Context: a confirmed data-integrity bug let the "Foundational Settings" editor send a fields
array that wiped naming-field dictionaries on already-completed conventions. Fixes deployed:
EditFoundationScreen now sends scalar settings only (no fields); the PUT conventions route
only rebuilds naming_fields when a complete, valid fields array is present and rejects any
field-carrying save that would empty a required dictionary on a completed convention; the
Convention Builder hydrates the real saved Level list and shows a repair banner instead of
masking missing data with defaults.

Audit query: every completed convention whose required fields (Level, Sequence, Status,
Revision, Discipline, Type) have an empty allowedValues array.

Findings (PROD / Neon):
- project_id=23  field=Level      values=0
- project_id=23  field=Revision   values=0
- project_id=23  field=Sequence   values=0
- project_id=23  field=Status     values=0

No other completed convention has any empty required field. Projects 24, 26, 28, 29, 30 are
intact. Verified unchanged by this work: project 26 Level = [B1,G0,L1-L10,RF,ZZ];
project 24 Level = 23 values; project 28 Level = 22 values.

REMEDIATION REQUIRED (not auto-fixed): project 23's Level, Sequence, Status, and Revision
values are confirmed unrecoverable from version history. A human must re-enter the correct
values through the full convention wizard (the safe path). Per decision, project 23 was NOT
modified by this work.

Read-Only Re-Verification Audit — 2026-06-19

Method: every claim below confirmed by reading current route and frontend code this session.
No code changed. No production row counts re-queried this session (prior counts stand unless
noted); all findings are code-level evidence as of today.

PART 1 — Previously confirmed gaps, all re-verified against current code, all STILL TRUE:

- Agents never fire on save. runClashAgent / runRfiAgent / runBriefingAgent appear only in
  their own definitions under src/agents/*, in briefing-agent.ts (which composes the other
  two), and in the manual router routes/agents.ts. NO caller in the create/update handlers of
  rfis.ts, submittals.ts, clash_reports.ts, or change_orders.ts. The manual agents endpoints
  still have no web-frontend caller.
- change_orders imports createNotification but has ZERO call sites. The only occurrence in
  routes/change_orders.ts is the import on line 10; no invocation anywhere in the file.
- rfi_ball_in_court_history has ZERO writers anywhere in the repo. The table name occurs in
  exactly one place: its own schema file lib/db/src/schema/rfi-ball-in-court-history.ts. No
  insert or select against it in api-server. (Note: submittals' working ball-in-court is a
  separate JSON column on the submittals table — it does NOT touch this RFI table.)
- linked_items creation is still gated to requirePermission("admin","write"). In
  routes/linked_items.ts, POST /projects/:projectId/links (line 30) and DELETE /links/:linkId
  (line 74) both require admin/write; only the GET (read) uses requireProjectMember().
- Unknown/Unknown trades is a plugin-side issue only. The server stores trade values
  as-received (clash_reports.ts: discipline1: c.trade1, discipline2: c.trade2 ~1767-1768;
  lens trade stored as-is ~588). There is no trade-enrichment / ComAPI property-reading logic
  in this repo — by design that lives in the C# plugin's ClashTriage. Nothing in the buildable
  codebase changes or fixes it.

PART 2 — NEW finding: Lens Viewpoints Floor filter is NOT hardcoded.

It is built dynamically from the distinct floor strings already present in synced
lens_viewpoints rows: LensViewpointsView.tsx line 309 — floors = uniq(viewpoints.map(v =>
v.floor)) — rendered at lines 455-457 ("All Floors" default option + floors.map). The
viewpoints come from GET .../clash-reports/lens-pull (line 161). So the stale-looking list
(1ST, 2ND-10TH, 3RD-10TH, 4TH, ALL FLOORS, CELLAR, UNDERGROUND) is old DATA from before the
plugin's Floor source was fixed, not a code bug. It never reads naming_fields.allowed_values,
which is why it diverges from Convention Builder's real Building Levels (B1, G0, L1-L15, RF,
ZZ).

Full map of every Floor/Level dropdown across the platform and its real data source:
- Convention Builder (ConventionBuilder.tsx): the editor / source of truth — defines the Level
  list and writes naming_fields.allowed_values.
- Name Generator (NameGenerator.tsx): reads field.allowedValues (lines 198, 282, 335) — canonical.
- Files Tab (FilesTab.tsx): filename preview from field.allowedValues (lines 125, 825) — canonical.
- Coordination Hub (CoordinationHub.tsx): cf.allowedValues + detectedLevel + /conventions/
  suggest-value (lines 534, 663, 759) — canonical.
- Lens Viewpoints Floor filter (LensViewpointsView.tsx): derives from plugin-synced
  viewpoint.floor — NOT from conventions. Root of the visual mismatch.
- Clash Hits floor grouping (ClashReportsTab.tsx line 395, default "Unassigned"): derives from
  clash data (c.level / c.floor) — NOT from conventions. Same root cause.
- Meeting Minutes (MeetingsTab.tsx lines 153-155, 276-278): hardcoded free-text template rows
  (UNDERGROUND / CELLAR / 1ST FLOOR) — editable inputs, not a bound dropdown.
Also note: GET /api/v1/projects/:projectId/levels exists but is not yet consumed by any
frontend page (no frontend reference to /levels).

PART 3 — Module readiness assessment for the next wiring phase:

- RFIs: richest existing surface to connect — rfi_responses, rfi_view_events, conflict-of-
  interest detection on responses, an email-notification path, activity logging, and an
  existing rfi-agent that is simply not auto-triggered. Real gap: the dead
  rfi_ball_in_court_history table. Best foundation to build on.
- Change Orders: thinnest — own-table CRUD plus activity log only; the notification hook
  exists in name only (import, no call); no agent; no ball-in-court. Most foundational gaps.
- Submittals: middle — has a WORKING ball-in-court mechanism (JSON column, written on update
  and read in two places) but submittal_items / submittal_register are unused, and it has no
  agent and no notifications.
- Cross-cutting flag: ball-in-court is already implemented two inconsistent ways across two
  modules (working JSON column on submittals, dead dedicated table for RFIs). A unification
  decision is needed before wiring the third module.
