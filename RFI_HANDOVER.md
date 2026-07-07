# RFI Module — Handover for Codex

This document is a complete, self-contained brief to continue the RFI rebuild in
BIMLog. Read it fully before touching code.

---

## 0. THE #1 THING TO KNOW FIRST

All the RFI work described below is **already committed and pushed to
`origin/master`** (GitHub `robertor-develop/BIMLog`, tip `6c1c997`). If the live
app still shows old behaviour (e.g. the "triple" status strip, ball-in-court
"Reviewer" on an unsent draft), it is because **the live Replit deployment has
not pulled + republished** — NOT because the fixes don't exist.

**To make the fixes live:** in Replit, pull `origin/master`, then republish.

**PUBLISH HAZARD (critical):** Replit diffs an unused dev DB against prod and can
generate `DROP TABLE`/`DROP COLUMN` migrations for runtime-created tables.
On the publish preview:
- `ADD COLUMN` / `CREATE TABLE IF NOT EXISTS` → **safe, approve**.
- Any `DROP TABLE` / `DROP COLUMN` → **CANCEL** (it would wipe prod data).

---

## 1. Repo / build / conventions

- **Monorepo**, pnpm workspaces.
  - `artifacts/api-server` — Express API.
  - `artifacts/bimlog` — React + Vite + wouter frontend.
  - `lib/db` — Drizzle schema.
  - `lib/api-zod` + `lib/api-client-react` — orval-generated **but HAND-MAINTAINED**.
- **DO NOT run orval codegen.** The generated files in `lib/api-zod` and
  `lib/api-client-react` carry fields the OpenAPI spec no longer has. Running
  codegen (`clean:true`) DELETES those fields. To add an API field, **hand-edit**
  the generated files (`api.ts`, `api.schemas.ts`). The backend also parses
  request bodies with the api-zod schema server-side, so a new field must be
  added to the zod schema or it is stripped.
- **Migrations:** additive only, added as `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS` / `CREATE TABLE IF NOT EXISTS` in `artifacts/api-server/src/app.ts`.
  New tables must ALSO be added to the Drizzle schema (so `drizzle push` keeps
  dev+prod in sync and never diffs them as "to drop").
- **Verification (frontend & api-server both have MANY pre-existing type
  errors and still deploy):** the gate is *no NEW errors in files you touched*.
  - Libs must be fully clean: `npx tsc --build lib/db lib/api-zod lib/api-client-react` (exit 0).
  - Per app: `npx tsc -p artifacts/bimlog --noEmit` / `-p artifacts/api-server`,
    then `grep` the output for only the files you changed.
  - The frontend **cannot be run locally** in this environment; rely on tsc.
- **Owner rules (hard):** NO emojis anywhere. Icons: `lucide-react` only. NO mock
  data and NO silent fallbacks. Be terse.

---

## 2. Key files

| Area | File |
|---|---|
| RFI list + create + detail (one big file) | `artifacts/bimlog/src/pages/project/RfisTab.tsx` |
| RFI API | `artifacts/api-server/src/routes/rfis.ts` |
| Linked items panel | `artifacts/bimlog/src/components/LinkedItemsPanel.tsx` |
| Per-user connections API (SendGrid + OAuth) | `artifacts/api-server/src/routes/connections.ts` |
| OAuth engine (provider config, token refresh) | `artifacts/api-server/src/lib/oauth.ts` |
| Cloud file browse/download (WIP, unwired) | `artifacts/api-server/src/lib/cloud-files.ts` |
| Per-user connect UI | `artifacts/bimlog/src/pages/Profile.tsx` |
| Email templates + `getAppUrl()` | `artifacts/api-server/src/lib/email.ts` |
| Schemas | `lib/db/src/schema/{rfis,files,user-connections}.ts` |

`RfisTab.tsx` structure: `RfisTab` (list + stats strip) → early-returns to
`RfiCreatePanel` or `RfiDetailPanel` (both are **full pages, not modals**).
`GoogleDrivePicker` is a sub-component at the bottom of the file.

---

## 3. What the user asked for, and status

Legend: ✅ done & pushed · ⚠️ partially done · ❌ open.

### RFI page/UX (mostly ✅ in commits, appear after publish)
- ✅ RFI opens as a **full page with a Back button**, not a modal/side-panel.
- ✅ Everything editable in place (title, parties, question, cost/schedule,
  attachments, type, CC, viewpoint label).
- ✅ Roles fixed: creator = Submitted By (asker); recipient = Submitted To with a
  Directory pick-or-add.
- ✅ Smart context-aware AI for the question; asks `NEED_MORE_INFO:` if too thin
  instead of inventing (`POST /rfis/generate-question`).
- ✅ Email section at the very bottom; **type-first** — "Compose email" opens a
  context box and the AI only runs on "Generate with AI" (commit `5f23ad0`).
- ✅ Viewpoint image + customizable viewpoint label (`0cdbe21`).
- ✅ Linked items: **clash separated** from documents; "Create" opens the target
  module in a new tab (`5f23ad0`, `LinkedItemsPanel.tsx`).
