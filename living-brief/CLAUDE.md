# AI_DEV.md / CLAUDE.md - BIMLog AI Development Operating Manual

This file is the operating manual for any AI development partner (Codex / Claude / Replit Agent)
working on BIMLog. Read it at the start of every session before making changes.

Preferred future filename: AI_DEV.md. Keep CLAUDE.md as a compatibility alias until the
Living Brief UI and any agent tooling can read AI_DEV.md directly.

## Who / What
- Product: BIMLog, a construction coordination platform.
- Owner: Roberto Rodriguez, CEO of BIMCapital Partners INC / IgniteSmart.
- Primary field user: Ruben Crespo (rubenc@bimcorpgroup.com), first Founding Partner.
- This is a multi-session build. Context is preserved through the Living Brief documents
  in this folder: CLAUDE.md, PLATFORM.md, STATUS.md, VISION.md, PLUGIN.md, QUALITY.md, OPEN_LOOP.md.

## Standing Workflow Rule - read before touching anything
Talk through the full goal and agreed design BEFORE writing code when the user is still
asking design/product questions. Once the user approves direct edits, build in small,
independently verified steps. Read the real current code before editing it. Never patch
from memory of what a file "should" contain. Verify every change landed with grep,
typecheck, build output, or a focused runtime test before moving to the next change.

## Master Codex / focused task-chat operating rule
- When Roberto designates the current Codex task as the master coordinator, this task does
  not implement feature code. It verifies the real repositories, reconciles the Living Brief,
  defines source-of-truth behavior, and gives exact paste-ready directives to focused task chats.
- Every focused-task directive must name the real repository explicitly. The BIMLog platform
  repository is `C:\Dev\bimlog`; never assume the task chat's mounted folder is the repository.
- Every directive must begin exactly:
  `STOP. DO NOT TOUCH ANYTHING. DO NOT START ANY PLAN.`
- The directive must require the task chat to verify `git status`, recent commits, and the
  complete current implementation before editing. It must list the exact files that must be
  read first, define files/modules that are out of scope, define required behavior and
  non-regression constraints, and finish with exact verification and final-report requirements.
- Focused task chats must verify against the repository and current runtime evidence, never
  compressed chat memory. If a claimed defect is not reproduced, they must report the evidence
  rather than creating a duplicate control or alternate workflow.
- The master task records every discovered, completed, or deferred product item in
  `OPEN_LOOP.md` so Roberto does not have to repeat cross-task instructions.

## Standing Rule - never dictate implementation to Replit
When writing instructions for Replit, give the goal and real constraints, not exact code,
column names, or transaction patterns to follow verbatim. Replit may know the running
workspace state better than an outside prompt. Exception: hard correctness constraints
are fine to state explicitly, such as "Edit must not consume a fresh sequence number; it
must inherit the old one."

## Standing Rule - platform and plugin share one display contract
The Navisworks plugin and the platform web UI display the SAME underlying lifecycle/chain
data: revisionNumber, supersedesId, lifecycleStatus, issueGroupId.

Shared clean field set:
ID - Trade-Seq - Rev N only if greater than 1 - State only if not active - Floor - Group
only if grouped.

Full detail such as who, why, when, superseded-from belongs in on-demand detail: comment,
history panel, edit reason, or lineage row. Do not cram it into a headline, title, or
inline badge. If one side's design changes, the other side must be reviewed too.

## Owner preferences - hard rules
- NO emojis anywhere: UI, code, comments, commit messages, docs, reports.
- Icons: lucide-react only. No other icon sets, no emoji icons.
- NO mock data and NO silent fallbacks. If something fails, fail loudly and explicitly.
- Prefer plain-text raw output. Do not hide output in collapsed boxes.
- Be terse. Do not over-explain.
- Do not make major plugin workflow changes without walking Roberto through the user flow first.

## Encoding / UTF-8 release gate
- Before every production build, publish, or Replit instruction that asks for a build, run
  `pnpm run check:mojibake`.
- If the scan reports any active-source hit for mojibake markers such as U+00C3, U+00C2,
  U+00E2, U+FFFD, or common pasted corrupted punctuation patterns, STOP and fix it before
  publishing.
- Do not "fix" Spanish by deleting Spanish. Proper Spanish UTF-8 is allowed when needed.
  Mojibake is caused by reading valid UTF-8 through the wrong encoding path.
- The scanner intentionally ignores binary assets, archives, dependencies, build output,
  uploads, and attached_assets paste archives. User-facing app source, emails, PDFs,
  API messages, reports, and Living Brief docs must stay clean.
- HTML pages, API responses, email bodies, generated PDFs, CSV/Excel exports, and imported
  text paths must explicitly preserve UTF-8. If a pasted string renders corrupted in the UI,
  repair it immediately at the source and rerun `pnpm run check:mojibake`.
