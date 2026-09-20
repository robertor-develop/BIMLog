# PLUGIN.md — BIMLog Lens Navisworks Plugin Reference

## Build 119 accepted installation topology — 2026-09-20

The accepted Navisworks topology is one Pulse-only `BIMLog.bundle` plus the matching-year Lens Next bundle. Original/Legacy BIMLog Lens is retired and must not be restored by install, upgrade, rollback, or uninstall messaging. Connected Navisworks 2021 execution and the complete dependency tree passed; Ruben's physical Navisworks 2025 confirmation remains post-closure field evidence and is not an automated-field-pass claim.

## Current supported product and release boundary — 2026-09-19

- **Lens Next is the sole supported BIMLog Lens product.** Original/Legacy Lens is preserved only as historical migration evidence and must not be presented, installed, loaded, or maintained as a parallel product.
- Current accepted Platform compatibility is `v1.05.N18-P33` / `1.5.18.33`. The Build 020 Platform publication changed no Native or installer source, so the existing accepted Native packages remain unchanged pending the dedicated Native reconciliation milestone.
- Build 040 candidate compatibility is `v1.05.N18-P34` / `1.5.18.34`. Its 2021 and 2025 package-only builds, core suites, native suites, installer package-only checks, and identity checks pass; no Autodesk installation or field acceptance is implied.
- Build 070 Platform candidate compatibility is `v1.05.N18-P35` / `1.5.18.35`. Native behavior is unchanged; generated assembly and dual-year manifest metadata advance only the Platform counter. Focused package/contract smoke is required before push, while installation and real-model field acceptance remain separate Build 071–075 work.
- The first P35 package smoke failed closed because shipped checklist and installer guards still named P34. After aligning only current package text/guards, the repeat passed core `132/132`, Native 2021 `57/57`, Native 2025 `57/57`, integrity and package-only installers with no installation. Exact ZIP hashes are recorded in Build 070 evidence and the tracked package receipts.
- Platform publication, Native package build, Autodesk installation, and real Navisworks 2021/2025 field acceptance remain distinct states. A web release never implies an Autodesk installation or Ruben field acceptance.
- Historical sections below describe the version and acceptance state at their named checkpoint; they do not override this current supported-product contract.

## Lens Next FI-002 model-save continuity candidate — 2026-09-18

- Ruben's exact 409 text, "The BIMLog navigation identity does not match the active record," originates in the native `AutodeskVisualStateAdapter` navigation guard. The previous fingerprint included NWF/NWD file size and modified time, so a normal save could change model identity without changing the named model. This candidate uses a stable, normalized full-path fingerprint for new captures in both 2021 and 2025 adapters.
- Existing signed navigation packages retain their original fingerprint and digest. If that historical fingerprint differs, the operator must explicitly confirm that the bound Navisworks document is the same model before a temporary Working View is opened. Project/issue/revision identity, digest verification, and the active document check remain mandatory; the package, BIMLog issue, and model are not silently rewritten. Non-navigation historical packages still require controlled repair.
- Release target is `v1.05.N18-P33` (`1.5.18.33`) for separate 2021/2025 packages. A source/build/package pass does not prove installation or Ruben's live FI-002 acceptance. Do not install the DLL into Autodesk without Roberto's specific approval for that target.

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

## Lens Next workspace modernization — Builds 1–5

- The Platform and embedded workspaces use the same responsive three-pane presentation: filters, authoritative issue list, and selected-record details. Each data pane owns its overflow on desktop; narrow layouts stack without changing record or action semantics.
- Filter and list widths are bounded browser-local preferences. Filters or the issue list may be collapsed and restored; these presentation preferences never enter BIMLog records, Navisworks metadata, synchronization payloads, or audit history.
- Selecting an issue keeps its existing list card visible beside the unchanged detail surface. Identity, digest, XML, navigation, camera, sectioning, lifecycle, model binding, creation, publishing, attachments, and synchronization contracts remain protected.
- Builds 6–10 improve discovery over the same authoritative issue array: normalized multi-term search, deterministic sorting, reset, truthful active/filtered/range counts, and bounded paging. Pagination never narrows synchronization scope, and selected server identity determines the visible page after view changes.
- Builds 11–15 modernize the same paged issue objects with Quality-standard P1–P5 labels, explicit workflow-state labels, descriptive accessible selection names, and truthful captured/missing/load-failed thumbnail states. Cards and table rows are alternate presentations of the same immutable server identities; switching presentation never fetches, clones, mutates, or duplicates an issue.
- Builds 16–20 compact the selected authoritative record around its verified thumbnail, issue description, P1–P5 priority, workflow state, and primary Working View/history actions. Identity and model evidence are read-only projections of the existing server row. References, revision/activity history, and controlled publishing are independently expandable; no callback, payload, authorization, receipt, digest, navigation, camera, or attachment contract changes.
- Builds 21–25 surface existing creation and current-project linking callbacks without adding a mutation path. Synchronization preview uses explicit readiness and disposition labels, live operation states, and per-record recovery guidance. Conflict and blocked states remain non-executable; selecting Review record only opens the existing authoritative issue and never repairs, replaces, uploads, or fabricates identity.
- Builds 26–30 add exact-390 containment, accessible navigation and focus visibility, reduced-motion support, bilingual modernization controls, and browser-side rendering bounds for large issue collections. These remain presentation-only safeguards: the complete authoritative issue set still drives synchronization, selected identity remains the immutable server ID, and no Native, bridge, digest, XML, camera, sectioning, route, schema, or mutation contract changes.

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

