# BIMLog Lens Next — Initial Technical Assessment

Date: 2026-08-12
Assessment lane: read-only architecture and identity/isolation contract
Authoritative worktree: `F:\BIMLog\Worktrees\bimlog-lens-next-20260812`
Branch: `codex/bimlog-lens-next-20260812`
Assessed base: commit `2cea97f985f3167c601dfd3df4c78813676f5680`, tree `9cfd03aeb5e1fe78227a8c9e3eebad3202fb8a44`
Constitution verification: PASS, version 3.0.0, SHA-256 `733b944cfa80cc20436212f7a02344276bd913ec8688dd91146b186e3b5d7fcf`
Scope source: structured sections 1–16 of `C:\Users\soporte\.codex\attachments\68552fa5-2231-46dc-9fcb-20f739eff859\pasted-text.txt`; the trailing informal WhatsApp exchange was excluded.

## Executive result

Phase 1 may proceed as a separate, read-only Lens Next foundation. The current BIMLog platform already has an authenticated Lens issue list, project-scoped authorization, workflow fields, revision/lifecycle fields, identity fields, filters, history, responsible-company data, and a local Navisworks bridge pattern. Those are reusable foundations.

The current platform does **not** store the complete visual payload required by sections 3, 5, 8, 12, and 15. The database has a screenshot URL and issue/viewpoint metadata, but no normalized camera, projection, field of view, selection, visibility, section-plane, override, redline, transform/reference-context, or model/version-fingerprint payload. The current `lens-pull` response does not even return the stored `screenshotUrl`. Current Legacy physical SavedViewpoints can preserve native Navisworks visual state, but that state is not reconstructable from BIMLog alone.

Phase 1 therefore has an honest boundary: live issue cards/list, search/filter/details, project selection, connectivity/refresh state, and Jump/Open only when a complete immutable identity resolves exactly once. Phase 1 must not write platform data, create/mutate SavedViewpoints, migrate projects, publish, or pretend a thumbnail/visual state exists when it does not.

The binding rules for implementation are in `identity-isolation-contract.json` beside this report.

## Evidence baseline

### Current platform and web Lens

- `artifacts/bimlog/src/pages/project/LensViewpointsView.tsx` — 1,950 lines, SHA-256 `42BBCC30DF42C5BD92FC00DB647A767EC13398940EF0C8CD825C804932E1236B`.
- `artifacts/api-server/src/routes/clash_reports.ts` — 3,865 lines, SHA-256 `03C3EA5BDDD9AB978DEA07B89F9F9469EB4ABB19E6AA6147D2C91A885FCD3993`.
- `lib/db/src/schema/lens-viewpoints.ts` — SHA-256 `D6756E4C720B9868C31E7C76A9F9E1FD4E520836BF4E029BC439CCBA33F3D549`.
- `lib/db/src/schema/lens-imports.ts` — SHA-256 `F73D6F3A03F690EED1E7B58D4A05E001DC48C5A69146AA45652822E92DFF5581`.
- `artifacts/api-server/src/lib/lens-import-contract.ts` — SHA-256 `0DE5BB3ED9AB672713C04B3EFBE13ECF46C71BF38B064D89F816F0C5657DB41C`.
- `artifacts/api-server/scripts/test-lens-import-contract.ts` — SHA-256 `7B800B253A006126B7FA1903A631AFA166EA821F14781C061F6741B5EFC141EE`.
- `artifacts/api-server/scripts/test-lens-import-api-evidence.ts` — SHA-256 `CA33AA05603F578F5EC91BC7A10DD102220FCBB9FF9BEE4AD09E379B6D342E9C`.

### Legacy plugin sources inspected read-only

Stable Legacy root: `F:\BIMLog\Repositories\BIMLogPlugin2025-emergency-1.60.21`.

