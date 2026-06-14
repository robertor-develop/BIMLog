# CLAUDE.md — How Claude Must Behave on BIMLog

This file is the operating manual for any AI development partner (Claude / Replit Agent)
working on BIMLog. Read it at the start of every session before making changes.

## Who / What
- Product: BIMLog, a construction coordination platform.
- Owner: Roberto Rodriguez, CEO of BIMCapital Partners INC / IgniteSmart.
- Primary field user: Ruben Crespo (rubenc@bimcorpgroup.com), first Founding Partner.
- This is a multi-session build. Context is preserved through the four Living Brief
  documents in this folder: CLAUDE.md, PLATFORM.md, STATUS.md, VISION.md.

## Owner preferences (hard rules)
- NO emojis anywhere — UI, code, comments, commit messages.
- Icons: lucide-react only. No other icon sets, no emoji icons.
- NO mock data and NO silent fallbacks. If something fails, fail loudly and explicitly.
- Prefer plain-text raw output. Do not hide output in collapsed boxes.
- Be terse. Do not over-explain.

## Architecture rules
- Monorepo: pnpm workspaces. See PLATFORM.md for the full map.
- Backend API is Express; every route is mounted under the global prefix `/api/v1`.
  - res.redirect in route files MUST include the `/api/v1` prefix or it 404s.
- Schema lives in `lib/db/src/schema/*` (drizzle). Every schema change must be made in
  BOTH the drizzle schema file AND the idempotent startup migration block in
  `artifacts/api-server/src/app.ts` (ALTER TABLE / CREATE TABLE ... IF NOT EXISTS).
- Route ordering: literal sub-paths (e.g. `.../lens-pull`, `.../plugin-pull`) MUST be
  registered before parameterized catch-alls like `.../:reportId`, which have no NaN guard.
- Soft-delete DELETE routes live inside their feature route files, not a separate file.
- Frontend is React + Vite + wouter. Protected pages use the `ProtectedRoute` wrapper
  (reads token from `useAuthStore`, redirects to `/login`).
- bimlog build requires PORT to be set: `PORT=3000 pnpm build`.
- api-server builds to `dist/index.cjs` via esbuild (`pnpm build` runs `build.ts`). The
  ~3.3mb bundle-size warning is normal. Restarting the API re-runs the migration block.

## Auth model
- JWT Bearer tokens. Payload carries `isSuperAdmin`.
- `authMiddleware` verifies the token; `isSuperAdminMiddleware` re-checks `users.is_super_admin`.
- Super admin is the boolean column `users.is_super_admin` (data-driven, not a hardcoded email).
- Super admins bypass project membership checks (`requireProjectMember`).
- Admin routes pattern: `router.get("/admin/...", authMiddleware, ...)`.
- bcryptjs is already installed — use it for all password hashing.

## Living Brief specifics
- The four docs are served by `artifacts/api-server/src/routes/living_brief.ts` under
  `/api/v1/living-brief/*`, gated by a password (default seeded as a bcrypt hash) plus an
  eligibility check (super admin OR `users.can_access_living_brief`).
- Only a super admin can change the gate password or grant/revoke access.
- F5 ONLY (not Ctrl+R / Cmd+R) routes eligible admins to `/living-brief`; everyone else
  gets a normal browser refresh.
- PLATFORM.md is AUTO-GENERATED at build time by
  `artifacts/api-server/scripts/generate-platform-md.ts` (wired into `build.ts`). Do not
  hand-edit PLATFORM.md — edit the generator instead; manual edits are overwritten on build.

## AI / model patterns
- AI model: `claude-sonnet-4-5` (NOT `claude-sonnet-4-20250514` or any other variant).
- AI proxy: `http://localhost:1106/modelfarm/anthropic`.

## Database patterns
- Replit dual-database: the shell connects to `helium` (dev, empty). The app connects to
  the Neon PRODUCTION DB. Never confuse them. To inspect real data ALWAYS query the Neon
  production DB directly via shell — dev helium is empty.
- lens_viewpoints dedup: by `viewpoint_id`. `navisworks_guid` is normalized to null when zeros.

## Navisworks plugin patterns (formats / config)
- Plugin config: `%APPDATA%\BIMLog\config.json`.
- Viewpoint ID format: `{6 chars NWF filename}{6 chars GUID fragment}`, e.g. `1185RI-F70F14`.
- Viewpoint name format: `{displayId} | {tradeShort} | {reportType} | {floor} | {priority} | {note}`.
- NWF comment format: JSON with `source:BIMLogLens` marker.
- Jump to Viewpoint uses `/jump?code=displayId` — NOT `/jump/guid`. GUIDs are null in DB.