## Lens Next v1.0.50 platform-first dual-year candidate

- One Git-tracked canonical source under `plugins/BIMLogLensNext` generates independently loadable Navisworks 2021 and 2025 Autodesk bundles. The bundles, assemblies, manifests, plugin IDs, install names, state, cache, diagnostics, and release receipts remain distinct from Original/Legacy Lens and from each other where Autodesk year identity requires it.
- Normal **Open working view** reads only the selected BIMLog row's complete visual-state package and digest. It never opens, searches, captures, or saves a local Navisworks Saved Viewpoint as a fallback. A missing package or digest is a visible BIMLog-source-of-truth blocked state, not a native bridge request and not a `409` recovery loop.
- Historical rows missing their authoritative package use a separate, explicitly confirmed **Repair from current Navisworks view** operation. The operator must first display the exact intended original view; repair then captures that current state, persists it to the same BIMLog identity, reads the stored package back, and applies only the accepted BIMLog package. The repair control never guesses a source by display name, trade, floor, title, folder, GUID, or broad model search.
- Each native process allocates one available loopback port in the bounded `8766`–`8865` range. The native host supplies that exact origin to the embedded workspace; the web client accepts only `http://127.0.0.1:<approved-port>`. Expired credentials renew in place and each failed bridge operation retries once without navigating or reloading a healthy workspace.
- XML export writes a validated, nonempty, parseable Saved Viewpoints XML through one shared implementation; a failed validation preserves any existing destination. Both packages carry year-specific manifests, DLL file version `1.0.50.0`, install/uninstall BAT and PowerShell entry points, diagnostics, deterministic ZIPs, SHA-256 sidecars, and separate build receipts.
- The deterministic 2021 ZIP is 545692 bytes with SHA-256 `5263D0E6BB66D71AA856F8C450698247B4913F1FFEE6325A3B744F45495146C8`. The deterministic 2025 ZIP is 548504 bytes with SHA-256 `60F2CBE44EAC4D807AB244B77C2E7C8E40228075845CEAB43FC3A0BEF37932B9` and contains `INSTALL-BIMLOG-LENS-NEXT-2025.bat` plus the 2025 PowerShell installer and bundle manifest.
- XML export remains the Navisworks Saved Viewpoints export. It does not claim to export BIMLog web viewpoint records; any platform-record XML export is a separate future capability.

## Lens Next v1.0.51 cross-language visual digest

- New native captures use `lens-next-visual-digest.v2`. Every camera and appearance floating-point value is canonicalized as its exact normalized IEEE-754 binary64 bit pattern, so .NET Framework and JavaScript hash identical bytes without relying on runtime-specific decimal formatting. Negative zero is normalized and non-finite values fail closed.
- BIMLog remains the source of truth and accepts existing v1.0.50 captures only when their native canonical input, embedded SHA-256, declared algorithm/contract, complete token stream, and JSON visual state agree. The compatibility comparison is limited to legacy floating-point fields and their .NET formatting precision; a material camera or appearance change remains HTTP 409 with no platform mutation.
- Rebinding an accepted legacy capture preserves its verified native visual tokens and changes only the exact BIMLog identity tokens before rehashing. That package therefore validates again in the installed v1 native DLL while new v1.0.51 packages use the exact v2 contract.
- Both deterministic bundles report DLL file version `1.0.51.0` and contain their year-specific persistent-screen BAT installer. The 2021 ZIP is 559392 bytes with SHA-256 `C01038088CB02C690761322BDBF164966DB8A0A60ECF492D145E3F242D85507C`; the 2025 ZIP is 562218 bytes with SHA-256 `9D80C50227F99A9E8A75237090E9E7388A684FD43E1DFF5921F9D99BDC6EE956`.

## Lens Next v1.05.N01-P01 shared release identity

- The first shared-version release starts exactly at `v1.05.N01-P01`; legacy `v1.0.51` is not converted into either counter. Human-facing labels, manifests, installers, receipts, and archive names use the shared label. Windows DLL and Autodesk `AppVersion` fields use compatible numeric identity `1.5.1.1`.
- Shared core contracts pass 35/35 and both Navisworks 2021 and 2025 year suites pass 37/37. The deterministic 2021 ZIP SHA-256 is `5550AB22CF483A87CF19EB4B411EEDFACC3DC14DB4E1958FF3E251D35CB89B77`; the 2025 ZIP SHA-256 is `7953460FEA83D380A99F28C60C32D590A8BE01B24F4C0E12A022978E9883C028`.

## Lens Next long-running Working View apply contract

