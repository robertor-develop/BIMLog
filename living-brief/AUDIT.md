# AUDIT.md - Historical Evidence Register

Status: Active append-only historical record

Every finding and production row count below is scoped to its stated observation date. It is not a
claim about the current platform unless a later current-state reconciliation explicitly re-verifies
it. Current accepted product truth belongs in [STATUS.md](./STATUS.md); unfinished work belongs in
[OPEN_LOOP.md](./OPEN_LOOP.md). In particular, the July 3 findings and counts are historical and must
not be presented in the Living Brief UI as present-day production facts.

## Historical audit - June 14, 2026

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

Session Close-Out Audit — 2026-06-24

Method: every item below confirmed by reading the current route, schema, and frontend code this
session. No production row counts re-queried; live e2e results cited are from this session's testing
against the running api-server. Append-only — nothing above this line was changed.

1. STORAGE-ADAPTER REFACTOR (artifacts/api-server/src/lib/storage-adapter.ts)

What changed: all file persistence in routes/files.ts now routes through a single StorageAdapter
interface (upload(buffer, projectId, filename) -> storagePath, download(path) -> buffer,
delete(path) -> void). Multer was switched to memoryStorage so the route handler receives the file
as an in-memory buffer (req.file.buffer) and hands it to storage.upload — confirmed at files.ts:25
(memoryStorage), :791 (upload), :228 (download), :798 and :903 (delete on failure/replace).
What did NOT change: behavior is byte-for-byte identical. The shipped implementation,
LocalDiskStorageAdapter, writes the same bytes to the same on-disk layout as before. There is no
cloud backend yet; this is the seam that makes one possible.
Verification: live e2e earlier this session confirmed upload/download/delete round-trips and
byte-for-byte equality with the prior disk behavior.

2. RFI ACCOUNTABILITY FOUNDATION — CONCURRENCY-GUARD PROOF

Design: creating an RFI no longer sends any email and no longer moves ball-in-court (confirmed: no
sendEmail/sendMail call path remains in routes/rfis.ts; the create path comment at ~750-751 states
the flip happens only at mark-sent). Four new columns on rfis: send_status (default 'draft'),
sent_at, sent_by_id (FK -> users), send_method (schema rfis.ts:65-68). A copy-paste email preview is
produced by POST .../rfis/:rfiId/generate-email-preview (rfis.ts:1368), AI-generated with a graceful
fallback to a static template on AI failure (catch -> fallback at rfis.ts:996).
Single custody writer: POST .../rfis/:rfiId/mark-sent (rfis.ts:1435) is the ONLY writer of
rfi_ball_in_court_history. It runs inside db.transaction (rfis.ts:1444) and performs a guarded
conditional UPDATE — the WHERE includes ne(send_status,'sent') OR send_status IS NULL
(rfis.ts:1466) — so two concurrent callers serialize on the row: the winner updates one row and
inserts the first history row (rfis.ts:1474); the loser updates zero rows and receives a 409
("already marked as sent", rfis.ts:1448). DB-level enforcement: FK rfi_id -> rfis.id NOT NULL
(schema rfi-ball-in-court-history.ts:6) plus a partial-unique index
rfi_ball_in_court_open_unique ON rfi_ball_in_court_history (rfi_id) WHERE to_date IS NULL
(app.ts:166), guaranteeing at most one open custody row per RFI.
Concurrency proof (live, earlier this session): two mark-sent calls fired against the same RFI under
an actual race produced exactly ONE rfi_ball_in_court_history row — not two — with the second call
returning 409. The guard holds.

3. CREATE RFI FROM NAVISWORKS VIEWPOINT — ATOMICITY FIX