- `BIMLogLensPanel.cs` — SHA-256 `0794D67F39F0EE267AAFF0A93584952E83664B2E08107FBA88A96B9A5C89B2A4`.
- `BIMLogApiClient.cs` — SHA-256 `FD745D0CBA995C4CF8A8F9191D0C1799D7B6CC54825D2ADCC167FED80C7F694F`.
- `BIMLogLocalServer.cs` — SHA-256 `7334E57162D8E6B1C5591575148E4F63F3139F0598A2019A0B61D0FCEDF6B771`.
- `PluginConfig.cs` — SHA-256 `3BBEBC2444BC313D257F27D72C90F6E9522CE2744FCA55FE385C92A50A62D6C8`.
- `BIMLogLensPlugin.cs` — SHA-256 `31F4C0B3537111E3F44279DE7DF6F531F5CCA80728D3FCE8BD70BA56D77BB3BE`.
- `BIMLogLensButton.cs` — SHA-256 `20EF2FCE6A9627789F9C7930C7AB959657234903A7E480506369C62F111003DD`.
- `BIMLogNavisPlugin.csproj` — SHA-256 `CAF4CF25497B8ABAACB59883CB5DDF20921D4C29E8F3357F219BF46A72E15FA7`.

Latest repair/reference root: `F:\BIMLog\Repositories\bimlog\.worktrees\lens-reconcile-screenshot-repair-20260811`.

- `BIMLogLensPanel.cs` — SHA-256 `9A291C3191CD0E07E54BA979B8268A17C3078CF37F62D1888C0D0DB5031DA593`.
- `BIMLogApiClient.cs` — SHA-256 `FD745D0CBA995C4CF8A8F9191D0C1799D7B6CC54825D2ADCC167FED80C7F694F`.
- `BIMLogLocalServer.cs` — SHA-256 `2718075D0910C19EF93DD8736F4C0C38CCF857165FA90FE246591D6E1245B340`.
- `PluginConfig.cs` — SHA-256 `0727B979C6E2D5597DF24CCE1CBC4A610BC4BBB293F0508C7730AF2EACD92A41`.
- `BIMLogLensPlugin.cs` — SHA-256 `228A3F99568CE2059BBF9C2C12B30A8EF0173641AF223EF457BE4A23B81DFF9E`.
- `BIMLogLensButton.cs` — SHA-256 `31896FA067F39E4EA31E239D4BC3D361CBA3DF73175B9CC3FF9F135902D91C94`.
- `BIMLogNavisPlugin.csproj` — SHA-256 `C0EFCED2EF321261AD21F65CBED3685BFC25BB2CFB1F1D5999B5F0F63B741D12`.
- Relevant focused fixtures: `tests/Run-JumpIdentityFixtures.ps1`, `tests/Run-IdentityStampingFixtures.ps1`, `tests/Run-ImportRebindFixtures.ps1`, `tests/Run-LegacyIdentityBootstrapFixtures.ps1`, `tests/Run-V16031DuplicateRecoveryAndRedlineFixtures.ps1`, `tests/Run-ReconcileVisualIntegrityFixtures.ps1`, `tests/Run-PreserveFirstFixtures.ps1`, and `tests/Run-ViewpointPipelinePerformanceFixtures.ps1`.

Legacy was read only. No file beneath either Legacy root was changed.

## 1. Reusable Lens web components

### Reusable now

- Authenticated API access and project-scoped membership: the existing page uses the current auth store and calls `/api/v1/projects/:projectId/clash-reports/lens-pull`; the server route is protected by `authMiddleware` plus `requireProjectMember()`.
- The data presentation vocabulary in `LensViewpointsView.tsx`: status labels, priority, trade, floor, responsible company, capture time, lifecycle state, revision, filters, history, linked items, project member data, refresh detection, and bilingual presentation.
- The server's read model in `clash_reports.ts` returns platform row ID, `viewpointId`, `displayId`, `navisworksGuid`, lifecycle/revision/lineage data, and `bimlogPhysicalId`.
- Existing status/history/report data can inform Lens Next details, but Phase 1 must hide or disable every write operation.

### Must be extracted or adapted