- A normal `apply-working-view` command is one correlated logical operation. Its request ID and exact payload fingerprint provide native idempotency: identical retries join the same in-flight/completed result, while reuse with a different payload fails closed.
- Total elapsed time is not an apply failure. The synchronous bridge waits for real UI-thread completion and emits cumulative stage timing for validation, authoritative digest verification, rollback capture, one-pass model/reference resolution, camera, sectioning, visibility, appearance, selection, implicit Navisworks redraw, and completion/failure.
- Digest validation is strict and precedes mutation. The platform's persisted digest, the received package digest, and the native recomputation must match the same contract. The native apply resolves all referenced items before the first mutation and retains full-fidelity atomic rollback behavior.
- The embedded UI disables repeated Open Working View activation while the operation is active and reports success only after native completion. Health/session renewal does not restart the runtime or navigate the WebView, and the health tick does not continuously normalize the floating window.

## Lens Next v1.05.N03-P01 dual-year package identity

- `v1.05.N03-P01` is the packaged form of the long-running Working View apply contract. It increments only the Lens Next N counter from N02 to N03 and preserves the independently owned Platform/APU P01 counter. Windows DLL and Autodesk metadata use numeric version `1.5.3.1`.
- Shared contracts pass 35/35 and both Navisworks 2021 and 2025 native suites pass 45/45. The 2021 ZIP SHA-256 is `65B08F00D0940FD8014598510B4110C40D237C8C3299ED6C75C51DDA276B9306`; the 2025 ZIP SHA-256 is `A9020A628DDA1EB9424122B914C840A4638E5008E607D6B4FD20C6B5C6BC9E99`.
- Packaging changes no BIMLog source-of-truth boundary: Working View consumes the selected platform package, rejects digest or identity conflicts before mutation, and never substitutes a local Saved Viewpoint.
## Lens Next digest v3 coordination boundary

- New native packages may emit `lens-next-visual-digest.v3` only after the Platform deployment is verified to accept v1, v2, and v3. Historical packages retain their original contract version and are never migrated.
- Native and Platform implementations must consume `contracts/lens-next/lens-next-visual-digest-v3-vectors.json` as the single A–L byte/digest authority. ElementReference v2 and ModelReference v2 fields are authoritative and any mutation must fail validation.
- The current shared Lens field identity remains `v1.05.N05-P01`. Platform owns the next P-only increment to `v1.05.N05-P02`; Lens Next must preserve P02 when the complete N06 candidate is eventually authorized.

## Lens Next v1.05.N08-P02 historical-digest release

- N08 preserves the Platform/APU-owned P02 counter and advances only the Lens-owned N counter.
  Human/package identity is `v1.05.N08-P02`; Windows DLL and Autodesk metadata use `1.5.8.2`.
- The shared native contract consumes the same permanent historical-unversioned vector as the
  Platform and proves that the old stored digest remains embedded while current v2 bytes compute a
  different digest. That package remains quarantined honestly instead of being guessed or rewritten.
- Shared core contracts pass 54/54. The Navisworks 2021 and 2025 native suites pass 51/51 each;
  package integrity, release identity, and package-only installer checks pass for both years.
- The deterministic 2021 ZIP is 587910 bytes with SHA-256
  `D31990B0186BE45C7521A69F377C6DA6F76DCE9171222BE75FE72606FC0AA438`. The deterministic 2025 ZIP
  is 590734 bytes with SHA-256
  `E2E24810C6A6693C6DAA98DAF31490927A5987C54D6BB21FCFE5B66466B5E112` and contains the 2025 BAT installer.

## Lens Next v1.05.N08-P03 platform-startup release identity

- P03 advances only the Platform/APU-owned P counter and preserves Lens-owned N08. Human/package identity
  is `v1.05.N08-P03`; Windows DLL and Autodesk metadata use `1.5.8.3` for both Navisworks years.
- The native Lens behavior remains the reviewed N08 implementation. Both 2021 and 2025 packages are rebuilt
  from the same controlled source so their displayed shared release identity remains aligned with Platform.
- Shared core contracts pass 54/54 and both Navisworks 2021 and 2025 adapters pass 51/51. Package integrity,
  package-only installers, and release-identity consistency pass for both years.
- The deterministic 2021 ZIP is 574516 bytes with SHA-256
  `8C482115D46EB270490B60E893DEF942AB5FEE9A1380DE754B12D98BDDAB5F71`. The deterministic 2025 ZIP is
  577330 bytes with SHA-256 `190F8F2B94BCD8E1645B5687F0A63AB22F8D55021DED67772E8BA3D75DD22E0B`
  and contains the 2025 BAT installer.
## Lens Next v1.05.N09-P04 shared platform release identity

- P04 advances only the Platform/APU-owned P counter and preserves Lens-owned N09. Human/package identity is
  `v1.05.N09-P04`; Windows DLL and Autodesk metadata use `1.5.9.4` for Navisworks 2021 and 2025.
- This release carries the already accepted N09 camera-apply primitive unchanged. P04 changes only platform startup
  liveness and shared release metadata; capture, screenshot, sectioning, digest, visibility, appearance, element
  identity, Saved Viewpoints, and database contracts are unchanged.
- Shared core contracts pass 54/54 and both year adapters pass 52/52. The controlled 2021 ZIP SHA-256 is
  `877EF261940B63E4E86C168B233AE9E35FE7CCDA4B93F1BC4D96827D243FDA59`; the controlled 2025 ZIP SHA-256 is
  `190C6399F199AB3DFA1FDE56A991EF37D1244A84A9634043005055575F12AB2B` and contains the 2025 BAT installer.