Feature: POST .../rfis/from-viewpoint (rfis.ts:764), new nullable rfis.source_viewpoint_id
(schema rfis.ts:77, plus idempotent startup ALTER in app.ts), GET .../rfis/:rfiId (rfis.ts:844) for
deep-link prefill, RfisTab.tsx ?rfi= handling (line 152) and a "Jump to Viewpoint" button
(lines 1723-1730) opening localhost:8765/jump?code=<encoded sourceViewpointId>.
Architect-flagged bug: the original implementation created the RFI FIRST, then decoded/uploaded the
image and inserted the file row. A zero-byte payload, storage failure, or file-insert failure after
the RFI insert left an orphan RFI with no linked file; the catch-all also returned 400 for what were
really server errors.
Resolution: image bytes are now decoded and zero-byte-checked BEFORE any persistence (400 on bad
input). The RFI insert + activity-log insert + filesTable insert run inside one db.transaction
(rfis.ts:805) via a transaction-aware shared helper createRfiForProject(..., dbx=tx); the one
non-transactional side effect (the uploaded file on disk) is compensated with storage.delete on
rollback or on a helper rejection. Status mapping corrected: 400 validation, 422/409 helper
rejections, 500 for storage/DB/unexpected failures.
Verification (live e2e this session): happy path created the RFI and the linked filesTable row with
the disk bytes matching the source PNG exactly; GET-by-id returned it and 404'd for a missing id; the
zero-byte path returned 400 and the invalid-priority path returned 422, and in BOTH failure paths the
RFI count and file count were unchanged and no leftover viewpoint file remained on disk — confirming
the transaction rollback and storage compensation work.

KNOWN LIMITATION CARRIED FORWARD: the from-viewpoint screenshot is a real filesTable row
(linkedRfiId set) but is not retrievable via the generic download route, which serves only
system-generated PDFs and returns 501 for binary uploads because the disk path was never persisted to
the DB. This is pre-existing and affects every user upload today; it was not introduced by this
feature and needs a small follow-up to extend the download route.

## Historical full re-audit - July 3, 2026

Method: fresh grep verification of every wiring claim against current route and frontend code,
plus live read-only row counts queried today against the production Neon database. Append-only —
nothing above this line was changed.

CONTEXT EVENT: the double-database publish hazard was diagnosed and closed this week. Replit's
Publish flow diffs the (unused) built-in dev DB against production and had been generating
DROP TABLE migrations for runtime-created tables; approved publishes wiped lens_viewpoints,
lens_viewpoint_events/reports/sequence_counters, and platform_settings on prior occasions.
The dev DB is now schema-synced (drizzle push, registered as validation step db-dev-sync) and
publish safety rules are documented in replit.md. Row counts below reflect post-incident state;
zero-row lens_viewpoint_events/reports may partly reflect that wipe, not just lack of use.

CROSS-CUTTING TRUTHS (re-verified)

activity_log — WIRED and active (164 rows, up from 108). Written by rfis, submittals, files,
change_orders, transmittals, meeting_minutes, clash_reports, schedule, project_directory,
conventions, members, submittal_reports, linked_items, and the overdue-notifier background job.
Still the one concern genuinely wired everywhere.

Notifications — createNotification now has THREE callers: transmittals (transmittal_received,
transmittals.ts:146), meeting_minutes (action_item_due, meeting_minutes.ts:168), and — FIXED
since June 14 — change_orders (change_order_status, change_orders.ts:151, fired on
submit/approve/reject to notify the initiator). The former "imports but never calls" gap is
CLOSED. notifications table still 0 rows because all three source tables are empty
(transmittals=0, action_items=0, change_orders=0).

rfi_ball_in_court_history — NO LONGER ORPHANED. Single custody writer is POST
.../rfis/:rfiId/mark-sent (rfis.ts:1475) inside a transaction with a concurrency guard and a
partial-unique open-custody index. 1 row in production — the mechanism has fired in real use.