- `LensViewpointsView.tsx` is a 1,950-line page, not a reusable narrow-panel component library. It mixes list rendering, PDF/export, destructive actions, lifecycle repair, batch edits, responsible-company edits, local browser storage, and a Legacy localhost bridge. Lens Next should reuse contracts/presentation helpers through extracted headless types/selectors and small components; it should not import the entire page into Navisworks.
- The current page is table/report oriented rather than the requested compact card/details interface and does not expose a screenshot thumbnail in its `LensViewpoint` interface.
- Current polling compares only row IDs every 60 seconds. A Phase 1 refresh contract needs revision/updated-at semantics so field changes on the same row are detectable without a full manual reload.
- Existing Jump UI still contains a manual Saved Viewpoints search fallback. Lens Next must not inherit that behavior.

Conclusion: partial reuse is safe; direct whole-page reuse is not.

## 2. Current visual payload completeness

The current platform stores issue/workflow metadata plus an optional `screenshot_url`. It does not store a complete reconstructable visual payload.

Evidence:

- `lens-viewpoints.ts` contains `viewpointId`, `navisworksGuid`, `screenshotUrl`, workflow fields, lifecycle/revision fields, import lineage, and `bimlogPhysicalId`.
- It has no columns or structured payload for camera position/target/orientation, projection, field of view, selected elements, hidden/visible elements, section planes, appearance overrides, native redlines, model transforms/reference context, or model/version fingerprint.
- The `lens-pull` projection in `clash_reports.ts` omits `screenshotUrl`, so even the available screenshot field is not currently in the main read response.
- The Legacy sync payload in `BIMLogApiClient.cs` sends issue/viewpoint metadata, not a full visual-state document.
- The Legacy plugin can copy a native SavedViewpoint with `CreateUniqueCopy()` and explicitly uses the physical SavedViewpoint copy path to preserve redlines. That proves native physical state can be preserved inside Navisworks; it does not make BIMLog capable of reconstructing it.

Gap: Phase 3 needs an explicit versioned visual-state schema, capture/restore bridge commands, server validation, immutable payload revisions, model/version binding, and representative Navisworks verification. Screenshot-only behavior is insufficient.

## 3. Navisworks properties that can be reconstructed reliably

### Proven in the current physical SavedViewpoint workflow

- Native camera/viewpoint state can be preserved by copying the current/saved viewpoint.
- Native redlines can be preserved when the exact selected SavedViewpoint is copied; the current code explicitly rejects marked-up capture when no selected SavedViewpoint is available.
- Physical SavedViewpoints can be reacquired by Navisworks GUID and BIMLog physical identity, with exact-one resolution and safe block on ambiguity.
- Comments/metadata attached to SavedViewpoints can carry BIMLog server/project/physical identity and lifecycle information.

### Not proven reconstructable from BIMLog

- Camera numeric fields, target/orientation, projection/FOV.
- Selection, hidden/visible element sets.
- Section planes.
- Appearance overrides.
- Redline geometry/content.
- Model transform/reference context and model/version fingerprint.

Those properties may be available through the Navisworks API, but the present sources do not serialize them to BIMLog or restore them from BIMLog. Each property family needs a round-trip fixture on both supported Navisworks versions before it may be called reconstructable. Phase 1 uses only navigation to an existing exact physical object and must not claim visual reconstruction.

## 4. Responsive interface/native bridge communication

Use an isolated Lens Next loopback bridge with versioned JSON request/response envelopes. The web-style panel owns rendering and authenticated BIMLog reads; the native bridge owns Navisworks-only operations and marshals every UI operation to the Navisworks UI/Idle thread.

The current Legacy precedent is `BIMLogLocalServer.cs` on `localhost:8765`, called by the web page through `PLUGIN_BASE`. That server supports ping and jump, queues native work, and executes it from Navisworks Idle. It also demonstrates why Next needs hardening: Legacy uses its own port, fixed origin, silent exception swallowing, GET actions, and optional label/code matching.

