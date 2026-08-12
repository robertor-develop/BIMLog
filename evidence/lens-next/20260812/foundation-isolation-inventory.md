# BIMLog Lens Next foundation isolation inventory

Status: **FOUNDATION INVENTORY COMPLETE / LANE A IDENTITY CONTRACT CONSUMED / PHASE 1 SOURCE READY**
Date: 2026-08-12
Lens Next worktree: `F:\BIMLog\Worktrees\bimlog-lens-next-20260812`
Branch: `codex/bimlog-lens-next-20260812`
Accepted base: commit `2cea97f985f3167c601dfd3df4c78813676f5680`, tree `9cfd03aeb5e1fe78227a8c9e3eebad3202fb8a44`
Authority verifier: PASS, Constitution v3.0.0, SHA-256 `733b944cfa80cc20436212f7a02344276bd913ec8688dd91146b186e3b5d7fcf`
Controlling requirement: `C:\Users\soporte\.codex\attachments\68552fa5-2231-46dc-9fcb-20f739eff859\pasted-text.txt`, structured sections 1-16 only. The trailing WhatsApp conversation was not treated as a Legacy repair instruction.

## Boundary and evidence quality

- This inventory is read-only with respect to the product and Legacy plugin. It adds only this document and the companion `phase1-readonly-acceptance-contract.json` under the isolated Lens Next evidence path.
- Lens Legacy was inspected at the current F-root source/candidate worktree `F:\BIMLog\Repositories\bimlog\.worktrees\lens-reconcile-screenshot-repair-20260811`. That worktree is independently dirty and contains the current v1.60.31 source/packages. This lane did not change, stage, clean, restore, build, install, or otherwise act on it.
- The Legacy source worktree resolves commit `d7f5c5a6a863b62e4aab6d813f86bf820752e98f` / tree `4a772f615f6250ff6f6c4ae696a109be5f3b3c29`, but the inventoried files below are explicitly bound to their current working bytes because they differ from that commit.
- No C-root source was inspected. The only C-root read was the explicitly authorized requirements attachment.
- No package, lockfile, Living Brief, Git metadata, database, provider, customer, installer, or external state changed.

## Exact source bindings

### Lens platform / API / schema at the accepted Lens Next base

| Path | Bytes | SHA-256 | Role |
|---|---:|---|---|
| `artifacts/bimlog/src/pages/project/LensViewpointsView.tsx` | 114,776 | `42BBCC30DF42C5BD92FC00DB647A767EC13398940EF0C8CD825C804932E1236B` | Current Lens web table, filtering, refresh, details/history, status actions, and Legacy localhost jump client |
| `artifacts/api-server/src/routes/clash_reports.ts` | 202,243 | `03C3EA5BDDD9AB978DEA07B89F9F9469EB4ABB19E6AA6147D2C91A885FCD3993` | Lens sync/pull/import, mutation, history, export, and report endpoints |
| `lib/db/src/schema/lens-viewpoints.ts` | 4,225 | `D6756E4C720B9868C31E7C76A9F9E1FD4E520836BF4E029BC439CCBA33F3D549` | Authoritative issue/viewpoint row and active-identity uniqueness |
| `lib/db/src/schema/lens-imports.ts` | 2,321 | `F73D6F3A03F690EED1E7B58D4A05E001DC48C5A69146AA45652822E92DFF5581` | Import batch/item lineage and idempotency |
| `artifacts/api-server/src/lib/lens-import-contract.ts` | 7,689 | `0DE5BB3ED9AB672713C04B3EFBE13ECF46C71BF38B064D89F816F0C5657DB41C` | Closed import request validation |
| `artifacts/api-server/scripts/test-lens-import-contract.ts` | 9,312 | `7B800B253A006126B7FA1903A631AFA166EA821F14781C061F6741B5EFC141EE` | Deterministic import-contract behavior evidence |
| `artifacts/api-server/scripts/test-lens-import-api-evidence.ts` | 31,159 | `CA33AA05603F578F5EC91BC7A10DD102220FCBB9FF9BEE4AD09E379B6D342E9C` | Existing API/DB evidence harness; not runnable for Lens Next as-is because it writes evidence to `C:\Dev\bimlog-tools\...` |

### Current Legacy plugin working bytes, inspected only

