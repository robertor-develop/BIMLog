# PLUGIN.md — BIMLog Lens Navisworks Plugin Reference

Owned/hand-edited. This disk copy is the seed; the in-app Living Brief serves PLUGIN.md from
the DB, so after editing here also "Paste to Update" in-app to refresh the shown version.

## Governance and acceptance

[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md) is the permanent product-doctrine authority
beneath Roberto's explicit current instruction. This document owns Navisworks plugin architecture,
2021/2025 source synchronization, build, packaging, and field-verification rules. Apply
[QUALITY.md's Evidence and Release Quality Gate](./QUALITY.md#evidence-and-release-quality-gate),
including separate source, build, package, installation, live, and field-verification states.
When a plugin decision implicates standards metadata, applicability, evidence expectations, or
claims, use [STANDARDS_REGISTER.md](./STANDARDS_REGISTER.md); do not infer compliance from similar
behavior.

## Build + versioning + packaging
- Two physical builds must be reviewed and synchronized together. Preserve the documented,
  intentional `BIMLogLensPanel.cs` differences and the different `.csproj` DLL references while
  keeping shared behavior aligned:
  - Navisworks 2021: `C:\Dev\BIMLogPlugin\BIMLogNavisPlugin` (Roberto's machine). Deploy:
    close all `*Navis*`/`*Roamer*` processes, then copy `bin\Debug\net48\*.dll/.pdb` into
    `C:\Program Files\Autodesk\Navisworks Manage 2021\Plugins\BIMLogNavisPlugin\`.
  - Navisworks 2025: `H:\BIMLogPlugin2025` (Ruben's machine). Refs in `H:\...\refs\`.
- Build: AnyCPU, .NET Framework 4.8, `dotnet build -c Debug`.
- Semantic versioning v1.6.x. Package with `H:\BIMLogPlugin2025\Build-Package-2025.ps1
  -Version vX.Y.Z` — it builds the 2025 DLL and zips DLL+PDB+install.ps1+Install_BIMLog_2025.bat
  +README_BIMLog_Lens.txt+BIMLog_Lens_Revision_Update_vX.Y.Z.txt. Every release: update the
  README revision + write a per-revision update .txt covering the delta. Current: v1.6.3.
  Shared logic in `BIMLogLensPanel.cs` + `BIMLogApiClient.cs` must be reviewed in both physical
  copies for every shared change; preserve intentional version-specific differences.

## The shared display contract (DONE — was the big open item)
Plugin viewpoint DisplayName and the platform table use the SAME clean field set. Plugin name:
`ID | Trade-Seq | [R{n}] | [SUPERSEDED->successor / VOIDED] | ReportType | Floor | Priority |
Note[RL] | [G:xxxx] | [<-predecessor]`
- `R{n}` only if revision > 1; lifecycle marker only if not active; `G:xxxx` = first 4 hex of
  issueGroupId (same token the platform Group column shows); `<-predecessor` on reassign copies
  shows the code it superseded.
- Who/why/when/reason NEVER goes in the name — it is written as a plain-text `[BIMLog history]`
  comment (no `"source":"BIMLogLens"` tag, no `"note":`) so GetMergedMeta/GetMetaComment ignore it.

## Lifecycle metadata
Every viewpoint's state lives in Navisworks Comments (JSON tagged `"source":"BIMLogLens"`),
merged via `GetMergedMeta()` (last-write-wins per field). Fields: note, trade,
responsibleCompany, reportType, floor, priority, openItems, displayId, issueGroupId,
localLifecycle, pendingAction, pendingReassignTrade, reassignReason, localPlaceholderId,
pendingNote, localSupersedesId, revisionNumber, tradeFloorSeq, serverId. `serverId` is written
by a sync receipt comment (last-match wins via GetLatestServerId).

## Edit / Void / Reassign
- Require a non-empty reason (blocking MessageBox). Block if not active. ConfirmIfGrouped first.
- SYNC-FIRST GUARDRAIL: if the viewpoint has no serverId, a "Sync required first" popup offers
  Sync now / offline anyway / Cancel — no more silent offline queuing (that was the root cause
  of the duplication/mess). Online path uses the action endpoint (Edit=PATCH, Void/Reassign=POST).
- New record is created FIRST; the OLD record is marked (`SUPERSEDED->succ`/`VOIDED`) + gets a
  history comment. The OLD rename is best-effort in try/catch: Navisworks often marks the old
  object read-only after the online round-trip, so the tree name may not update — the PLATFORM
  is authoritative for lifecycle display. Reassign/edit copies carry responsibleCompany forward.

## Sync (SyncWithBIMLog) — duplication fix
`lens-sync` push SKIPS any viewpoint that already has a serverId OR a pending placeholder
(edit/reassign copies are created server-side by the action endpoints; re-pushing them was
duplicating rows). Void-records still sync. RefreshCounter counts a viewpoint as synced if the
server knows its name/guid OR it has a serverId locally (edit/reassign copies get new names but
real serverIds, so name-only matching under-counted them).

## Sync recursion + one lifecycle authority (v1.6.3)
`SyncWithBIMLog` walks the ENTIRE BIMLog tree via `FindAllBIMLogViewpointLocations` (recursive),
so viewpoints a cleanup filed into subfolders sync too — before, only loose children of the date
folder synced and history was skipped. Lifecycle (active/superseded/voided) is decided ONE way for
both the counter and the push, by `EffectiveLifecycle(loc, entry)`: (1) own name marker
(VOID-RECORD / [VOIDED] / [SUPERSEDED]) → (2) folder placement (history + status folders) → (3)
loose in the dated `BIMLog ...` folder = active → (4) metadata last. Folder/name outrank stale
`localLifecycle`, so a bad value left by `ApplyPlatformLensCorrectionsAsync` self-heals. NEVER add
a second/parallel lifecycle-inference path — doing so once voided every viewpoint.

## Responsible Company (v1.6.2)
Each trade row in Save has an editable `CboResponsible` combo (type or pick). Saved into
metadata (`responsibleCompany`), sent in the lens-sync entry, round-tripped, carried forward on
edit/reassign/void. Platform stores it, shows a column + Set-Responsible-Company batch modal
(group/chain), and includes it in Excel + PDF.

## Guidance + cleanup + Done Managing
- In-panel "Show guidance" checkbox + a Guidance TOPIC dropdown (Daily workflow, Save, Markup,
  Edit/Reassign/Void, Floor corrections, Clean duplicates, Create RFI, Troubleshooting).
- "Done Managing Viewpoints" button clears the manage panel and reminds to Sync if pending.
- Clean Duplicate BIMLog Views uses the platform as source of truth and rebuilds/migrates into
  one stable root folder named `BIMLog Viewpoints`. Legacy dated folders and old cleanup folders
  are recognized only for migration. Non-BIMLog folders such as `LEVELS` are protected because
  cleanup only manages real BIMLog Lens viewpoints inside recognized BIMLog roots. The read-only
  workaround (copy into a fresh folder + delete old) is deliberate — Navisworks won't release
  read-only viewpoints; do not replace it with direct rename/delete-only logic.
- Full folder set (v1.6.3+): every cleanup rebuilds into the 8 folders that mirror the platform,
  created even when empty: Open, Follow Up, Waiting Design, Approved, Resolved, Superseded,
  Voided, Voided Records (`BIMLogSubfolders`). Active viewpoints file by platform workflow status
  (`PlatformHistoryFolderName` → `StatusFolderName`: open/follow_up/waiting_design/approved/
  resolved); history by lifecycle. `lens-pull` already returns `status`, so this was plugin-only.
  Change a status on the platform → run cleanup → the viewpoint moves folder. Two-way verified.

## BIMLogApiClient.cs — HTTP contract
Raw HttpWebRequest only. `Patch` = Edit; `Post` = Void/Reassign; `Get` = active-resolver.
PushViewpointBatchAsync posts one viewpoint per call to `lens-sync` (serializes the entry dict
generically, so new fields like responsibleCompany flow without client changes). Endpoints:
EditViewpointAsync (PATCH .../edit), VoidViewpointAsync (POST .../void), ReassignViewpointAsync
(POST .../reassign), ResolveActiveViewpointAsync (GET .../active). JsonViewpointResult.Id is int?
(a collision-skip returns id:null).

## Open items / known limitations
- `SUPERSEDED->successor` tree marker is best-effort (read-only after round-trip). Platform =
  source of truth.
- Read-only plugin users still get a silent 401/403 sync failure with no clear UI signal — not
  yet addressed.
- Responsible Company plugin field is free-text with no auto-loaded suggestion list yet (platform
  side offers suggestions).
- v1.6.3 confirmed live in Navisworks 2021 by Roberto (recursion + 8-folder mirror + two-way
  status filing all verified) and packaged for Ruben (2025 zip).