## Lens Next v1.05.N11-P07 Build 30 release-candidate identity

- Human/package identity is `v1.05.N11-P07`; Windows DLL and Autodesk package metadata use `1.5.11.7` for Navisworks 2021 and 2025.
- The metadata alignment does not alter capture, Working View restore, XML camera/sectioning serialization, viewpoint identity/digests, Saved Viewpoint behavior, bridge port 8766, database/schema, or deployment state.
- Shared XML contracts pass 123/123 and both year adapter suites pass 56/56. Package-only validation performs no installation. Exact candidate archive/component hashes are retained in the permanent Build 30 evidence directory after final assembly.

## Lens Next v1.05.N12-P09 Navisworks 2025 package identity

- Human/package identity is `v1.05.N12-P09`; Windows DLL and Autodesk package metadata use `1.5.12.9` for the Navisworks 2025 field package.
- P09 is a shared release-identity alignment for the unchanged N12 Native implementation. It does not change camera capture/restore, XML, bridge port 8766, Saved Viewpoints, linking, attachments, or any other Native behavior.
- The 2025 package is compiled against the exact Nw22 reference set and validated by the core 123/123 and Navisworks 2025 adapter 56/56 suites before package-only installer verification.

## Lens Next v1.05.N14-P10 missing-scale export compatibility — 2026-09-08

- A completely absent legacy camera scale tuple is optional for Navisworks XML export. The exporter omits focal/FOV/extent attributes while preserving the authoritative camera and sectioning fields.
- A partial, non-finite, zero, or otherwise malformed present scale tuple remains rejected with exact diagnostics. No camera scale is fabricated, clamped, or defaulted.
- The Navisworks 2025 package identity is `v1.05.N14-P10` / `1.5.14.10`; genuine field import remains an external Ruben acceptance gate.

## Lens Next v1.05.N17-P14 historical digest contract closure — 2026-09-10

- Platform and Native agree that matching database and embedded digests are not, by themselves, cryptographic verification of an unversioned historical Visual Package. Acceptance requires independent recomputation or preserved canonical evidence that verifies the declared digest; otherwise the package remains quarantined with `historical_digest_evidence_unavailable`.
- The P13 response-only authoritative-lineage normalization remains unchanged and cannot bypass digest integrity. Current/versioned packages, cross-project and model binding, unrelated or cyclic lineage, and genuine identity conflicts remain fail-closed.
- Native source and the accepted N17-P12 packages remain byte-identical. P14 changes only Platform validation, its shared contract tests, visible Platform version metadata, and release governance.

## Lens Next production-component acceptance — 2026-09-16

- The modernization acceptance harness imports the production `LensNextPanelView`; its 100 synthetic records, desktop shell, and exact-390 shell are test-only and excluded from the production entry point.
- Desktop selection preserves adjacent issue/detail panes. At widths up to 760px, a selected issue replaces the list until the user closes the detail, preventing long-list scrolling from separating the active viewpoint from its actions.
- The selected issue identity and primary actions precede properties, linked records, attachments, and controlled publishing. Help-dialog focus entry, Escape dismissal, restoration, visible focus, reduced-motion handling, bilingual actions, pagination, and large-list containment are regression-owned.
- Previous/Next controls navigate only within the current filtered authoritative issue collection. Boundaries fail closed, page crossings are deterministic, and selection continues to use the immutable Platform server ID; the controls do not synthesize or normalize viewpoint identity.
- These presentation and test changes do not alter Native or Platform identity contracts, camera/sectioning, XML serialization, digest enforcement, current/historical navigation rules, API behavior, database/schema, or stored evidence.

## Lens Next mockup-parity program — Block 1/10 contract — 2026-09-17

The bounded P32 Platform UI candidate does not mount or ship the experimental area-of-interest WebGL component and does not deploy a Native bridge or plugin ZIP. It may improve the issue-browser presentation independently, but the genuine-clash area geometry and 2021/2025 field gates remain open and must not be reported as mockup parity.

This is a **new** 50-build program in ten five-build blocks. It does not retroactively change the prior P31 modernization checklist. P31 is a published three-pane viewpoint/issue workspace, **not** the supplied clash-dashboard mockup. Block 1 establishes evidence and acceptance, not visual parity. No Native package, production data, schema, publication, or live behavior changes in this block.

### Build 1 — live/mockup acceptance matrix

The mockup's numbers and rendered clash images are illustrative, never production fixture values. Authenticated Chrome inspection of `bimlog.app/lens-next` on 2026-09-17 at 1366×607 showed `v1.05.N17-P31`, project `ELA01 ELARA EAST`, explicitly bound model `1185 RIVER AV test.nwd`, 15 active BIMLog issues, and model-tool counts 0 matched / 23 platform-only / 0 Navisworks-only / 12 blocked / 3 pullable. This is one observed session, not a universal total or a verified match to the mockup's project/model. The issue list began near viewport y=453 and expanding model tools pushed it below the viewport. One selected issue showed a captured thumbnail; most cards showed no captured thumbnail. Browser inspection did not accept Native Working View or XML export.