- Do not publish if `pnpm run check:mojibake` fails.

## Architecture rules
- Monorepo: pnpm workspaces. See PLATFORM.md for the full map.
- Backend API is Express; every route is mounted under the global prefix `/api/v1`.
  - res.redirect in route files MUST include the `/api/v1` prefix or it 404s.
- Schema lives in `lib/db/src/schema/*` (drizzle). Every schema change must be made in
  BOTH the drizzle schema file AND the idempotent startup migration block in
  `artifacts/api-server/src/app.ts` using ALTER TABLE or CREATE TABLE IF NOT EXISTS.
- Route ordering: literal sub-paths such as `.../lens-pull`, `.../plugin-pull`, `.../active`
  MUST be registered before parameterized catch-alls like `.../:reportId`, which have no
  NaN guard.
- Soft-delete DELETE routes live inside their feature route files, not a separate file.
- Frontend is React + Vite + wouter. Protected pages use the `ProtectedRoute` wrapper,
  which reads token from `useAuthStore` and redirects to `/login`.
- bimlog build requires PORT to be set: `PORT=3000 pnpm build`.
- api-server builds to `dist/index.cjs` via esbuild. The bundle-size warning is normal.
  Restarting the API re-runs the migration block.

## Auth model
- JWT Bearer tokens. Payload carries `isSuperAdmin`.
- `authMiddleware` verifies the token.
- `isSuperAdminMiddleware` re-checks `users.is_super_admin`.
- Super admin is the boolean column `users.is_super_admin`, data-driven and not a hardcoded email.
- Super admins bypass project membership checks through `requireProjectMember`.
- Admin routes pattern: `router.get("/admin/...", authMiddleware, ...)`.
- bcryptjs is already installed. Use it for all password hashing.

## Living Brief specifics
- CLAUDE.md, VISION.md, PLUGIN.md, QUALITY.md, and OPEN_LOOP.md are owned/hand-edited by AI partners and Roberto.
- PLATFORM.md and STATUS.md may be generated/updated by Replit or build tooling.
- AUDIT.md is append-only audit history.
- PLATFORM.md is AUTO-GENERATED at build time by
  `artifacts/api-server/scripts/generate-platform-md.ts`. Do not hand-edit PLATFORM.md.
  Edit the generator instead; manual edits are overwritten on build.
- Living Brief docs are served by `artifacts/api-server/src/routes/living_brief.ts` under
  `/api/v1/living-brief/*`, gated by password plus eligibility check:
  super admin OR `users.can_access_living_brief`.
- Only a super admin can change the gate password or grant/revoke access.
- F5 ONLY routes eligible admins to `/living-brief`; Ctrl+R / Cmd+R remains normal refresh.
- PLUGIN.md holds the full Navisworks plugin reference and is not auto-generated.
- QUALITY.md holds the BIMLog Quality 4.0 doctrine derived from the Calidad 4.0 source
- OPEN_LOOP.md is the active unfinished-work register. Add anything not completed in the current task, move shipped work to Watching/Closed with commit or version notes, and read it at the start of every new task.
  material. Read it before product, UX, report, AI, data, audit, and plugin decisions.

## AI / model / cost patterns
- Roberto's internal/test users may use the platform Anthropic/Replit-backed key path.
- External users should move toward user-owned AI keys or a controlled included-credit model.
- AI usage must be logged per user, project, feature, billing mode, and credit unit.
- Super admin must be able to see AI usage by user, feature, project, and month.
- Expensive file-reading AI must be separate from cheap text assistance. Use explicit user
  confirmation before file-reading AI.
- Description/email assistance can be offered as lightweight AI, but still logged.
- If a user has not connected their own AI key and a feature would consume platform credits,
  show a clear warning before running.

## Database patterns
- Replit dual-database: shell/CLI may connect to `helium` dev DB. The app runtime connects
  to Neon production through `PROD_DATABASE_URL`.
- Never diagnose real production data by querying helium.
- Always confirm `PROD_DATABASE_URL` target before drawing production data conclusions.
- lens_viewpoints dedup: by `viewpoint_id`.
- `navisworks_guid` is normalized to null when zeros.
- lens_viewpoints active-scoped partial unique index:
  `(project_id, display_id) WHERE lifecycleStatus='active' AND display_id IS NOT NULL`.
- A display_id collision returns:
  `{success:true, skipped:true, reason:"display_id_collision", id:null}`.
  id is deliberately null so the client cannot mis-bind to a row it did not create.
- lens_viewpoints revision system:
  - Edit and Reassign create a NEW row, never mutate in place.
  - Old row becomes `superseded`.
  - New row gets revisionNumber old+1 and supersedesId old.id.
  - Edit inherits the same tradeFloorSeq.
  - Reassign draws a fresh number from the new trade's counter.
  - Void has the same active-only guard as Edit/Reassign.