Lens Next must use its own bridge port/config, plugin identity, origin policy, short-lived per-session bridge token, request ID/idempotency key, explicit protocol version, bounded payloads/timeouts, structured errors, and exact identity fields. Phase 1 bridge commands are limited to `ping`, `capabilities`, `project-context`, and read-only `open-working-view`. No status/comment/capture/publish/migration commands may be registered in production read-only mode.

## 5. Identity model for Working Views and Published Viewpoints

- **BIMLog Issue:** authoritative platform identity. For Phase 1, every operation must carry `projectId`, platform `serverId`, `viewpointId`, and the current revision/lifecycle identity returned by BIMLog. A stable issue-family UUID is a schema gap; `issueGroupId` is optional and groups multi-trade saves rather than universally identifying an issue chain.
- **Working View:** ephemeral bridge session object: `{sessionId, projectId, serverId, viewpointId, modelFingerprint}`. It is not a SavedViewpoint and is never persisted by simply opening/jumping.
- **Published Viewpoint:** a separately registered optional output with its own immutable `publicationId`, linked to one BIMLog Issue identity and one physical Navisworks identity (`bimlogPhysicalId` plus `navisworksGuid`) under a model fingerprint and publication profile.

No operation may resolve by display label, folder path, tree position, current active view, or a single non-unique scalar. Missing or multiple candidates block.

## 6. Duplicate-free published-viewpoint updates

The current platform has no Lens Next publication registry. Its active partial unique indexes protect current Lens records by project/viewpoint ID, Navisworks GUID, and display ID, but they do not express one publication per issue/profile/model.

Before Phase 4, add an explicit publication aggregate with a server-issued `publicationId`, a unique key such as `(project_id, issue_identity, publication_profile, model_fingerprint)`, the physical ID/GUID, current payload revision, and removal state. Publish uses a client idempotency key plus a transaction/advisory lock. Existing exact publication updates in place; zero matches creates once; multiple matches block for recovery. Removing a published copy changes the publication record and physical copy only; it never deletes the BIMLog Issue. A local marker alone is not server authority.

## 7. Full Legacy/Next isolation

The contract reserves separate values for every required surface: assembly/DLL/root namespace, Navisworks plugin/button/dock IDs, install folder, installer/uninstaller, configuration directory/file, cache, logs, feature-flag prefix, metadata source/namespace, commands, bridge endpoint, and published folder/marker.

Legacy identifiers observed and protected include assembly `BIMLogNavisPlugin`, namespace `BIMLogNavisPlugin`, dock plugin `BIMLogLens.IgniteSmart`, button `BIMLogLensButton.IgniteSmart`, bridge port 8765, metadata source `BIMLogLens`, and `%APPDATA%\BIMLog` files such as `config.json`, `synced_viewpoints.json`, `sequence.json`, `trade_floor_sequence.json`, and `levels_cache.json`.

Lens Next must never enumerate/process a SavedViewpoint merely because it is under a Legacy BIMLog folder or has a Legacy label. It may read a Legacy candidate only inside an explicit migration dry run. Install/update/uninstall must be path-scoped to Next and must not touch Legacy binaries, settings, caches, logs, metadata, SavedViewpoints, or registry/manifest entries.

## 8. Migration for clean and damaged projects

The existing copied-model import contract is transactional and idempotent for metadata import, but it is not the requested migration system. It creates target Lens rows and lineage mappings; it has no dry-run classification of physical Navisworks candidates, visual payload transfer, manual ambiguity decisions, or full rollback of Navisworks mutations.

Required migration sequence:

1. Read-only inventory of platform rows and physical SavedViewpoints with source hashes/model fingerprint.
2. Dry-run classify exactly the six section-12 relationships plus duplicate/recovery signals.
3. Produce a reviewable plan with no rename/move/recreate/delete.
4. Auto-eligible only for exact one-to-one matches with complete immutable identity.
5. Route missing/ambiguous/conflicting cases to manual selection: keep canonical, quarantine duplicate, or leave unresolved.
6. Apply under a project-scoped transaction journal with before-state snapshots and compensating rollback.
7. Verify exactly one physical identity owner, Jump, workflow isolation, publish behavior, and visual fingerprints.
8. Reclassify old SavedViewpoints as published legacy outputs only after successful validation.