| Mockup surface | P31 evidence / gap | Acceptance for the new program |
| --- | --- | --- |
| Compact header, project/model binding and connection | Present, but setup/tools consume the first screen | Exact binding and honest connector state stay visible without hiding the working list/detail. |
| Summary counts, severity and source | Current tool/issue counts are distinct authorities; 148 is mockup-only | Each count names its denominator/source; no clash count inferred from issue count. |
| Search, status, severity, source, discipline/system, level and date | `LensNextFilters` supports search/status/trade/floor/priority only | Filters compose/reset over authorized real records and explain unavailable/empty states. |
| Clash list, images, severity/status | Current list is BIMLog issues; image appears only if captured | Exact authorized record identity and actual evidence; missing image has a truthful placeholder. |
| List/table/3D modes | Cards/Table exist; embedded 3D does not | Selection survives modes; 3D only after a proven authorized geometry contract. |
| Adjacent selected record and navigation | Adjacent detail exists; list starts too low in a short viewport | At 1366×607, list and selected actions remain reachable without page-scroll gymnastics; one intended scroll owner per pane. |
| Overview/3D/BIMLog Issue/Properties/Activity | Current details use actions/disclosures | Tabs preserve selection and expose only authoritative available data. |
| Elements, location/map, distance | Separate `clashes` schema has some fields; Lens issue DTO does not | Exact-linked values only, with units/provenance and explicit missing-data states. |
| Comments/create/controlled publish | Governed issue publication already exists | Preserve permission, immutable identity, confirmation, idempotency and audit receipts; no automatic publish. |
| Working View, sync and XML | Bridge exists; browser-only P31 test did not exercise Native paths | Exact project/model and digest-gated field proof for both supported Navisworks years. |
| Responsive, bilingual, keyboard and failures | Bounded prior P31 checks; mockup parity unverified | Real desktop 1366×607 and mobile 390×844, English/Spanish, keyboard/focus, loading/empty/error/denied, no clipped actions. |

### Build 2 — immutable identity and linkage

- A Navisworks clash result is not a BIMLog Lens issue and not a Saved Viewpoint. An imported `clashes` row has project/report/row and source clash/fingerprint identifiers; a Lens issue has project, Platform `serverId`, immutable `viewpointId`, active/revision lineage and verified visual digest. A native managed Saved Viewpoint has its own GUID/physical ID and model binding.
- The current `clashes` schema has no foreign key to `lens_viewpoints`, and the Lens issue DTO has no clash ID. A relationship is **not established** by title, floor, trade, image or position similarity. Later blocks require explicit permission-checked, project/model-bound stable-ID linkage and lifecycle/supersession rules before merging counts, cards or actions.
- Preserve active/current operational projection and immutable history. Historical/unverified packages cannot become active cards or be repaired by guessing a local viewpoint. Working View continues to require exact persisted identity/digest.

### Build 3 — data authority and provenance

| Fact | Current authority and permitted presentation |
| --- | --- |
| Clash total/severity/status/source | Native clash inventory only after an exact bridge/ingest contract; imported `clashes` data must be labeled report-derived, not current Native inventory. |
| BIMLog issue count/status/assignment/comments/history | Platform `lens_viewpoints` and governed events/receipts, scoped to project and active/current records. |
| Elements/distance/grid/XYZ/discipline/level | Imported `clashes` fields exist but may enter Lens only after exact linkage and unit/provenance verification. Native selected elements are not inherently a clash pair. |
| Screenshot/visual state | Captured screenshot and digest-verified Visual Package; missing evidence is never permission to synthesize an image. |
| Synchronization counts | Native local inventory plus Platform inventory for one explicitly bound project/model; report denominators and blocked reasons, not a fabricated clash total. |

### Build 4 — embedded 3D feasibility finding

Checked-in `BridgeContracts.cs` exposes project/local inventory, capture/apply Working View and XML export, but no clash-result enumeration or geometry/mesh streaming command. `NativeAbstractions.cs` exposes managed viewpoint inventory and visual-state capture; `lens-next-types.ts` has no geometry/scene DTO. A screenshot, camera, selected-element reference or XML viewpoint is **not** a navigable 3D model. The mockup's 3D image cannot honestly be reproduced from the current bridge. Before adding embedded 3D, prove the Navisworks API/export path, version/license constraints, bounded model size/performance, security, coordinate system, permissions and right to transfer/render geometry, then review the contract. Until then, offer a real captured image plus “Show in Navisworks”/Working View, with 3D explicitly unavailable. Do not install a viewer or export customer geometry speculatively.

### Build 5 — frozen acceptance and release boundaries