## Navisworks API lessons — NEVER REPEAT THESE
- SavedItemCollection uses `.Add()` not `.AddCopy()`.
- GroupItem has no public constructor — use `existingGroupItem.CreateCopyWithoutChildren()`.
- `doc.SavedViewpoints.AddCopy(folder, vp)` to add a viewpoint to a folder.
- `doc.SavedViewpoints.AddComment(vp, comment)` to add a comment.
- Comment constructor: `new Comment(body, CommentStatus.Active/Approved/Resolved)`.
- `Application.Idle` fires on the main thread — safe for UI/navigation — ALWAYS queue UI calls here.
- `set_CurrentSavedViewpoint` navigates to a saved viewpoint.
- NEVER call UI operations from background threads — it crashes Navisworks.
- `vp.Guid` returns all-zeros for viewpoints saved in previous sessions — ALWAYS jump by
  displayId, not GUID.
- HttpListener works for a local HTTP server on `localhost:8765`.
- DockPanePlugin, not DockableWindowPlugin.
- PlaceholderText is not available on .NET Framework 4.8 TextBox.
- Always reflect the DLL before assuming method names: `$dll.GetTypes() | GetMethods()`.
- Navisworks Color conflicts with System.Drawing.Color — use a Drawing alias.
- Do NOT change GenerateFingerprint — it orphans existing rows.
- Do NOT delete clashes server-side between syncs — the plugin re-pushes everything.
- Plugin uses no-cors from the HTTPS platform to `localhost:8765` — this is correct, not a bug.
- NEVER use regex replace on method-level C# code — rewrite the entire file cleanly.
- ALWAYS build AnyCPU, not x64 — Navisworks is a 32-bit host.
- ALWAYS use HttpWebRequest inside the plugin — never HttpClient or WebClient.
- ALWAYS use InvariantCulture for decimals — the Spanish locale uses a comma separator.

## Plugin files — complete list
- BIMLogPlugin.cs — entry point, DisplayName = BIMLog Pulse.
- ClashReader.cs — reads clashes, ClashData class.
- ClashTriage.cs — P1-P5, GUID fingerprint, trade detection.
- BIMLogApiClient.cs — HttpWebRequest, batch push, lens sync.
- BIMLogSyncForm.cs — Push/Pull/Open/Settings, F2 debug.
- SettingsForm.cs — URL, Email, Password, Project ID.
- PluginConfig.cs — config.json, sequence.json, synced_viewpoints.json.
- BIMLogLensPlugin.cs — DockPanePlugin.
- BIMLogLensButton.cs — AddInPlugin button launches the Lens panel.
- BIMLogLensPanel.cs — full panel, SaveViewpoint, SyncWithBIMLog, RefreshCounter.
- BIMLogLocalServer.cs — HTTP server on localhost:8765: ping, jump?code=displayId, jump-by-name.

## Three sync tools
- BIMLog Pulse — WORKING — clash hits sync — DisplayName = BIMLog Pulse.
- BIMLog Lens — WORKING — viewpoint sync, Jump to Viewpoint via `localhost:8765/jump?code=displayId`.
- BIMLog Mirror — PLANNED — full bidirectional clash-detect sync using the Navisworks Clash
  API (ClashTest, ClashResult, ClashResultStatus, DocumentClash, DocumentExtensions are all available).

## Replit instruction format — MANDATORY every time
When writing an instruction for Roberto to paste into Replit:
- Single code block so Roberto can click the copy icon.
- Opens with: STOP. DO NOT TOUCH ANYTHING. DO NOT START ANY PLAN.
- Plain English, file by file — no numbered steps, no markdown headers inside the block.
- Checks using grep/find at the end.
- MANDATORY rebuild: `rm -rf artifacts/api-server/dist && cd artifacts/api-server && pnpm build 2>&1 | tail -3`.
- Rebuild BOTH apps when frontend and backend both changed.
- Restart the API server after every backend rebuild.
- Publish after all checks pass.
- Print ALL check outputs as plain text. No collapsed boxes.
- ALWAYS ask Replit what it has already built before writing any instruction.
- NEVER direct Replit on implementation — give context and goals, let Replit decide.

## What never to do
- Never add mock/placeholder data or silent try/catch fallbacks that hide failures.
- Never use emojis or non-lucide icons.
- Never change a schema in only one of the two required places.
- Never register a parameterized route before a sibling literal route.
- Never hand-edit PLATFORM.md (it is regenerated on every build).
- Never change GenerateFingerprint or delete clashes server-side between syncs.
- Never call Navisworks UI operations from a background thread.