| Path under `F:\BIMLog\Repositories\bimlog\.worktrees\lens-reconcile-screenshot-repair-20260811` | Bytes | SHA-256 | Observed contract |
|---|---:|---|---|
| `BIMLogLensPlugin.cs` | 738 | `228A3F99568CE2059BBF9C2C12B30A8EF0173641AF223EF457BE4A23B81DFF9E` | Dock plugin `BIMLogLens.IgniteSmart`, display `BIMLog Lens v1.60.31` |
| `BIMLogLensButton.cs` | 1,196 | `31896FA067F39E4EA31E239D4BC3D361CBA3DF73175B9CC3FF9F135902D91C94` | Command `BIMLogLensButton.IgniteSmart` activates `BIMLogLens.IgniteSmart` |
| `BIMLogPlugin.cs` | 836 | `F6C4C1060073C09C62A5BDB05FB83F5FA66B3D21E6FD16BAB29F797D7AC725FE` | Pulse command `BIMLogNavisPlugin.IgniteSmart` |
| `PluginConfig.cs` | 15,330 | `0727B979C6E2D5597DF24CCE1CBC4A610BC4BBB293F0508C7730AF2EACD92A41` | `%APPDATA%\BIMLog` config/cache namespace and project lock |
| `BIMLogLocalServer.cs` | 11,450 | `2718075D0910C19EF93DD8736F4C0C38CCF857165FA90FE246591D6E1245B340` | Legacy native HTTP bridge on localhost port 8765; fail-closed multi-criterion jump |
| `BIMLogNavisPlugin.csproj` | 1,288 | `C0EFCED2EF321261AD21F65CBED3685BFC25BB2CFB1F1D5999B5F0F63B741D12` | Assembly/root namespace `BIMLogNavisPlugin`, net48, AnyCPU |

## Current reusable platform surfaces

The following are reusable contracts or behavior families, not permission to copy the entire desktop-oriented page into the plugin:

1. `LensViewpointsView.tsx` already defines the issue data family used by Lens: numeric server row `id`, `viewpointId`, `displayId`, `navisworksGuid`, note, trade, responsible company, report type, priority, floor, open items, captured/synced times, workflow status, Trade/Floor sequence, issue group, lifecycle state, predecessor, and revision.
2. The same component already contains server pull, 60-second update detection, manual refresh, project-scoped filters, issue details/history, project member context, responsible-company suggestions, linked items, and RFI navigation. Phase 1 may extract/reuse presentation and query contracts only after a responsive component boundary is established; the current file is a 114,776-byte page with write controls and therefore is not safe to embed wholesale in a read-only panel.
3. `GET /api/v1/projects/:projectId/clash-reports/lens-pull` is the current project-member read endpoint. It returns all project rows newest-first and includes authoritative server identity and lineage, but currently omits `screenshotUrl` from its serialized response even though the schema stores it.
4. `GET .../lens-viewpoints/:id/history`, `GET .../responsible-companies`, and project membership/levels endpoints can support details and read-only context. Phase 1 must not call PATCH/POST/DELETE Lens routes.
5. `lens_viewpoints` has active unique indexes for `(projectId, viewpointId)`, `(projectId, navisworksGuid)`, and non-null `(projectId, displayId)`. It stores `bimlogPhysicalId`, imported lineage, predecessor/revision, and issue group. Those fields can participate in an immutable intersection contract; display label cannot be the authority.
6. Existing Legacy deterministic fixtures are valuable non-regression oracles: `Run-JumpIdentityFixtures.ps1`, `Run-IdentityStampingFixtures.ps1`, `Run-PreserveFirstFixtures.ps1`, `Run-ReconcileVisualIntegrityFixtures.ps1`, `Run-ImportRebindFixtures.ps1`, and `Run-V16031DuplicateRecoveryAndRedlineFixtures.ps1`. They inspect the current Legacy source and must remain byte- and behavior-independent from Next tests.

## Current visual-payload finding

The current platform schema is **not a complete reconstructable visual-state store**.