- Desktop 1366×607: filters, a usable result-list portion and selected detail/actions remain simultaneously reachable; pane resizing/collapse creates no duplicate scrollbar. Mobile 390×844: selection replaces the list and Back restores list position.
- Check real project/model states, zero/populated/large inventory, captured/missing image, active/historical/unverified view, disconnected bridge, denied permission, stale selection, pagination, language switch, refresh and keyboard operation. Evidence comes from the actual component/live surface, not a disconnected design mockup.
- Every state-changing path retains tenant/permission checks, exact identity, digest, idempotency, immutable audit and explicit confirmation. Protected Native Working View, XML, save/reopen and 2021/2025 parity remain separate field gates; browser smoke cannot close them.
- Keep Block 1 local. Later releases require accepted integrated source, exact Replit Shell synchronization (never Replit Agents), non-destructive schema correspondence if applicable, Chrome live acceptance and Native field proof. No partial-block publication or 100% parity claim before the data and 3D gates pass.

### Approved bounded-area 3D direction — 2026-09-17

Roberto clarified that two isolated clash elements are insufficient. The intended interactive 3D surface is a **bounded, useful neighborhood** around the exact selected clash or viewpoint: the clashing elements plus relevant nearby ducts, pipes, structure, walls and equipment. It must not require transferring or rendering the entire model. Include actual geometry intersecting a unit-aware configurable 3D region, subject to relevance/visibility rules; clip long crossing objects at the region boundary so a single pipe cannot bring in remote geometry. Highlight the clash pair, mute context, preserve source model/element IDs and transformations, and let the user request a larger region explicitly. A viewpoint without an exact clash center/selected elements needs an explicit trustworthy focus; never guess the crop from a title or screenshot.

This is a target contract, not an implemented capability. It is allocated **within** the existing 50 builds, not added as another 50-build stream:

- **Block 2, Builds 6–10:** prove one genuine, explicitly bound Navisworks clash end-to-end: exact locus/element identity; spatial/relevance selection and clipping; 2021/2025 geometry-export feasibility; local-only bounded package with size/rights controls; interactive desktop/mobile prototype and measured performance. This is the go/no-go gate for the browser 3D architecture.
- **Block 3, Builds 11–15:** if the proof passes, implement the versioned Native bridge request/response, package validation, permission/project/model binding, geometry provenance and fail-closed limits. Keep existing capture/Working View/XML commands untouched.
- **Block 4, Builds 16–20:** integrate the authenticated BIMLog 3D pane, contextual navigation, highlighting, expansion, graceful unavailable fallback, and keyboard/mobile states without disturbing the adjacent issue workflow.
- **Blocks 5–10, Builds 21–50:** complete the remaining mockup-parity data, list/filter/detail, synchronization, performance, regression and live/Native acceptance work. Do not silently replace those obligations with 3D work.

If the Block 2 prototype cannot lawfully and reliably export a bounded neighborhood, stop the browser-3D track and present the measured blocker/alternative to Roberto. Native “Open Working View” and actual captured imagery remain truthful fallbacks, not a claim of equivalent interactive 3D. APS conversion of a whole NWD followed only by client-side hiding does not satisfy the bounded-transfer requirement.

### Block 2 Builds 6–10 — local prototype status — 2026-09-17

- Build 6 local proof: `AutodeskAreaOfInterestProbe` resolves a precise Clash Detective test GUID and result GUID, requires two distinct nonempty item instance GUIDs, checks that both items intersect the requested bounds, and inventories only nearby geometry-bearing items. It is read-only and has no exposed bridge command. Both year projects compile, but this locator has not been invoked against Roberto's live model.
- Build 7 local proof: `LensNextAreaOfInterestPrototype` converts a bounded meter radius into exact source units, selects spatially intersecting elements, clips triangles to all six region planes, retains the clash pair and nearby context, and refuses duplicates, cross-model input, missing pair, unsupported units, excessive radius, item count, triangle count or estimated geometry bytes. Six new synthetic behavior tests pass. This proves the algorithm on fixtures, not Navisworks triangle correctness.
- Build 8 partial technical proof: the controlled 2021/2025 API references compile the exact-clash locator. A **non-shipped** 2021 COM spike compiles a primitive callback that captures fragment-local triangles and raw local-to-world matrices with caps. Neither year has passed a real clash extraction/coordinate/unit test; the controlled 2025 reference set lacks the COM geometry assembly and no 2025 runtime extraction is claimed.
- Build 9 local contract: the bounded package includes project/server/viewpoint/model/clash identity, source unit, region, element roles, clipped triangles and an estimated byte budget. It is an in-memory object only, with no network route, upload, persistence, authorization grant or customer geometry export. The boolean authorization input is a prototype guard, **not** a production server-side permission check.
- Build 10 **partial local candidate**: an unmounted WebGL2 React component consumes only a validated bounded package matching an explicit expected project/server/viewpoint/model/clash identity. It highlights the clash pair against muted context and offers pointer/touch orbit, wheel and button zoom, reset and resize. Focused synthetic contract tests and frontend typecheck pass. It has not rendered a real Navisworks package, been browser-visually inspected, measured on desktop/mobile, or validated against 2021/2025 world transforms. A fixture-only candidate cannot satisfy the one-genuine-clash go/no-go gate. Field proof must validate exact model binding, triangle/transform correctness, clipping, rights, size, responsive controls and performance in Navisworks 2021 and 2025. Existing Working View/XML and digest behavior remains unchanged.

### Independent Block 5 Builds 21–25 — local issue-browser candidate — 2026-09-17

