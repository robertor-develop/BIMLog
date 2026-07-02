# PLUGIN.md — BIMLog Lens Navisworks Plugin Reference

Owned/hand-edited. This disk copy is the seed; the in-app Living Brief serves PLUGIN.md from
the DB, so after editing here also "Paste to Update" in-app to refresh the shown version.

## Build + versioning + packaging
- Two physical builds, same `.cs` source EXCEPT `BIMLogLensPanel.cs` must be kept in sync
  (only file that diverges) and the `.csproj` DLL refs differ:
  - Navisworks 2021: `C:\Dev\BIMLogPlugin\BIMLogNavisPlugin` (Roberto's machine). Deploy:
    close all `*Navis*`/`*Roamer*` processes, then copy `bin\Debug\net48\*.dll/.pdb` into
    `C:\Program Files\Autodesk\Navisworks Manage 2021\Plugins\BIMLogNavisPlugin\`.
  - Navisworks 2025: `H:\BIMLogPlugin2025` (Ruben's machine). Refs in `H:\...\refs\`.
- Build: AnyCPU, .NET Framework 4.8, `dotnet build -c Debug`.
- Semantic versioning v1.6.x. Package with `H:\BIMLogPlugin2025\Build-Package-2025.ps1
  -Version vX.Y.Z` — it builds the 2025 DLL and zips DLL+PDB+install.ps1+Install_BIMLog_2025.bat
  +README_BIMLog_Lens.txt+BIMLog_Lens_Revision_Update_vX.Y.Z.txt. Every release: update the
  README revision + write a per-revision update .txt covering the delta. Current: v1.6.2.

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

## Responsible Company (v1.6.2)
Each trade row in Save has an editable `CboResponsible` combo (type or pick). Saved into
metadata (`responsibleCompany`), sent in the lens-sync entry, round-tripped, carried forward on
edit/reassign/void. Platform stores it, shows a column + Set-Responsible-Company batch modal
(group/chain), and includes it in Excel + PDF.

## Guidance + cleanup + Done Managing
- In-panel "Show guidance" checkbox + a Guidance TOPIC dropdown (Daily workflow, Save, Markup,
  Edit/Reassign/Void, Floor corrections, Clean duplicates, Create RFI, Troubleshooting).
- "Done Managing Viewpoints" button clears the manage panel and reminds to Sync if pending.
- Clean Duplicate BIMLog Views uses the platform as source of truth and rebuilds into a clean
  folder named `BIMLog <date> C-001` / `C-002` (never overwrites the original).

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
  side offers suggestions); v1.6.2 needs a live Navisworks test before shipping to Ruben.