- ✅ RFI Types badge/select (fixed list `RFI_TYPES`).
- ✅ Status strip (Lens-style), status auto-advance on send, activity timeline,
  PDF prints the real RFI (`54aff91`).
- ✅ "Raise Change Order from RFI" (`d13864f`).

### The two bugs in the latest screenshots
- ✅ **Triple status strip** — FIXED in `ca70daf`. `getOptions("rfi_status")`
  returns duplicate rows; both `statusOptions` (list) and `allStatusOptions`
  (detail) now dedupe by value: `[...new Map(getOptions("rfi_status").map(o => [o.value, o])).values()]`.
  If it still triples after publish, the `config_options` table literally has 3
  rows for each status — the UI dedupe handles same-`value` dupes; to clean the
  data, de-dupe `config_options` where `category='rfi_status'`.
- ✅ **Ball-in-court "Reviewer" on an unsent draft** — FIXED in `ca70daf`.
  `getBallInCourt()` now returns `"<author> — to send"` (amber) when
  `sendStatus !== "sent" && !sentAt`, only flipping to the reviewer after send.

### Per-user integrations (the big new architecture)
- ✅ `user_connections` table (one row per user+provider; credentials
  server-side only) — `cabea4f`.
- ✅ **SendGrid per-user**: connect in Profile (validated), then a real **Send
  via SendGrid** button on the RFI that sends through the author's own key and
  auto-marks-sent; dismissible "connect" nudge otherwise (`cabea4f`, `a72feca`).
- ✅ **AI document import**: New-RFI "Import document" dropzone reads a
  PDF/Word/Excel/image and prefills the form for review
  (`POST /rfis/import-prefill`, `540b3b2`).
- ✅ **Upload attachments from computer** on create + detail question + response
  (`POST /rfis/attachments/upload`, `2fd4b4f`).
- ✅ **OAuth self-service engine** for Google Drive, Dropbox, BIM 360/Autodesk,
  Procore — one authorize + one callback route drive all four; per-user token
  storage + refresh (`lib/oauth.ts`, `195532c`, `90fdbe9`). Profile → "File
  Sources & Integrations" has Connect/Disconnect for each.
- ✅ **Google Drive file picker** end-to-end: browse/search + import into an RFI
  attachment (`d7d3c46`).

### STILL OPEN ❌ / ⚠️ (this is what to finish)
1. ❌ **Cloud file pickers for Dropbox / BIM 360 / Procore.** The connect flow
   works and the download/browse **library is written** in
   `artifacts/api-server/src/lib/cloud-files.ts` (`browseCloud`,
   `downloadCloud`, unified `CloudItem { name, type, ref, mimeType?, size? }`),
   but it is **NOT wired** to any route or the frontend. See §4 for the exact,
   already-designed plan (I built it, then reverted to keep a publishable state).
   Dropbox is clean; BIM 360 (APS) and Procore are hierarchical and **unverified
   against real accounts** — expect to tune their API calls.
2. ❌ **Impact layout adjacency.** The user wants the response's Cost/Schedule
   Impact bullets to sit next to the read-only "Impact — flagged by asker"
   block, not far down in the response form. Currently the read-only impact is
   at the top of the response area and the editable radios are deep in the
   response form. He was asked how to merge them and did not pick — needs a
   product decision then a move within `RfiDetailPanel`.
3. ⚠️ **Save/Submit buttons.** "Submit Response" was renamed **Save Response**
   and moved to the very bottom, below the email (`659b7b9`). The RFI-field
   "Save" (edit mode) is still separate. The user leans toward one final save at
   the bottom that persists the whole page — not yet unified.
4. ⚠️ **RFI Types editable/config-driven** — currently a fixed `RFI_TYPES`
   module const in `RfisTab.tsx`. Make it a config-driven, editable list.
5. ❌ **Composite editable RFI numbering** (low priority) — number is editable at
   create time only; the PATCH does not accept `number`.

---

## 4. EXACT plan to finish the cloud file pickers (§3 item 1)

The library is done. Wire it like this (this is the design that was built then
reverted; redo it cleanly and keep the existing Google Drive endpoints OR
migrate all providers to the generic ones — do not delete the old endpoints
without updating the frontend, or the live Drive picker breaks).