Damaged projects must remain unchanged when any apply or verification step fails. No automatic migration on install/open.

## 9. Estimated development time by phase

Planning estimates, not delivery commitments. Assumes one web/backend engineer and one Navisworks engineer working in parallel, supported local Navisworks 2021/2025 test environments, and timely independent QA. Field/customer acceptance time is excluded.

| Phase | Estimated engineering elapsed time | Principal exit gate |
| --- | --- | --- |
| Phase 1 — read-only | 3–5 weeks | Isolated panel, authenticated issue read, strict immutable Jump/Open, project/connectivity/refresh states, Legacy non-regression |
| Phase 2 — direct workflow | 3–5 weeks | Flagged sandbox-only comments/assignment/status, conflict/idempotency/audit proof, visual state unchanged |
| Phase 3 — visual capture | 6–10 weeks | Versioned complete payload, 2021/2025 capture/restore round trips, model fingerprint safety |
| Phase 4 — publishing | 4–6 weeks | Transactional duplicate-free individual/bulk/package publishing and safe removal |
| Phase 5 — migration/recovery | 6–10 weeks | Dry run, clean/damaged matrices, manual ambiguity workflow, rollback, preserve-first proof |
| Phase 6 — pilot/rollout | 3–6 weeks plus field window | Approved sandbox-to-pilot progression, performance, Legacy fallback, field acceptance |

Likely total before controlled pilot readiness: approximately 25–42 engineering weeks, with overlap possible only after identity, visual-payload, and isolation gates are accepted.

## 10. Risks, dependencies, and pilot recommendation

### Highest risks

- Current platform visual payload is incomplete; assuming screenshots or native SavedViewpoints are a server-side digital twin would cause data loss.
- Current UI/Legacy code contains label/code convenience paths. Any such fallback in Next would violate the charter.
- `serverId` identifies a row/revision, while a universal stable issue-family identity is not explicit in the current schema.
- Native Navisworks visual behavior and APIs differ by version; 2021/2025 require independent builds and round-trip tests.
- Loopback browser/native communication needs authentication, origin/PNA/CORS handling, replay protection, and UI-thread marshalling.
- Hundreds of issues plus thumbnails/visual payloads can create panel, network, and Navisworks-tree performance pressure.
- Legacy duplicate/damaged files can contain conflicting identities; automated repair would be unsafe.
- A status write coupled to a visual operation could corrupt camera/state; contracts and tests must keep the aggregates separate.

### Dependencies

- Accepted isolated plugin identity and installer manifest.
- Read-only Lens Next API/view model and stable issue-family identity decision.
- Versioned visual payload schema plus upload/storage limits before Phase 3.
- Publication registry before Phase 4.
- Supported Navisworks 2021/2025 SDK references and local test installations.
- Sandbox project, approved pilot users, independent QA, and performance fixtures with hundreds of issues.

### Recommended pilot

Use a synthetic or sanitized F-root sandbox project first, containing hundreds of issues and deliberately clean, missing, ambiguous, duplicate, sectioned, hidden-item, override, and redline cases. After every local gate passes, use a separately approved copy of one representative active-project NWF—not the live production file—with read-only production mode maintained and writes enabled only for an approved sandbox/pilot project. Keep Legacy installed and available throughout. Do not use an already damaged live NWF as the first pilot.

## Phase 1 decision

**Proceed, bounded.** The identity/isolation contract is sufficient to start isolated Phase 1 read-only source and tests. Phase 1 must treat missing thumbnails honestly, use project-member-authenticated BIMLog reads, invoke only the Next bridge, require an exact immutable identity match for Jump/Open, create no permanent SavedViewpoint, and prove Legacy bytes/identifiers/config paths remain unchanged. Phase 2 and later are not authorized by this assessment alone; they depend on their predecessor gates and explicit feature-flag/sandbox boundaries in the controlling charter.