Blocks 3–4 remain gated by the unresolved real-clash geometry proof. Block 5's issue-browser work is independent and may be implemented locally without representing 3D as complete or skipping the earlier release gates.

- Build 21: filter active BIMLog issues by the persisted responsible-company field; option values come from the active authorized issue collection.
- Build 22: filter by persisted report type, with the same active-record provenance. This is an issue type, not a Navisworks clash discipline or system classification.
- Build 23: filter by the browser-local date of actual Visual Package capture, inclusive from/through; missing or invalid capture timestamps do not match a dated query. The range resets a stale end date when a later start is chosen.
- Build 24: filter by actual captured image availability, never generated imagery or inferred Navisworks screenshots. These additional facets compose with existing search/status/trade/floor/priority and Reset.
- Build 25: collapse personal view controls and additional facets until requested, preserve selection, and label a selected record that falls outside the active filters with a Reset action instead of misleading `0 / 0` navigation. The test-only acceptance harness imports the production component; it does not ship fixture data or change the production route.

Focused filtering and prior Lens Next desktop/mobile/accessibility regressions pass. Local Chrome on that production component with synthetic fixture records confirmed company 100→50, date-to-empty, Reset, selected-outside-filter guidance, and exact-390 selection-to-list return without horizontal overflow. The screenshot and visual checks are **component-fixture evidence**, not authenticated live project, Native, or published acceptance. Clash severity/source/element facets remain absent until exact authoritative linkage exists. Working View, XML, digest, synchronizing commands, database and Native plugin behavior were not changed.

### Independent Block 6 Builds 26–30 — selected-issue detail candidate — 2026-09-17

The exact-clash geometry gate for Blocks 3–4 remains open. This block changes only the existing Lens Next issue-detail presentation; it does not establish a clash-to-issue join or introduce interactive 3D.

- Build 26: show the selected issue's actual stored capture in a bounded larger overview image; an absent image has an explicit empty state and an image-load failure has an explicit error, never a generated clash illustration.
- Build 27: put existing BIMLog links, references, repair and controlled publishing together under a selectable BIMLog Issue view while preserving their callbacks, permission gates, confirmation, digest and audit behavior.
- Build 28: expose existing immutable identity, lifecycle, Visual Package and sync evidence in a separate Properties view. The Activity view calls the existing governed history loader and shows loading/error/empty states without inventing events.
- Build 29: retain Working View, history and linking shortcuts above the views; next/previous selection returns to Overview. Views are accessible pressed buttons, not a new route or persistent server state.
- Build 30: show only actual trade, floor, report type and responsible-company fields in the overview; explicitly state that clash pair, surrounding geometry, grid and distance require verified exact linkage. New overview and navigation language is English/Spanish; exact-390 wrapping avoids horizontal overflow.

Local Chrome exercised the actual production `LensNextPanelView` through the excluded synthetic harness: missing image, a loaded test image asset, BIMLog Issue/Properties/Activity switching, next-issue reset, Spanish labels and exact-390 overflow report. The test asset is not a clash capture or a production record. Chrome screenshot capture timed out, so visual pixel acceptance remains open. No authenticated live project, Native connected behavior, 2021/2025 ZIP, release or publication is claimed.

### Independent Block 7 Builds 31–35 — issue summary and table candidate — 2026-09-17

This slice presents only authorized active BIMLog issue records already loaded by the existing Lens Next query. It does not merge Native Clash Detective results, imported clash reports or Saved Viewpoints by title, position or image similarity.

- Build 31: calculate one deterministic status breakdown over the complete **filtered** issue collection, not the current 20/50/100-item page. Empty filters have zero counts.
- Build 32: report image-reference and Visual Package availability separately. A stored screenshot URL is not proof that the image loaded; the visual package flag is not itself a cryptographic digest verdict.
- Build 33: distinguish total active BIMLog issue count from filtered count, and label the expanded status/evidence breakdown as BIMLog issue records, not Navisworks clashes.
- Build 34: make Table mode show responsible company, report type and whether an image reference is recorded, using only fields on each authorized issue. Card and Table continue to select the same immutable server ID.
- Build 35: provide English/Spanish new labels, keep the summary compact by default, and constrain table overflow to its own horizontal surface at exact 390px while the page remains non-overflowing. Focused pure-summary tests cover total/status/evidence, filter recomputation and empty data.

Local Chrome on the excluded fixture harness confirmed 100 active / 100 matching / 1 image reference; expanding status showed 25 Open, 25 Follow Up, 25 Waiting Design, 0 Approved and 25 Resolved. Filtering to Open changed the summary to 25 matching, 0 image references and 25 Visual Packages while preserving the 100 active denominator. Spanish Table mode exposed the new columns; the exact-390 shell reported no page horizontal overflow after opening the table. These are component-fixture interactions only. A saved image reference can still fail on actual download; Block 6 provides the explicit image-load error. Clash totals, geometry, grid and distance remain unavailable without exact provenance.

### Independent Block 8 Builds 36–40 — synchronization review candidate — 2026-09-17

The genuine-clash geometry gate remains open. This block is a read-only presentation change around the existing exact-identity synchronization plan. It neither changes Native commands nor authorizes a reconciliation.