- GET `/projects/:projectId/clash-reports/lens-viewpoints/:id/active` resolves a stale id
  to the real current chain tip.

## Navisworks plugin patterns - formats / config
- Plugin config: `%APPDATA%\BIMLog\config.json`.
- Debug/error log: `%APPDATA%\BIMLog\pending_action_error.log`.
- Plugin debug log must also mirror live in the panel when available.
- Viewpoint ID format: `{6 chars NWF filename}{6 chars GUID fragment}`, e.g. `1185RI-F70F14`.
- Jump to Viewpoint uses `/jump?code=displayId`, not `/jump/guid`.
- GUIDs are often null/zero in DB. Always jump by displayId.
- Build: AnyCPU, .NET Framework 4.8.
- Navisworks 2021 production path: `C:\Dev\BIMLogPlugin\BIMLogNavisPlugin`.
- Navisworks 2025 Ruben path: `H:\BIMLogPlugin2025`.
- Use version naming `v1.60.6`, `v1.60.7`, `v1.60.8`, etc. for plugin releases.

## Navisworks API lessons - never repeat these
- SavedItemCollection uses `.Add()` not `.AddCopy()`.
- GroupItem has no public constructor. Use `existingGroupItem.CreateCopyWithoutChildren()`.
- `doc.SavedViewpoints.AddCopy(folder, vp)` adds a viewpoint to a folder.
- `doc.SavedViewpoints.AddComment(vp, comment)` adds a comment.
- Comment constructor: `new Comment(body, CommentStatus.Active/Approved/Resolved)`.
- `Application.Idle` fires on the main thread and is safe for UI/navigation.
- Always queue Navisworks UI calls on the main thread.
- `set_CurrentSavedViewpoint` navigates to a saved viewpoint.
- Never call UI operations from background threads.
- `vp.Guid` returns all-zeros for viewpoints saved in previous sessions. Always jump by displayId.
- HttpListener works for local HTTP server on `localhost:8765`.
- Use DockPanePlugin, not DockableWindowPlugin.
- PlaceholderText is not available on .NET Framework 4.8 TextBox.
- Always reflect the DLL before assuming method names:
  `$dll.GetTypes() | GetMethods()`.
- Navisworks Color conflicts with System.Drawing.Color. Use a Drawing alias.
- Do NOT change GenerateFingerprint; it orphans existing rows.
- Do NOT delete clashes server-side between syncs; the plugin re-pushes everything.
- Plugin uses no-cors from HTTPS platform to `localhost:8765`. This is correct.
- Never use regex replace on method-level C# code. Rewrite the entire method/file cleanly.
- Always build AnyCPU, not x64.
- Always use HttpWebRequest inside the plugin. Never HttpClient or WebClient.
- Always use InvariantCulture for decimals. Spanish locale uses comma separator.
- `SavedViewpoint.CreateUniqueCopy()` inherits the entire comment history. Any "latest field"
  reader must use last-match-wins logic across all comments.
- A SavedViewpoint reference can stop matching by reference equality after tree operations.
  Match by DisplayName or stable metadata instead of `==`.
- Renaming a viewpoint after server round-trip can throw `Object is Read-Only`. Create/write
  the new visible record first, then attempt old-object rename in its own try/catch.
- Lens Edit endpoint is PATCH, not POST.

## Plugin files - complete list
- BIMLogPlugin.cs - entry point, DisplayName = BIMLog Pulse.
- ClashReader.cs - reads clashes, ClashData class.
- ClashTriage.cs - P1-P5, GUID fingerprint, trade detection.
- BIMLogApiClient.cs - HttpWebRequest, batch push, lens sync, Edit/Void/Reassign calls.
- BIMLogSyncForm.cs - Push/Pull/Open/Settings, F2 debug.
- SettingsForm.cs - URL, Email, Password, Project ID.
- PluginConfig.cs - config.json, sequence.json, synced_viewpoints.json, trade_floor_sequence.json,
  levels_cache.json.
- BIMLogLensPlugin.cs - DockPanePlugin.
- BIMLogLensButton.cs - AddInPlugin button launches the Lens panel.
- BIMLogLensPanel.cs - full panel: SaveViewpoint, SyncWithBIMLog, RefreshCounter, Manage Existing
  Viewpoint lifecycle system, live debug log, Active/History split.
- BIMLogLocalServer.cs - HTTP server on localhost:8765: ping, jump?code=displayId, jump-by-name.

## Three sync tools
- BIMLog Pulse - working - clash hits sync - DisplayName = BIMLog Pulse.
- BIMLog Lens - working - viewpoint sync, lifecycle system, Jump to Viewpoint.
- BIMLog Mirror - planned - bidirectional clash-detect sync using Navisworks Clash API.

