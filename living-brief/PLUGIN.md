# PLUGIN.md — BIMLog Lens Navisworks Plugin Reference

Owned/hand-edited in Git. The in-app Living Brief serves the verified deployed source bundle;
the database is an exact status-bearing mirror and must never override this document.

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
- **Canonical H-only boundary (mandatory and mechanically enforced).** All BIMLog Navisworks
  plugin source, builds, intermediate outputs, validation artifacts, packages, and ZIP files
  must be created only under `H:\BIMLogPlugin2021` or `H:\BIMLogPlugin2025`, as applicable.
  Every build and packaging mechanism must fail closed before writing when its source or output
  is outside the matching canonical H: root. Downloads, Desktop, Temp, C:, D:, F:,
  repositories, and worktrees are prohibited plugin build or packaging destinations. The sole
  permitted non-H writes are separately and explicitly authorized installation copies into
  Autodesk's required plugin load paths; build or package authority never implies installation
  authority.
- Two physical builds must be reviewed and synchronized together. Preserve the documented,
  intentional `BIMLogLensPanel.cs` differences and the different `.csproj` DLL references while
  keeping shared behavior aligned:
  - Navisworks 2021 source/build root: `H:\BIMLogPlugin2021`.
  - Navisworks 2025 source/build root: `H:\BIMLogPlugin2025`. References remain in
    `H:\BIMLogPlugin2025\refs\`.
- Build AnyCPU / .NET Framework 4.8 from the matching canonical root only:
  `dotnet build H:\BIMLogPlugin2021\BIMLogNavisPlugin.csproj -c Debug` or
  `dotnet build H:\BIMLogPlugin2025\BIMLogNavisPlugin.csproj -c Debug`. The project guards pin
  output, intermediate, and project-extension paths beneath the matching H: root and reject
  overrides outside it before build.
- Semantic versioning v1.6.x. Package 2025 with `H:\BIMLogPlugin2025\Build-Package-2025.ps1
  -Version vX.Y.Z` — it builds the 2025 DLL and zips DLL+PDB+install.ps1+Install_BIMLog_2025.bat
  +README_BIMLog_Lens.txt+BIMLog_Lens_Revision_Update_vX.Y.Z.txt. Every release: update the
  README revision + write a per-revision update .txt covering the delta. Current frozen review candidate: v1.60.18.
  Shared logic in `BIMLogLensPanel.cs` + `BIMLogApiClient.cs` must be reviewed in both physical
  copies for every shared change; preserve intentional version-specific differences.
- Installation is a separate gated action. Only after Roberto explicitly authorizes that exact
  installation may accepted DLL/PDB/manifest files be copied from the canonical H: package into
  Autodesk's required plugin load path for the matching Navisworks year. Never build, validate,
  stage, or package in an Autodesk C: load path.

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

## Lens Next historical Original Lens viewpoint recovery (v1.0.35)
- BIMLog remains the authoritative identity and permanent visual-state custody. Preserved Original Lens Saved Viewpoints are read only as the one-time visual source for historical BIMLog rows that predate platform packages.
- Lens Next's normal **Open working view** first loads an existing BIMLog package. If absent, the native adapter enumerates Saved Viewpoints only and retains only those carrying the Original Lens `source: BIMLogLens` marker.
- Historical Original Lens identity is reconstructed last-write-wins across the complete sequence of managed merge comments. Project ID, server ID, physical ID, and workflow receipt are not required to coexist in one comment; the exact merged project/server or project/physical identity must match the selected BIMLog row.
- Matching is fail-closed: exact project + `serverId` metadata, then exact project + `bimlogPhysicalId` metadata, then one unique exact display code derived from BIMLog `viewpointId`. A Navisworks GUID is accepted only when that same Saved Viewpoint is independently present in the correlated set.
- Trade, company, floor, note, title similarity, arbitrary model search, and an uncorrelated stale GUID are never identity. Missing or multiple exact candidates remain blocked.
- After exact recovery, Lens Next captures the complete visual-state contract, stores it on the selected BIMLog row, and applies the platform package as a temporary Working View. It does not rename, move, create, delete, or reorganize Saved Viewpoints and does not save the NWD.

## Lens Next controlled rebuild — Build 1 binding and inventory

- Runtime project binding no longer trusts the Project ID saved in local settings. Build 1 requires one unique project identity reconstructed from Original Lens-managed Saved Viewpoint comments in the active named document; no identity and mixed identities both deny startup.
- The read-only native inventory returns only managed Saved Viewpoints and preserves their merged BIMLog identity, physical identity, Navisworks GUID, display name, and folder path. Unmanaged Saved Viewpoints are excluded and never mutated.
- BIMLog remains platform-first. The web workspace compares the authoritative platform rows with the local managed inventory and reports matched, platform-only, Navisworks-only, conflicted, and unresolved counts. Build 1 performs no reconciliation writes; clean-model platform binding and governed mutations belong to later builds.

## Lens Next controlled rebuild — Build 5 local-only upload

- An exact Original Lens-managed local-only viewpoint may be uploaded only from the synchronization plan and only after a separate reason plus explicit confirmation. The native bridge opens the exact GUID after rechecking current project/model context and managed local-only identity, then captures the visual contract without changing Saved Viewpoint structure.
- The platform uses a dedicated single-item API, not legacy bulk sync. It refuses any existing GUID/viewpoint/display identity and commits the new BIMLog record, rebound verified visual package, and sequence together. Working View open never invokes this path.

## Open items / known limitations
- **Protected v1.60.7 physical-mutation baseline.** Later identity, lineage, import/rebind,
  `Guid.Empty`, ambiguity, and preserve-first protections must surround rather than replace the physical
  mutation sequence: make `CreateUniqueCopy` while detached, set the final display name on that copy,
  `AddCopy` into the intended current/source folder, then reacquire `Document.SavedViewpoints` after every
  insert, metadata write, rename, move, or removal. Never carry mutable viewpoint/group/parent/target wrappers,
  indexes, or reference-equality assumptions across a mutation or `await`. Identify an inserted successor from
  a fresh post-insert inventory and stamp immutable identity before further work.
- **v1.60.9-v1.60.17 regression class.** Successive fixes correctly added server identity, lineage, strict
  matching, project boundaries, import/rebind, and preserve-first reconciliation, but repeatedly retained or
  rediscovered stale Navisworks object wrappers after collection mutation. This caused placeholder names,
  missing or duplicated physical successors, or later cleanup treating an unresolved row as deletion authority.
  The factual correction is architectural: fresh reacquisition after mutation plus identity-based resolution;
  labels, cached indexes, object reference equality, and absence from a pull response are never deletion proof.
- **v1.60.18 is frozen and field-acceptance pending, not Completed.** The Navisworks 2021 exact-model gate
  preserved the original NWD SHA-256 `8A73356DA75150B50A64DFCF182761E65477FC6E40184D2500EF0F60CA8DA27F`,
  created successors 362/363 exactly once, repeated Pull without duplicates, reconciled twice without crash,
  and saved/reopened with 59 physical viewpoints and persisted identities. Frozen 2021 DLL SHA-256 is
  `B12BE2113DC6A2367310E821185043D3C5B3D37D8D9EE6E5AC4135780C2D1D7A`; final verified 2025 handoff DLL is
  `FD4B3C3D20E5C7F8759CFCC250DE4BCA598D29E465C6361ACA8A91E9EA3BECE2`; shared source parity is
  `14FCD66A552987EE773D231F2F35BB46F10A35A78D0EE232E384BFE20D921808`. Package provenance and the 2025
  handoff were verified, but Ruben's exact Navisworks 2025 install, workflow, save/reopen, and field acceptance
  remain pending. No integration, deployment, installation, or customer verification is implied here.
- **Navisworks v1.60.18 remains Pending / Under Review.** Its frozen local artifacts and exact-model
  evidence are recorded here, but Ruben's Navisworks 2025 field acceptance remains mandatory before Completed status.
  Do not describe it as integrated, deployed, installed, or field verified until independent review,
  clean integration, and the required Ruben 2025 field gate establish those facts.
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
- Project Import/Rebind platform correction is integrated for v1.60.13 review. Import idempotency is
  scoped by authenticated user, target project, and import key; a canonical request hash covers user,
  target, model, source projects, and normalized viewpoint identity/lineage payload. Exact retry returns
  the same completed batch/mapping; changed content or model returns HTTP 409
  `IMPORT_IDEMPOTENCY_CONFLICT` without returning prior mappings. New target physical identities persist
  on both import items and queryable target viewpoint rows and are returned by Lens Pull. Real integrated
  authenticated API/database evidence passed 68/68 against `127.0.0.1:55432/bimlog_rfi_test`, including
  first import, retry, content/model conflicts, different-user namespace, authorization, concurrency,
  rollback, restart retry, Pull contract, project/input boundaries, legacy NULL-hash handling, cleanup,
  and privacy scan. Evidence:
  `C:\Dev\bimlog-tools\evidence\navisworks-project-import\lens-import-20260716200026-945467`;
  manifest SHA-256 `3dfc8a5480fcabdf88130585cb8066f85067ab8ccafc19178727db2aef11cbff`.
  This was not a Replit publish, production/Neon run, project-28/34/35 run, customer-data access, or
  live Navisworks field acceptance.
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
- Build 6 adds a separate create workflow. It captures the active view under a newly generated client identity, commits the BIMLog record and digest-verified visual package atomically, and only then creates one local Saved Viewpoint carrying the returned server identity, revision, model fingerprint, visual digest, operation ID, and audit reason.
- The local Saved Viewpoint GUID is returned to BIMLog through a dedicated exact-identity confirmation. Creation never routes through Original Lens bulk sync, never creates from an unconfirmed draft, never modifies model geometry, and never saves the NWF/NWD automatically.
- Build 7 materializes the current personal **My View** grouping only beneath `BIMLog Lens Next - My View`. Eligibility requires the exact Lens Next publish marker plus an exact GUID. Original Lens and unmanaged viewpoints are never moved; empty folders are not destructively pruned; folder placement remains presentation, never identity.
- Build 8 executes the deterministic reconciliation plan only after an explicit reason and confirmation. It blocks before mutation on any unresolved or ambiguous item, reconstructs complete unbound BIMLog packages into newly stamped local Saved Viewpoints first, confirms their exact GUIDs back to the same BIMLog rows, and only then captures and atomically uploads exact managed local-only viewpoints. Stale recorded GUIDs require recovery rather than silent replacement. The run never deletes, overwrites, invokes Original Lens bulk sync, or automatically saves the model.
- Build 9 distinguishes an interrupted GUID confirmation from synchronization. One exact managed local viewpoint carrying the same server identity and visual package may repair a null BIMLog GUID through the dedicated audited confirmation contract; an already-confirmed identical GUID is an idempotent replay, while any different GUID remains a manual conflict. Recovery runs before new pulls or uploads and never creates a duplicate.

## Lens Next controlled rebuild — Build 10 consolidated acceptance and recovery

- Build 10 adds no new viewpoint feature. It is the single deterministic release gate for Builds 1–10: authoritative project/model binding, dual inventory, plan preview, one governed creation, one eligible local-only upload, BIMLog-package Working View reconstruction, My View organization, interrupted-confirmation recovery, refresh, persistence, idempotent rerun, and bounded failure recovery.
- The acceptance matrix covers clean models, historical Original Lens-managed models, missing platform packages, stale GUIDs, ambiguous and duplicate identity, interrupted confirmation, unauthorized/read-only publication, 2021/2025 native source parity, and refresh/save/close/reopen identity, path, and visual-package persistence. Similarity guessing, silent overwrite, deletion, Original Lens mutation, and automatic NWF/NWD save remain prohibited.
- The executable architecture boundary names BIMLog as the sole owner of construction project, model, issue, viewpoint, and Lens workflows. Lens Next may consume versioned external handoff contracts but refuses marketing execution, portfolio finance/allocation authority, legal approval authority, and Knowledge Intake routing authority.

## Lens Next exact historical first-open migration

- For a selected BIMLog record with a complete visual package, **Open Working View** loads and reconstructs only that package. For a historical Original Lens record without a package, the same action uses the native exact-identity resolver to activate the matching managed Saved Viewpoint, captures its full supported visual state, persists it on the same BIMLog server record, reloads the accepted package, and reconstructs the temporary Working View.
- Exact recovery does not use similarity, title fragments, trade, floor, or broad model search; missing or ambiguous identity performs no persistence. The workflow creates no duplicate platform issue, does not silently overwrite another record, does not mutate Original Lens structure, and does not save the Navisworks model automatically.

## Lens Next v1.0.44 visual-digest diagnostics

- Native capture now emits the SHA-256 algorithm, `lens-next-visual-digest.v1` contract, computed digest, truncation flag, canonical byte length, and exact canonical input as Base64. Diagnostics are excluded from the digest itself, so the visual-state contract remains stable and non-recursive.
- BIMLog recomputes the same labeled canonical token stream. A mismatch remains fail-closed HTTP 409, but now records both digests and identifies the first differing field and values instead of returning only a generic rejection. The embedded workspace exposes a bounded digest/field summary to the operator.
- The H-only Navisworks 2025 v1.0.44 package builds with zero warnings/errors; core tests pass 33/33 and native tests pass 28/28. The ZIP SHA-256 is `1EEBFCB2AC33FCF3B91D84B2E13B0BABEA56A03683961BB3A14DB55473C11B24`. Installation and connected field acceptance remain separate.

## Lens Next v1.0.49 systemic dual-year candidate

- One Git-tracked canonical source under `plugins/BIMLogLensNext` generates independently loadable Navisworks 2021 and 2025 Autodesk bundles. The bundles, assemblies, manifests, plugin IDs, install names, state, cache, diagnostics, and release receipts remain distinct from Original/Legacy Lens and from each other where Autodesk year identity requires it.
- A historical platform row without a visual package or Navisworks GUID resolves only by unique full ordinal equality between its immutable `viewpointId` and `SavedViewpoint.DisplayName`. Zero matches and duplicate exact names return explicit errors without capture or persistence; substring, fuzzy, trade, floor, title, and broad-model matching are prohibited. A unique match is activated, captured, persisted to the same server/revision contract, reloaded, and reconstructed from the platform package.
- Each native process allocates one available loopback port in the bounded `8766`–`8865` range. The native host supplies that exact origin to the embedded workspace; the web client accepts only `http://127.0.0.1:<approved-port>`. Expired credentials renew in place and each failed bridge operation retries once without navigating or reloading a healthy workspace.
- XML export writes a validated, nonempty, parseable Saved Viewpoints XML through one shared implementation; a failed validation preserves any existing destination. Both packages carry year-specific manifests, DLL file version `1.0.49.0`, install/uninstall BAT and PowerShell entry points, diagnostics, deterministic ZIPs, SHA-256 sidecars, and separate build receipts.
- XML export remains the Navisworks Saved Viewpoints export. It does not claim to export BIMLog web viewpoint records; any platform-record XML export is a separate future capability.
