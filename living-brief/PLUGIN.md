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
  README revision + write a per-revision update .txt covering the delta. Current review candidate: v1.60.13.
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
- v1.60.13 is the project-28 preserve-first Reconcile candidate. In v1.60.12,
  `CleanBIMLogViewsAgainstPlatform` deleted a physical local viewpoint when `MatchPlatformRow`
  returned null and local metadata contained `serverId`. Reconcile could also rebuild only matched
  rows into staging and remove the prior BIMLog folders, indirectly discarding unmatched viewpoints.
- Normal Pull/Reconcile now preserves omitted, ambiguous, incomplete, wrong-project, `Guid.Empty`,
  duplicate-label, historical, and strict-temporary records. Verified rows update/rename/move in
  place; destructive folder rebuilding is disabled; unresolved remnants are isolated by row.
- Reconcile records before/after distinct physical counts. Count may decrease only for an exact
  duplicate after project, serverId, shared `bimlogPhysicalId`, independently unique non-empty GUID
  targets, canonical metadata/folder, and canonical survivor readback all pass.
- The platform Pull query already includes all lifecycle rows for the requested project. Its concrete
  defect was omitting row `projectId` from the response. The route now returns it, and both plugins
  require it to match the configured project before applying a row.
- Deterministic source/state matrix: 26/26 passed; this is not live Navisworks evidence. Debug
  AnyCPU/net48 builds passed with zero errors. DLL SHA-256: 2025
  `A66618980D099D88FDF80BDAE235A50CA3EB89CAFA5BB9F1470C970C853F564D`; 2021
  `3A39B02E6CCD3FE21AD3041AB9B083B4E50029DE1BDB539DC420C3F7F16E851A`.
- Review-only ZIP: `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.13.zip`, SHA-256
  `AB9CE37B33FB11CBF7935DF0FCA1E1A514346DC0399CB15C049756E9BB5CA2AC`.
- Ruben's project-28 NWD has not been supplied. No project-28 live inventory, repeated Pull/Reconcile,
  save/reopen, Jump, or field acceptance has occurred. Do not install/distribute or close the issue
  until isolated-copy acceptance passes and Roberto authorizes Ruben's Navisworks 2025 test.
- v1.60.10 corrects the v1.60.9 successor-name regression. Successors now receive their clean
  BIMLog name while detached, before `AddCopy`; the inserted object is resolved by exact GUID,
  stamped with complete successor/project metadata, and verified by name/metadata/folder readback.
- Persisted saved-viewpoint renames use `Document.SavedViewpoints.EditDisplayName`. A failed
  materialization removes only its captured incomplete GUID and remains retryable.
- Strict v1.60.9 remnants matching `^BIMLog successor ([1-9][0-9]*) ([0-9a-fA-F]{32})$`
  are repaired only inside BIMLog-managed roots. Duplicate remnants are removed by exact GUID
  only after one canonical candidate verifies; an orphan is preserved, reported, and blocks the
  destructive folder rebuild.
- Both 2025 and 2021 v1.60.10 builds passed as AnyCPU/.NET Framework 4.8. The 2025 package is
  `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.10.zip`, SHA-256
  `72A9C743D55BB0DFBE275C164E6C93E0248BDEBBC590DDCB0647DF56F8C550EE`. Evidence is at
  `C:\Dev\bimlog-tools\evidence\navisworks-successor-name-fix\20260714-141458`.
- Ruben must still install v1.60.10 and verify the affected model inside Navisworks Manage 2025;
  source/build/package verification is not field verification.
- v1.60.9 identity contract: platform row ID is stored locally as `serverId` and is the
  lifecycle-revision identity; Navisworks GUID identifies the current physical saved viewpoint;
  `supersedesId` is lineage; `issueGroupId` is grouping; display IDs/names are labels only.
- Web-created Edit/Reassign successors are materialized during Pull/Reconcile by copying the
  predecessor with `CreateUniqueCopy`, stamping the successor `serverId`, and preserving camera,
  hidden state, sectioning, redlines, markup, and saved-viewpoint state. Repeated runs match the
  stamped `serverId` and do not create another successor.
- Jump requests now carry serverId, projectId, Navisworks GUID when available, and the display
  label as fallback. The local server resolves serverId first, then exact GUID, and uses a label
  only when exactly one candidate matches; ambiguous label-only jumps are blocked explicitly.
- v1.60.9 builds passed for Navisworks 2025 and 2021 as AnyCPU/.NET Framework 4.8. The 2025
  package is `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.9.zip`. Field verification by
  Ruben in Navisworks 2025 remains required before closing the reported workflow.
- `SUPERSEDED->successor` tree marker is best-effort (read-only after round-trip). Platform =
  source of truth.
- Read-only plugin users still get a silent 401/403 sync failure with no clear UI signal — not
  yet addressed.
- Responsible Company plugin field is free-text with no auto-loaded suggestion list yet (platform
  side offers suggestions).
- v1.6.3 confirmed live in Navisworks 2021 by Roberto (recursion + 8-folder mirror + two-way
  status filing all verified) and packaged for Ruben (2025 zip).