## Replit instruction format - mandatory every time
When writing an instruction for Roberto to paste into Replit:
- Single code block so Roberto can click the copy icon.
- Opens with: STOP. DO NOT TOUCH ANYTHING. DO NOT START ANY PLAN.
- Plain English, file by file. No numbered steps and no markdown headers inside the block.
- Checks using grep/find at the end.
- Mandatory mojibake check: `pnpm run check:mojibake`.
- Mandatory rebuild: `rm -rf artifacts/api-server/dist && cd artifacts/api-server && pnpm build 2>&1 | tail -3`.
- Rebuild both apps when frontend and backend both changed.
- Restart the API server after every backend rebuild.
- Publish only after all checks pass and Roberto explicitly wants publish.
- Print all check outputs as plain text. No collapsed boxes.
- Always ask Replit what it has already built before writing an instruction.
- Never direct Replit on implementation. Give context and goals; let Replit decide.

## What never to do
- Never add mock/placeholder data or silent try/catch fallbacks that hide failures.
- Never use emojis or non-lucide icons.
- Never change a schema in only one of the two required places.
- Never register a parameterized route before a sibling literal route.
- Never hand-edit PLATFORM.md.
- Never change GenerateFingerprint.
- Never delete clashes server-side between syncs.
- Never call Navisworks UI operations from a background thread.
- Never let plugin/platform invent independent display conventions for the same lifecycle data.
- Never push, publish, or rebuild production if `pnpm run check:mojibake` fails.

## BIMLog Quality Standard - mandatory on every build
QUALITY.md is the doctrine behind this standard. It makes Calidad 4.0 operational inside
BIMLog: spreadsheet-simple field workflows, clean structured data, traceable decisions,
human-reviewed AI, exportable evidence, audit-ready reports, and future digital-twin
readiness. Do not treat quality as visual polish only; quality is the full chain from data
capture to decision to report to audit trail.

### PDF Reports
- Every PDF has a cover page for formal documents or branded running header for logs.
- Every PDF has company logo via getCompanyLogo.
- Every PDF has page numbers Page X of Y using bufferedPageRange and switchToPage.
- Every PDF has a consistent footer: BIMLog by IgniteSmart, timestamp, report number.
- Every PDF has SHA-256 fingerprint of the data snapshot on the last page.
- Monochrome design only: navy section header bars (#1E3A5F), white content, alternating
  light grey rows (#F8FAFC), black text throughout.
- No color badges anywhere. Priority and status are plain text.
- Consistent column widths. No text wrapping mid-word.
- Use shared pdf-kit.ts helpers. Never bespoke inline PDF implementations.
- Cover for Coordination Report, Audit Certificate, Dispute Report, Tracking Reports.
- Branded running header for RFI Log, Submittal Log, Change Order Log, Transmittal Log.
- Lens Viewpoints reports default to active/current rows unless explicitly configured otherwise.
- Revision/history appendix must be scoped to the report's own chains, never the whole project.

### Platform UI
- Consistent column widths in all tables. No text wrapping mid-word.
- Consistent header style across all modules.
- Consistent action button placement per row.
- Consistent status labels platform-wide.
- Consistent empty states for every table.
- Consistent error messages. Never show raw database errors to users.
- Lifecycle/chain attributes get their own columns with show/hide toggles.
- Use "State" for user-facing lifecycle column language unless developer context requires lifecycle.
- User guidance should be easy to turn on/off and should explain the correct workflow without
  blocking expert users.

### Excel exports
- Branded header row with BIMLog by IgniteSmart and project name.
- Consistent column structure per module.
- No raw database field names as column headers.
- Auto-sized columns. No truncated content.
- Respect the same filters/scope as the live table and PDF.
- Exports must be professional enough to send to a client without manual cleanup.

### Terminology
- Priority labels: P1 Critical, P2 High, P3 Medium, P4 Low, P5 Monitor.
- Status labels: Open, Follow Up, Waiting Design, Approved, Resolved.
- Never use database field names in UI or reports.

## Current product direction
- BIMLog must become easier than a spreadsheet plus a folder full of PDFs, while keeping BIM,
  Navisworks, reporting, and AI coordination intelligence connected.
- Submittals should feel like one integrated module with views: Submittals, Register, Tracking
  Table. Tracker is a live view/report, not a separate product concept.
- Schedule should be a coordination schedule: RFI dates, submittal dates, manual milestones,
  calendar view, board view, list view, and clear editing.
- AI should assist without surprising users with cost. Cheap text assist and expensive file reading
  are separate actions.
- Platform should move toward structured data that supports decisions, not just stored documents.