Agents on save — UNCHANGED GAP. runClashAgent / runRfiAgent / runBriefingAgent are still called
only from src/agents/* and the manual agents router; no create/update handler triggers them and
no web frontend calls the manual endpoints. (Dashboard.tsx and TotalControl.tsx call
/dashboard/briefing, which is the separate dashboard_briefing route, not the agents router.)
agent_insights = 7 rows (up from 2), all from manual/delete-pattern paths.

linked_items — unchanged: creation only via POST /projects/:id/links, still gated
requirePermission("admin","write") (linked_items.ts:30); LinkedItemsPanel mounted in RfisTab,
SubmittalsTab, LensViewpointsView. Prod = 0 rows. Wired but unused.

NEW WIRING SINCE JUNE 14 (all verified live)

RFI send custody: rfis.send_status/sent_at/sent_by_id/send_method drive the draft-to-sent flow;
mark-sent is the sole ball-in-court writer; email preview via generate-email-preview. In prod:
rfis=11 (up from 4), rfi_view_events=17.
RFI from Navisworks viewpoint: POST .../rfis/from-viewpoint (atomic transaction + storage
compensation), rfis.source_viewpoint_id, deep-link prefill, Jump to Viewpoint button.
Lens Viewpoints lifecycle: lens_viewpoint_sequence_counters is the sequence authority (14 rows —
actively used); Edit/Reassign supersede-and-insert revisions write lens_viewpoint_events;
lens_viewpoint_reports stores generated report metadata. Both 0 rows in prod today (see context
event above). lens_viewpoints = 19 rows, actively fed by the desktop plugin.
Living Brief: editable docs (CLAUDE.md, VISION.md, PLUGIN.md) persist to platform_settings
(living_brief_doc:* keys); PLATFORM/STATUS/AUDIT read from disk. Access gated by
users.can_access_living_brief. platform_settings = 1 row.
Storage adapter: all file I/O in routes goes through lib/storage-adapter.ts (buffer-based seam).

MODULE-BY-MODULE (own-table write / activity_log / notification)

RFIs: YES / YES / no in-app notification (email path on manual send). Active: 11 rfis, 1
response, 17 view events, 1 custody row.
Submittals: YES / YES / no. submittals=1; submittal_items and submittal_register still 0.
Change Orders: YES / YES / YES (change_order_status — gap closed). Tables still 0 rows.
Transmittals: YES / YES / YES (transmittal_received). Tables 0.
Meeting Minutes: YES / YES / YES (action_item_due). meetings=1, attendees=0 (was 14 — rows gone),
action_items=0.
Clash Reports: YES / YES / no. clash_reports=5, clashes=2666, fed by desktop plugin.
Files: YES / YES / no. files=11.
Schedule: YES / YES / no. milestones=1.
Project Directory: YES / YES / no. =0.
Conventions: YES / YES / no. Active and growing: 7 conventions, 29 versions, 56 fields.
Members: YES / YES / no (invites by email). members=12, invitations=0.
Coordination: YES / YES / no. =7 rows.

STILL-ORPHANED ROUTES (unchanged)

agents router (insights, briefing, agents/clash, agents/rfi): no web frontend caller.
documents router (/documents/search, /documents/ai-search): no caller anywhere.
GET /projects/:projectId/levels (conventions.ts:105): defined, no frontend consumer.
autodesk router and clash_reports lens-pull/plugin-pull: desktop-plugin-wired by design, not
orphaned.

STATIC-ONLY FRONTEND TABS (unchanged, intentional)

IntegrationsTab: static integration and API docs. SetupGuide: static docs plus sync-agent
download link.

GENUINE WIRING GAPS REMAINING (priority order)

1. Agents never fire in normal flows — unchanged since June 14. Wire clash/rfi/briefing agents
   to saves or surface the manual endpoints in the UI.
2. Binary uploads still not downloadable: files.ts:482 returns 501 for user-uploaded binaries via
   the generic download route (only system-generated PDFs are served). Pre-existing limitation,
   now affects 11 files.
3. linked_items creation remains admin-write gated and barely surfaced — 0 rows ever.
4. meeting_attendees dropped 14 -> 0 with meeting_minutes unchanged at 1 — consistent with the
   publish-wipe incident window or a re-save that cleared attendees; worth a look next time
   meetings are exercised.

CLOSED SINCE LAST FULL AUDIT

- change_orders notification gap (now calls createNotification on status changes).
- rfi_ball_in_court_history orphaned table (now written by mark-sent; 1 live row).
- Double-DB publish data-loss hazard (schema sync + guardrails; see context event).

PRODUCTION DB TABLE COUNTS — July 3 2026

action_items: 0, activity_log: 164, admin_actions_log: 3, agent_insights: 7,
change_order_documents: 0, change_orders: 0, clash_reports: 5, clashes: 2666, companies: 6,
company_profiles: 0, config_options: 90, contact_submissions: 0, coordination_intake_events: 7,
email_log: 7, feature_flags: 11, files: 11, lens_viewpoint_events: 0, lens_viewpoint_reports: 0,
lens_viewpoint_sequence_counters: 14, lens_viewpoints: 19, linked_items: 0, meeting_attendees: 0,
meeting_minutes: 1, naming_convention_versions: 29, naming_conventions: 7, naming_fields: 56,
notifications: 0, platform_settings: 1, project_directory: 0, project_invitations: 0,
project_members: 12, project_milestones: 1, projects: 11, rfi_ball_in_court_history: 1,
rfi_responses: 1, rfi_view_events: 17, rfis: 11, submittal_items: 0, submittal_register: 0,
submittal_reports: 1, submittal_view_events: 0, submittals: 1, transmittal_items: 0,
transmittals: 0, users: 7.
# Living Brief Semantic-Content Reconciliation Audit - 2026-07-21

Status: corrective local review candidate; not independently accepted, pushed, published, or production verified.

The accepted 11-document catalog, canonical hashing, source-authoritative mirror, and freshness controls solved
structural parity. A second audit found a different failure: hash/current-file reconciliation could call an exact
old document Current even when major accepted decisions, regressions, operating rules, and builds were absent or
contradicted elsewhere. Examples included accepted Living Brief architecture still described as a local candidate,
the protected Navisworks physical-mutation invariant missing from the committed plugin authority, and RFI Builds
4-7 absent from the report authority.

Root cause: freshness measured source bytes, ancestry, catalog coverage, and mirror equality, but did not require
an acceptance unit to declare which semantic authorities it reviewed. Corrective control: every implementation or
incident review records all applicable Living Brief authorities as updated or `reviewed_no_semantic_change`, tied
to a commit/task; unknown keys and missing applicable reviews fail the deterministic checker. UI metadata separates
source change, semantic review/reconciliation, deployed source commit, and database mirror synchronization.

Roberto's corrective policy adds timing: an immediate operational/quality category cannot be deferred to a later
batch. The semantic declaration records each such finding as captured in the same correction chain, while normal
minor feature detail may wait only to its acceptance boundary. Negative fixtures remove or defer an immediate
finding and must fail. This distinguishes rapid progress reporting from the complete terminal summary required of
every builder.

Two operational lessons are retained without rewriting older audit entries:

- Replit publication previously compared a divergent development schema and produced destructive migration SQL.
  Schema preview, zero-destructive-SQL review, publish authority, actual publish, and live verification are separate
  gates. The current interrupted-rebase/schema-preview/publication state remains unresolved until verified from the
  latest remote; no production action was taken by this correction.
- Replit's `.git`-write restriction was known during rebase recovery, but later clean-history instructions again
  assumed the agent could fetch, branch, commit, or move refs. Consequences included repeated manual intervention,
  stale-lock recovery, detached-HEAD/rebase metadata, empty/noise publish commits, more paid cycles, and increased
  discard risk. The corrective control is a tested capability preflight and agent/operator responsibility split
  before work begins. Control is being added here; the current schema reconciliation is still not pushed or published.
- Read-only production verification of clean schema candidate `9297740` corrected an inherited 11-table expectation.
  Complete latest-master comparison found 12 pending additive creates: Meeting M4 (2), Finance B2 (9), and the
  accepted Living Brief mirror table `living_brief_documents` (1), which is absent in production. No destructive or
  existing-column operation was identified. This is pending-deployment evidence only; operator push, actual preview,
  publish, and live verification remain outstanding.
- After `9297740` was pushed, Replit publish stopped before application build: the publish-only supply-chain firewall
  returned `403 Blocked by Security Policy` for transitive `tar@7.5.11` through Electron/sync-agent tooling. Replit
  proposed a root override to `tar@7.5.20` and regenerated the lockfile, reporting zero 7.5.11 resolutions and green
  API/frontend builds. That correction has not been independently diff-reviewed, committed, pushed, or published.
  Control: reproduce publish install policy; scan every frozen transitive/optional tool chain; use a minimal bounded
  override with range/zero-occurrence proof; frozen-clean-install and build; exact-file commit only; never repeat an
  unchanged blocked publish. No schema migration or production application write occurred in this failed stage.
- Despite validation-only/no-checkpoint instructions, Replit automatically created unpushed commit `0d60d7a`
  (`Update package to safely resolve security vulnerability`) on master with pushed parent `9297740`. It changes only
  root `package.json` and `pnpm-lock.yaml`, but the lockfile stat is 1,181 insertions/93 deletions. Search reports zero
  `tar@7.5.11` and two `tar@7.5.20` resolutions. Those counts do not establish semantic safety. The checkpoint remains
  an unaccepted/unpublished candidate pending effective-diff, importer/version/integrity/optional/resolution-path,
  package-manager-version, clean-install, affected-build, and security review; broad churn must be replaced cleanly.
- Corrective operating model from the July 21 rebase/checkpoint/schema/security incidents: source, dependencies,
  lockfiles, evidence, commits, review, integration, and push return to controlled local worktrees. Replit pulls the
  verified commit, shows the actual preview, performs only an explicitly approved publish, and verifies runtime.
  Replit-only failures diagnose/report then stop. Any exception requires Roberto's scoped post-preflight approval.
- Independent audit **rejected** local unpushed `0d60d7a`. Its intended `tar@7.5.20` target was correct, but adding
  root `package.json` `pnpm.overrides` silently displaced the canonical `pnpm-workspace.yaml` override set: about 80
  existing overrides/exclusions dropped, 117 unrelated packages appeared, deprecated `@esbuild-kit` packages and a
  second esbuild returned, and about 113 foreign-platform binaries were reintroduced. The candidate was neither
  pushed nor published and production was unchanged by it. The correction must be a clean 9297740-based local
  worktree change preserving every workspace control with a tar-only semantic delta; Replit stops at diagnosis.
- Navisworks identity protections cannot replace the v1.60.7 physical mutation method. The v1.60.9-v1.60.17
  regression class retained stale collection objects across mutation, producing placeholder/duplicate/missing
  successor behavior. Fresh collection reacquisition and immutable identity resolution are now protected doctrine;
  v1.60.18 remains frozen pending Ruben's 2025 field acceptance.

### July 21 source-correction closure

The preceding tar and schema entries are preserved as the facts known when they were written. Their source-control
blockers later closed: clean schema reconciliation `9297740955336971b6aa9b4b120b0f2b6054185c` and the bounded
workspace-authority tar correction `178462eef6edbde08e2d44efb0a944b812f98480` were independently reviewed and
pushed. The accepted tar correction retained every pre-existing workspace override/exclusion, removed
`tar@7.5.11`, resolved the four Electron/sync-agent paths to `tar@7.5.20`, passed a frozen install and affected
builds, and excluded the rejected broad-lockfile checkpoint `0d60d7a`.

This closes source correction only. Replit still must pull the verified source, show the actual 12-table additive
preview, receive explicit publish approval, and pass post-publish runtime/mirror/browser verification. The full
dependency audit also reported 94 pre-existing findings (7 low, 47 moderate, 40 high); they are a separate bounded
security remediation workstream and are not evidence against the tar-only correction.

## Living Brief Credential Persistence Audit - 2026-07-21

Status: urgent local review candidate; not independently accepted, pushed, published, or production verified.

Roberto reported the fifth recurrence of the Living Brief gate credential failing after Replit publication, with the
locked page showing a visible reset form. No production credential, hash, environment value, token, customer data, or
database row was accessed for this audit.

Source root cause in accepted code: the Living Brief gate password was stored as a generic
`platform_settings` row named `living_brief_password_hash`. Startup created `platform_settings`, then inserted a
hardcoded default hash when that row was absent. The `ON CONFLICT DO NOTHING` clause preserved an existing row, so the
code did not overwrite a present credential; the defect was that missing durable state after publish/schema drift was
silently reseeded to a default instead of failing closed or preserving a dedicated credential authority. The locked UI
also presented Super Administrators with a reset form before the gate was unlocked.

Corrective control: Living Brief gate credentials move to a dedicated durable table with one-way migration from the
legacy row, no hardcoded/default seeding, versioned brief-access tokens, and reset/bootstrap only by a currently
authenticated and currently revalidated Super Administrator. Reset requires bounded input, exact confirmation, a
reason, rate limiting, transaction/advisory-lock serialization, immutable audit history, and session invalidation.
Anonymous users, ordinary users, Project Admins, and Company Admins have no reset authority. Startup, mirror
reconciliation, deployment-source changes, and publication must never create, rotate, clear, or overwrite an existing
credential. Missing durable state is an operational error, not permission to invent a password.

Deployment truth remains pending: production must later migrate the existing valid credential without disclosure,
publish only after Roberto's approval, and verify restart/publish persistence against the real deployed system.

---

## Defensive Security Execution and Batch A Reconciliation Audit - 2026-07-21

Status: governance amendment in the active Living Brief credential candidate; not independently accepted, pushed,
published, or production verified.

Security Batch A produced preserved local candidate `01c60a1bc24649153afd70b5c061b4cb01d79789` on parent
`2c1ffc4b5c08618610cdb70b42fcb08556726f1c`. Its work was defensive, bounded, and local to BIMLog source and finite
fixtures. It did not reproduce exploits, run unbounded payload/resource-exhaustion tests, target external systems,
access production or customer data, push, or publish. It remained not Ready because the root production build stopped
at the Living Brief semantic-impact gate while separate Living Brief corrections were pending. The task correctly
preserved the candidate instead of fabricating declarations or weakening the gate.

Roberto reported that one Batch A response displayed a persistent "content cannot be displayed" cybersecurity safety
notice after the terminal result. This audit records the visible fact only: one persistent safety notice was visible
while legitimate bounded implementation continued. It is not evidence of account
suspension, product compromise, or failed defensive source correction unless an official account/product notice later
states that. The corrective control is safe defensive security execution: stop repeating or circumventing the specific
blocked request/output, preserve state, rephrase toward bounded defensive application-quality verification, keep
summaries sanitized, avoid duplicate tasks or unchanged expensive reruns, and continue other safe engineering steps
under OpenAI and BIMLog policy.

Reconciliation control: Living Brief impact enforcement remains strict but composable. Owning Living Brief
credential/governance and cost-control corrections must be independently reviewed and integrated first if Roberto
authorizes them. Then Security Batch A may be rebased or reapplied onto the accepted master and may declare only its
effective changed paths and genuinely affected authorities. SheetJS and Batches B-I remain unstarted.

---

## Owner Credential Continuity Exception Audit - 2026-07-21

Status: temporary owner-approved continuity exception recorded in the active Living Brief credential/governance
candidate; not final launch architecture.

Roberto decided that current working integration credential material must remain operational and unchanged during
ongoing platform development because prior Replit rebuilds repeatedly lost or replaced configuration and forced manual
re-entry. This audit is value-blind: no credential value, token, secret, callback secret, hash, or private provider
configuration was recorded, printed, copied, tested, or transmitted.

Control: until Roberto separately approves launch hardening, no task may rotate, revoke, delete, replace, relocate,
regenerate, invalidate, print, copy, quote, transmit, test, or change provider/callback/authentication behavior for the
working integration credentials, and no build/correction may require Roberto to re-enter them. Future credential
mutation requires fresh explicit Roberto approval.

Launch blocker: before public/production launch, this exception requires a separately approved managed-secret
migration, durable backup/recovery, controlled rotation/revocation as appropriate, callback continuity, rollback
proof, history remediation, and independent verification. The exception does not weaken the separate Living Brief
gate-password durability correction, which still requires durable authority and controlled recovery.

---

## Terminal-Turn Telegram Notification Audit - 2026-07-21

Status: permanent governance control added during the active Living Brief credential reconciliation.

Roberto clarified that Telegram task notifications are operational return-to-computer alerts, not only completion
notices. A task may stop at Ready, partial safe boundary, Blocked, Needs Input, Failed, Paused/Held, no-change audit,
or Completed; each stopped work cycle still requires one structured sanitized terminal-turn notification so Roberto
knows to return and review the exact current state.

Corrective control: terminal notifications use honest status. Completed is reserved for genuine completion; otherwise
Info, Blocked, Failed, or Needs Input must state the terminal outcome and next action without secrets, security
internals, customer data, private paths, billing details, or sensitive repository metadata. EventIds are unique and
idempotent per stopped work cycle. Ready and Completed notifications are not duplicates because they represent
different terminal turns. No periodic five-minute noise is sent while useful autonomous work continues. If delivery is
blocked, the final report prominently states that the terminal notification was not delivered and gives the exact
non-sensitive reason.

---

---

## Security Batch A Reconciliation Audit - 2026-07-21

Status: integration candidate on accepted source baseline; final gates and push pending.

The preserved Batch A content from candidate `01c60a1bc24649153afd70b5c061b4cb01d79789` was applied without
importing its original ancestry onto accepted master `b67ae0118b4f8eb85f9de2aaf55c5aad399a7ea6`, preserving Coordinator
Build 1 and the accepted Living Brief credential-continuity, defensive-security, and terminal-notification governance.
The effective source delta is limited to the API server's exact Multer 2.2.0 dependency, centralized bounded
multipart middleware, a finite local regression harness, 13 route modules covering 20 upload endpoints, and the
strictly necessary lockfile delta.

The correction preserves route authorization order and route-specific input allowances, maps parser failures to
bounded bilingual client responses, rejects unsupported nested and duplicate fields, and retains storage cleanup
compensation at durable upload boundaries. It does not modify SheetJS/xlsx, root package overrides, workspace
override policy, report presentation, plugin behavior, publication, deployment, production/customer data, or any
other remediation batch. The one persistent UI safety notice remains recorded as one visible notice only.

Final evidence must distinguish source integration and push from publication, deployment, production verification,
and independent acceptance. SheetJS and Batches B-I remain deferred pending separate authorization.