- Stored today: `screenshotUrl`, server/viewpoint/display/GUID/physical identities, issue metadata, workflow/lifecycle data, sequence/group/revision/import lineage, timestamps.
- Not present in `lens_viewpoints`: camera position/target/orientation, projection, field of view, selected-element identifiers, hidden/visible sets, section planes, appearance overrides, redlines, model transforms/reference context, or model/version fingerprint.
- Legacy Navisworks code can copy and fingerprint a physical SavedViewpoint's native camera/display, visibility, selection, sectioning, overrides, thumbnail, and redline collection, but those capabilities are local to the physical object and are not equivalent to a server-side reconstructable payload.
- Therefore Phase 1 Jump/Open must navigate an existing uniquely identified physical Legacy/Next-owned object or block. It must not claim that the platform can reconstruct a Working View until a later visual-payload schema/API contract is independently accepted.

## Legacy isolation inventory and required Next boundary

| Dimension | Legacy observed value | Lens Next requirement before code may use it |
|---|---|---|
| Assembly/DLL | `BIMLogNavisPlugin` / `BIMLogNavisPlugin.dll` | Lane A identity contract must bind a distinct assembly and DLL; equality is a hard failure |
| Root namespace | `BIMLogNavisPlugin` | Distinct Next namespace |
| Dock plugin ID | `BIMLogLens.IgniteSmart` | Distinct Next dock plugin ID |
| Dock panel activation | `BIMLogLensButton.IgniteSmart` resolves `BIMLogLens.IgniteSmart` | Distinct command and exact Next dock lookup |
| Pulse command | `BIMLogNavisPlugin.IgniteSmart` | Must not be registered, invoked, or shadowed by Next |
| Install folder | `...\Plugins\BIMLogNavisPlugin` in current installer | Separate Next folder; install/update/remove must never touch Legacy folder |
| Installer/uninstaller | Legacy package provides `Install_BIMLog_2025.bat` and `install.ps1`; no uninstaller was present in the inspected v1.60.31 package | Separate Next installer **and** bounded uninstaller definitions, neither referencing Legacy names/paths |
| Configuration/cache | `%APPDATA%\BIMLog\config.json`, `synced_viewpoints.json`, `sequence.json`, `trade_floor_sequence.json`, `levels_cache.json`, `project_locks.json` | Separate Next config/cache root and filenames; no read/write/migration of Legacy files on install/open |
| Logs | Legacy panel in-memory/live diagnostics and Legacy state path family | Separate Next log directory/files and logger category; never append to Legacy log/state |
| Feature flags | Shared platform table supports named scoped flags, but no Lens Next flags were found | Separate default-off flags for metadata, status, comments, camera, visual state, publishing, migration, duplicate recovery; Phase 1 write flags all false |
| Metadata namespace | SavedViewpoint comments tagged `"source":"BIMLogLens"` with keys such as `serverId`, `projectId`, `bimlogPhysicalId`, `displayId` | Distinct Next metadata source/schema/version marker; Next must not treat Legacy marker as Next ownership |
| Commands | Legacy Lens, Lens button, and Pulse IDs above | Distinct Next commands only; no ID collision |
| SavedViewpoint roots | `BIMLog Viewpoints`; recovery `BIMLog Viewpoints/BIMLog Recovery/Ambiguous Duplicates` | Distinct optional published root/marker bound by Lane A; Phase 1 creates/processes none |
| Local bridge | Legacy `http://localhost:8765` | Distinct transport binding and authenticated/session-bound message contract; no port/route sharing |
| Automatically processed objects | Legacy enumerates SavedViewpoints and recognizes `source=BIMLogLens` plus Legacy folders | Phase 1 may not enumerate/mutate the Legacy root as an ownership set; immutable Jump can inspect exact candidates read-only only under the accepted identity resolver |

## Consumed Lane A identity/isolation contract

The accepted Lane A contract is `evidence/lens-next/20260812/identity-isolation-contract.json`, 9,650 bytes, SHA-256 `E22E953EFF210FF189D635BF34A16D6E9954E5B51F234728179DDD8A2F45A317`, status `assessment_bound_phase1_may_proceed`. The following exact values are consumed, not inferred:

