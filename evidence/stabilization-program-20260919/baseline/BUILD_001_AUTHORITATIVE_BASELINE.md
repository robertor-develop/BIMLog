# Build 001 — Authoritative starting baseline

Captured: 2026-09-19T00:26:03-04:00  
Program: BIMLog stabilization, completion, and release program  
Build: 001 of 120  
Result: `PASS_WITH_BASELINE_GAPS_CAPTURED`  
Mode: read-only identity inventory

## Authority receipt

- Constitution version: `3.4.0`
- Amendment head: `AMENDMENT-0020`
- Constitution SHA256: `8735a823825f8db86143f5a9c7bd48d204c043b7f2f52bbf934522ef4342ae32`
- Verification result: `ALLOW`
- Replit Agents used: `NO`
- Side tasks or internal agents used: `NO`

## Source and branch identities

### Canonical local checkout

- Path: `F:\BIMLog\Repositories\bimlog`
- Branch: `main`
- HEAD: `835354da1ded3fd742e6b80246ea52f35de50aae`
- Tracking state: `ahead 1, behind 1923` relative to `origin/main`
- Worktree clean: `NO`
- Dirty/untracked entries: `11`
- Dirty paths were inventoried only; none were cleaned, staged, reverted, or altered.

### Live GitHub heads

Verified visibly in signed-in Chrome against `robertor-develop/BIMLog`:

- `master`: `07d024ef3de739abb436da58fe29797af5304b8a` — `Fix Convention Builder hook order`
- `main`: `63983e72c8530460d967c00f82b94b27a99cac13` — `Merge remote-tracking branch 'origin/master' into deploy/p15-20260910`
- Remote branch coherence: `FAIL_DIVERGENT_HEADS`

### Published-source worktree

- Path: `F:\BIMLog\Worktrees\bimlog-dashboard-block1-20260918`
- Branch: `codex/dashboard-block1-20260918`
- HEAD: `07d024ef3de739abb436da58fe29797af5304b8a`
- Parent: `c46df4ac5dc59911a8e31090f027bc6038cfda8a`
- Subject: `Fix Convention Builder hook order`
- Worktree clean: `YES`
- Remote containment: `origin/master`

### Replit Shell workspace

Verified visibly in Replit Shell without Replit Agents:

- Project: `robertorrya/BIMLog-Ignite`
- Workspace path: `~/workspace`
- Branch: `master`
- HEAD: `132d132e4000dcfe5db5ab47a940afa99ab9c89`
- Worktree clean: `YES` (no porcelain status entries)
- Present in canonical local object store: `NO`
- Matches live GitHub `master`: `NO`
- Matches governed published-source worktree: `NO`
- Build 001 provisional classification: `PROVIDER_WORKSPACE_COMMIT_DIVERGENCE_REQUIRES_BUILD_002_RECONCILIATION`
- Build 002 correction: `EMPTY_PROVIDER_PUBLICATION_MARKER_TREE_MATCH_PASS` — Replit HEAD is an empty publication-marker child of GitHub `master`; both commits have tree `fb27a5e19d9572cb96c1c7b01af1f5f01617590d`.

No Git synchronization, reset, checkout, pull, merge, commit, push, or provider mutation occurred.

## Production and provider identity

- Public origin: `https://bimlog.app`
- API root: `HTTP 200`, body `{"status":"ok","service":"bimlog-api"}`
- Health: `https://bimlog.app/api/v1/healthz` -> `HTTP 200`, body `{"status":"ok"}`
- Visible authenticated Platform version: `v1.05.N17-P32`
- Canonical Super Admin workspace: `PASS` — Total Control loaded for Roberto Rodriguez / RRY Asociados
- Replit production state: `Public`, Autoscale, North America
- Replit production database: `connected`
- Latest visible Replit receipt: `9bb79bc6`
- Replit deployment/provision identity: `ae1fd4d7`
- Replit stages: Provision `PASS`; Security checks `PASS`; Build `PASS`; Bundle `PASS`; Promote `PASS`
- Provider log terminal state: `Deployment successful`
- Governed published source identity: `07d024ef3de739abb436da58fe29797af5304b8a`
- Live API independently exposes exact Git commit: `NO`
- Production database migration/version identity: `UNEXPOSED_NEEDS_BUILD_016_RECONCILIATION`

The governed published source and provider receipt are preserved as the starting release record. Because the live API does not independently expose an immutable commit, this record does not substitute provider history for a future executable release-identity contract.

## Installed Navisworks identities

Inventory root: `C:\ProgramData\Autodesk\ApplicationPlugins`

### Original / Legacy Lens