- Build 36: distinguish the loaded project inventory preview from the current filtered BIMLog issue selection used to construct the plan. Neither number is called a clash total, and local inventory is described only when available.
- Build 37: expose the plan's exact `all`, attention, proposed-change and in-sync counts through deterministic pure presentation helpers.
- Build 38: allow keyboard-operable, `aria-pressed` filtering of plan rows without changing the underlying plan, selection, permission, confirmation or execution state; empty categories explain their emptiness.
- Build 39: label each row as an exact BIMLog server record or a local-only Navisworks viewpoint. Existing per-row reasons and explicit recovery guidance remain visible; only rows with a server ID retain the Review record action.
- Build 40: exercise mixed and empty plans in focused behavior tests, frontend typecheck, production bundle, and existing Lens Next regressions. Browser component-fixture and pixel/live/Native acceptance are separate gates and must not be inferred from typecheck.

The scope is still the loaded authorized active issues plus local inventory from the explicitly bound model; applying issue filters may omit platform issues from the plan but never changes the inventory preview. No clash-to-issue join, embedded geometry, screenshot generation, automatic send, data mutation, schema change, or publish is introduced.

### Independent Block 9 Builds 41–45 — capture truth and bounded-list candidate — 2026-09-17

The exact clash-linkage and real Native 3D gates remain open. This independent slice corrects the presentation of **existing BIMLog screenshot references** only; it does not create or link clash imagery.

- Build 41: key thumbnail and selected-capture load state by project/server identity, mutation version and screenshot URL. A prior record's loaded/error state cannot carry into a changed record; a new explicit retry has its own attempt key.
- Build 42: label a thumbnail as captured only after the browser's image `onLoad`. Before that it says loading; a failed request becomes unavailable; no URL remains an explicit no-capture state. English/Spanish labels are supplied. The existing screenshot filter is relabeled as a **stored image reference** filter, because its predicate checks URL presence rather than download success.
- Build 43: the selected overview reserves a bounded image area while loading, shows the stored capture timestamp only after load, and exposes a manual Retry after error. Retry cannot manufacture a replacement image and does not change the stored issue.
- Build 44: card thumbnails remain lazy/async with low fetch priority and list page sizes remain capped at 20/50/100. A synthetic 10,000-record filter/sort/summary characterization checks deterministic counts and a 100-row slice; its elapsed time is a local calculation, **not** a browser render, network, customer-model, or Native performance guarantee.
- Build 45: focused state, large-list, summary, responsive, accessibility and existing component-fixture tests plus frontend typecheck and production bundle. Local Chrome exercises loaded, missing and intentionally broken fixture URLs, explicit retry, desktop rendering, Spanish wording and exact-390 broken-image containment. The fixture uses a generic local asset, never customer clash evidence.

The issue summary still counts **stored image references**, not successfully loaded images. Actual customer-image delivery, authentication/denial, pixel review of the released screen, cross-year Native behavior, exact clash-linked pair/context imagery, performance under real inventory and publication remain separate gates.

### Independent Block 10 Builds 46–50 — partial local integration candidate — 2026-09-17

- Build 46: compact the issue-list heading into two deliberate rows so count and card/table choice do not compete with sorting and refresh time. The source uses the existing bilingual `tt` path.
- Build 47: remove the embedded list's 160px forced minimum, which pushed the list over pagination in a short Native-sized viewport. The list remains its own scroll owner; pagination now starts at its measured lower edge.
- Build 48: reconcile three source-string behavior assertions with the current bilingual and capture-truth contract, then run all 37 Lens Next behavior files. All pass locally.
- Build 49: frontend typecheck, production Vite bundle, bundle verifier and local Chrome production-component fixture checks pass. At a short desktop-sized viewport, read-only DOM geometry confirms zero list/pagination overlap. The exact-390 fixture reports `horizontalOverflow:false` in Spanish. Chrome screenshot capture timed out, so pixel inspection remains open.
- Build 50: **not closed**. Integrated release requires a real project/model-bound clash, actual bounded 3D pair-and-nearby-context imagery, Native 2021/2025 field runs, authenticated permissions/empty/error checks, deployed Chrome smoke and customer review. None is inferred from the local fixture. No push, Replit synchronization or publication is part of this local block.

Build 50 local UX continuation (2026-09-17): a short floating Native-sized viewport still showed only one card after the non-overlap correction. With setup disclosures closed, the left browser now places project/model and create/view-settings controls in two compact rows, increasing the measured issue-list viewport from 79px to 243px in the local 680px-tall Chrome fixture. Opening any top-level setup disclosure restores the normal column layout and lets the left browser scroll, while the selected issue on the right stays fixed; this prevents expanded Model tools from clipping the list. Chrome visually inspected the compact default and scrolled expanded states. The excluded 390px fixture still reports no horizontal overflow. These are fixture UX checks only, not Native field acceptance or an additional Block 11.
# Build 080 shared release compatibility

- Platform candidate `v1.05.N18-P36` / `1.5.18.36` changes no Lens Next native behavior. The shared metadata contract required deterministic package-only rebuilds for Navisworks 2021 and 2025; both passed without installation. Installed compatibility and absence of customer-facing Legacy Lens remain a focused post-publication scan.