### Backend
`connections.ts` — add a generic browse (keep `getValidAccessToken` import; add
`import { browseCloud } from "../lib/cloud-files"`):
```ts
router.get("/me/connections/:provider/browse", authMiddleware, async (req, res) => {
  const key = providerFromParam(String(req.params.provider));
  if (!key) { res.status(404).json({ error: "Unknown provider" }); return; }
  try {
    const result = await browseCloud(req.user!.userId, key, String(req.query.ref || ""), String(req.query.q || "").trim());
    res.json(result); // { items: CloudItem[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to browse files";
    res.status(msg === "not_connected" ? 428 : 502).json({ error: msg });
  }
});
```
`rfis.ts` — add a generic import (import `providerFromParam` from `../lib/oauth`
and `downloadCloud` from `../lib/cloud-files`):
```ts
router.post("/projects/:projectId/rfis/attachments/from-cloud",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const { provider, ref, fileName, mimeType, rfiId } = req.body;
    const key = provider ? providerFromParam(provider) : null;
    if (!key || !ref || !fileName) { res.status(400).json({ error: "provider, ref and fileName are required" }); return; }
    try {
      const { buffer, exportedPdf } = await downloadCloud(req.user!.userId, key, ref, mimeType);
      const finalName = exportedPdf && !/\.pdf$/i.test(fileName) ? `${fileName}.pdf` : fileName;
      const ext = (finalName.split(".").pop() || "").toLowerCase();
      const storagePath = await storage.upload(buffer, projectId, `rfi-attach-${Date.now()}-${finalName}`);
      const defaultFileStatus = await getDefaultValue("file_status");
      const [row] = await db.insert(filesTable).values({
        projectId, fileName: finalName, fileSize: buffer.length, fileType: ext || "bin",
        status: defaultFileStatus, uploadedById: req.user!.userId, source: "rfi-attachment",
        storagePath, linkedRfiId: rfiId ? Number(rfiId) : null,
      }).returning();
      res.json({ fileId: row.id, fileName: finalName, downloadUrl: `/api/v1/projects/${projectId}/files/${row.id}/download?name=${encodeURIComponent(finalName)}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      res.status(msg === "not_connected" ? 428 : 500).json({ error: msg });
    }
  });
```
NOTE: `req.params.provider` types as `string | string[]` in this codebase — wrap
with `String(...)` or tsc fails.

### Frontend
Generalize `GoogleDrivePicker` (bottom of `RfisTab.tsx`) into a `CloudPicker`
with folder navigation:
- props: `provider` (param string like `"google-drive"`), `providerLabel`,
  `projectId`, `rfiId?`, `lang`, `onAttached`, `onClose`.
- keep a breadcrumb stack `{name, ref}[]` starting `[{name: providerLabel, ref: ""}]`.
- `GET /me/connections/${provider}/browse?ref=<cur.ref>&q=<q>` → `{items}`.
- folder click → push `{name, ref}` and reload; breadcrumb click → slice + reload.
- file click → `POST /projects/:id/rfis/attachments/from-cloud`
  `{ provider, ref: item.ref, fileName: item.name, mimeType: item.mimeType, rfiId }`
  → push returned `downloadUrl` into the attachment array.
- In `RfiCreatePanel` and `RfiDetailPanel`, replace the single `gdConnected`
  check with the list of connected file-source providers (fetch
  `GET /me/connections`, keep the ones whose `provider` is in
  `["google_drive","dropbox","bim360","procore"]` and `status === "connected"`),
  and render one **"From <label>"** button per connected provider next to the
  Upload button. A module const already exists for the mapping:
  `FILE_SOURCE_PROVIDERS = [{key:"google_drive",param:"google-drive",label:"Google Drive"}, {dropbox}, {bim360}, {procore}]`.
- Attachment list items already render as clickable links via the `isUrlAttach`
  / `attachLabel` helpers; keep using them.

### Verify BIM 360 / Procore against real accounts
`cloud-files.ts` implements APS (hubs→projects→topFolders→folder contents, then
OSS `signeds3download`) and Procore (companies→projects→folders endpoint, then
`/files/:id`). These are written to documented behaviour but **not tested**;
tune field paths when real credentials exist.

---

## 5. One-time platform OAuth config (operator sets once; then all users self-connect)

Each provider needs ONE app registered by the platform operator; the client
id/secret go in server env. Redirect URI = `${BIMLOG_URL}/api/v1/connections/<param>/callback`.

| Provider | Env vars | Redirect param |
|---|---|---|
| Google Drive | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `google-drive` |
| Dropbox | `DROPBOX_CLIENT_ID` / `DROPBOX_CLIENT_SECRET` | `dropbox` |
| BIM 360 (Autodesk APS) | `APS_CLIENT_ID` / `APS_CLIENT_SECRET` | `bim360` |
| Procore | `PROCORE_CLIENT_ID` / `PROCORE_CLIENT_SECRET` | `procore` |

SendGrid is per-user (each user pastes their own API key in Profile); it needs no
platform env var.

Until a provider's two env vars are set, its Connect button returns 503
("not enabled yet") — this is intentional, not a bug.

---

## 6. Commit map (all on `origin/master`, newest first)

```
6c1c997 WIP: cloud-files lib (Dropbox/BIM360/Procore browse+download)  <- unwired
d7d3c46 Google Drive file picker into RFI attachments
90fdbe9 OAuth engine: Dropbox, BIM360/Autodesk, Procore self-service connect
195532c Slice 4b: Google Drive per-user self-service OAuth connect
2fd4b4f RFI slice 4a: upload attachments from your computer
540b3b2 RFI slice 3: AI document import to prefill the create form
a72feca RFI SendGrid slice 2: connect UI + real per-user Send
cabea4f Add per-user connections foundation + SendGrid connect
659b7b9 RFI: rename to Save Response, move to bottom below email
5f23ad0 RFI: email type-first + linked items rework
ca70daf RFI: fix ball-in-court for drafts + dedupe status strip
d13864f RFI: raise Change Order from RFI
0cdbe21 RFI: customizable source-viewpoint label
```