- Active bundle: `BIMLog.bundle`
- Manifest SHA256: `2FAA0C714D0C2B0C029488490F333ED38BAEECD0FC985ED7871B06A60E2240BD`
- DLL: `BIMLogNavisPlugin.dll`
- File version: `1.60.29.0`
- DLL SHA256: `574281AFD60F81C894D66F24663E4C1626F86F383A9A6C93D55CBAC37851D793`

### Lens Next 2021

- Active bundle: `BIMLogLensNext2021.bundle`
- Manifest SHA256: `35216AA80B99C8DC106C33474A71F8CB9CFE66580CC06D7DCD8A0B347911179E`
- Core DLL: `BIMLogLensNext.dll`
- Core version: `1.5.17.12`
- Core SHA256: `0AF5BC7AD025D6B6A0CE48D2BCD3796217F00860276250588F907684E845BA3D`
- Adapter DLL: `BIMLogLensNext.Native2021.dll`
- Adapter version: `1.5.17.12`
- Adapter SHA256: `4C49DE7D75C3BF5AEFD99C67ED3A0E2F84E2C4512AF1D48970960C1019F855B9`
- Rollback bundle directories still inside Autodesk discovery root: `15`
- Navisworks process running during inventory: `NO`

### Current source/package candidate identities

- Source target: `v1.05.N18-P33`
- Binary target: `1.5.18.33`
- 2021 package status: `BUILD_PACKAGE_PASS_NO_INSTALL`
- 2021 ZIP SHA256: `AC5C6E2F86EEF99D409D948FF4EAAF6EE001831630752BDA4AA8B0AD44E40AFA`
- 2021 Core SHA256: `4F4A7E9E67F7895431077D211D261406D5B44EB455B9D31CD190E91C23FE5A0E`
- 2021 Native SHA256: `1E3AFF993CC25A70B4BBB2EBD5AF37F169D31AA3E66AAFE09C98D54D00C46379`
- 2021 field acceptance: `PENDING_ROBERTO_NAVISWORKS_2021`
- 2025 package status: `BUILD_PACKAGE_PASS_NO_INSTALL`
- 2025 ZIP SHA256: `D7071AF4117C80A14E0006605668542C6A5D760D1D712859F01EECB0B3A6E7AC`
- 2025 Core SHA256: `4F4A7E9E67F7895431077D211D261406D5B44EB455B9D31CD190E91C23FE5A0E`
- 2025 Native SHA256: `3CF644A8731884A19997C18584BA144BB21422AAD102BF3A7B4D3A6AB299C100`
- 2025 field acceptance: `PENDING_RUBEN_NAVISWORKS_2025`

## Baseline gaps frozen by Build 001

1. GitHub `master` and `main` have different heads.
2. Replit Shell has a different commit ID from GitHub `master`; Build 002 proved it is an empty publication-marker child with an identical source tree, so this is a receipt-model requirement rather than source divergence.
3. The canonical local checkout is stale, divergent, and dirty; it is not a safe release source.
4. Platform `N17-P32`, installed Lens Next `N17-P12`, and source/package target `N18-P33` are not one coherent release identity.
5. Original/Legacy Lens and Lens Next are both active under Autodesk's plugin discovery root.
6. Fifteen Lens Next rollback bundles remain inside the active Autodesk discovery root.
7. Production database connectivity is proven, but its exact migration/checksum identity is not exposed.
8. Live health proves availability but not the exact deployed Git commit independently of provider records.

These are recorded defects for subsequent builds. They do not fail Build 001 because Build 001's acceptance criterion is an exact, non-inferred inventory.

## Mutation boundary

- Product code changed: `NO`
- Git branch or worktree changed: `NO`
- Commit/push/pull/merge/reset performed: `NO`
- Replit source/provider setting changed: `NO`
- Publish/deploy performed: `NO`
- Production database/schema/data changed: `NO`
- Navisworks plugin/installer changed: `NO`
- Customer record changed: `NO`

## Program position

- Completed build: `001`
- Completed builds count: `1`
- Remaining builds count: `119`
- Current unpublished builds: `1 of maximum 10`
- Next build: `002 — reconcile canonical checkout, published source, active worktrees, and branch ancestry without merging or cleaning`
- Next push: after Build `005`
- Next publication: after Build `010`
- Next full authenticated Chrome smoke: immediately after Build `010` publication
- Focused Navisworks smoke: required whenever an active block changes Lens Next Native or installers
- Authorization status: `AUTHORIZED_THROUGH_THE_REQUESTED_EXECUTION_CADENCE`
- Blocker: `NONE_FOR_BUILD_002`