| Dimension | Reserved Lens Next value |
|---|---|
| Assembly / DLL / namespace | `BIMLogLensNext` / `BIMLogLensNext.dll` / `BIMLogLensNext` |
| Dock plugin / panel | `BIMLogLensNext.IgniteSmart` / `BIMLogLensNext.IgniteSmart` |
| Button / command prefix | `BIMLogLensNextButton.IgniteSmart` / `BIMLogLensNext` |
| Installation folder | `BIMLogLensNext` |
| Installer / uninstaller | `Install-BIMLogLensNext` / `Uninstall-BIMLogLensNext` |
| Configuration | `%LOCALAPPDATA%\BIMLog\LensNext\lens-next.config.json` |
| Cache / logs | `%LOCALAPPDATA%\BIMLog\LensNext\cache` / `%LOCALAPPDATA%\BIMLog\LensNext\logs` |
| Feature flags | prefix `lens_next.` with the eight exact default-off write flags listed in the companion JSON |
| Metadata namespace / source | `bimlog.lens_next.v1` / `BIMLogLensNext` |
| Bridge | isolated loopback HTTP JSON v1 at `http://127.0.0.1:8766` |
| Published folder / marker | `BIMLog Lens Next Published` / `bimlog.lens_next.published.v1` |

All ten non-collision assertions pass against the Legacy reserved values in this inventory: assembly/DLL, namespace, dock/button/command IDs, installation target, configuration/cache/log roots, feature-flag prefix, metadata namespace/source, bridge binding, and published folder/marker are distinct. The installer and uninstaller identifiers are separately reserved and must remain bounded to the Next installation folder. Phase 1 remains read-only and creates no published folder or SavedViewpoint.

## Issue, Working View, and Published View identities

- **BIMLog Issue**: authoritative platform row identity is the project-scoped server `id`, constrained by durable `viewpointId` and available `bimlogPhysicalId`/`navisworksGuid`. Human labels (`displayId`, code, name), tree path, and current active view are never sufficient.
- **Working View**: Phase 1 is ephemeral navigation state. It is not a SavedViewpoint identity and must not create one. Its request binds project, issue server row, and every available immutable physical/model constraint; zero or multiple matches block.
- **Published Viewpoint**: absent in Phase 1. Future publishing requires a dedicated Next publication identity and Next ownership marker linked to the authoritative issue. Existing `lifecycleStatus` and import lineage are not by themselves a published-object identity.

## Phase 1 implementation boundary established by this inventory

Allowed now that the exact Lane A identity contract is accepted:

- compact responsive read-only panel;
- authenticated project selection limited to projects returned by BIMLog authorization;
- connection state, refresh state, stale/update indicator, explicit error/block state;
- issue list/cards, search, filters, read-only details and history;
- immutable-identity Jump/Open via the isolated Next bridge;
- deterministic fixtures proving identity ambiguity blocks and Legacy bytes/identifiers/state paths remain untouched.

Not allowed in Phase 1:

- any Lens API mutation route;
- status/comments/assignment/RFI creation despite current web support;
- camera/screenshot/selection/visibility/section/override/redline capture;
- SavedViewpoint creation, update, move, rename, deletion, publication, import, migration, duplicate recovery, or automatic Legacy processing;
- Legacy localhost port, plugin IDs, DLL, install folder, `%APPDATA%\BIMLog`, metadata marker, command IDs, or SavedViewpoint root;
- production writes, C-root evidence paths, install, package/lock changes, or external activity.

## Concrete pre-source gates for the foundation owner

1. **PASS** - Lane A contract SHA-256 `E22E953EFF210FF189D635BF34A16D6E9954E5B51F234728179DDD8A2F45A317` is consumed exactly; no identity value is inferred.
2. Prove every Next identifier/path/port/marker is non-equal to the Legacy values in this inventory.
3. Select a native bridge transport that is isolated from port 8765 and has explicit origin/session/message validation; a plain unauthenticated reuse of Legacy HTTP is rejected.
4. Define the read-only API response schema explicitly. Either add `screenshotUrl` to the read response under separately authorized API work or present an honest no-thumbnail state; never invent a thumbnail.
5. Keep the current `test-lens-import-api-evidence.ts` out of the Lens Next test command until its C-root output path is removed/parameterized by separate authorization.
6. Bind new tests to production components/bridge contracts; do not create static mock UI as behavior proof.

## Terminal disposition

The isolation inventory and Phase 1 acceptance contract have consumed the accepted Lane A contract, all exact non-collision checks pass, and bounded Phase 1 production source may now begin. No production source was created by this lane. Lens Legacy remains untouched by this lane.
