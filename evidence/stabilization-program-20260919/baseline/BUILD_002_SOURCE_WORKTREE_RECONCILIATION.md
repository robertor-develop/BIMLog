# Build 002 — Source, worktree, and branch reconciliation

Captured: 2026-09-19 EDT  
Program: BIMLog stabilization, completion, and release program  
Build: 002 of 120  
Result: `PASS_WITH_PRESERVATION_MAP`  
Mode: read-only reconciliation; no merge, cleanup, checkout, reset, or source mutation

## Authority and owner

- Constitution verification: `ALLOW`
- Constitution: `3.4.0`
- Amendment head: `AMENDMENT-0020`
- Reconciliation owner for every listed BIMLog candidate: `BIMLog MAIN 04`
- Replit Agents used: `NO`
- Side tasks or internal agents used: `NO`

## Authoritative continuation

The authoritative product source tree remains GitHub `master` commit:

`07d024ef3de739abb436da58fe29797af5304b8a`

The clean published-source worktree at
`F:\BIMLog\Worktrees\bimlog-dashboard-block1-20260918` points to that exact
commit and remains the safe comparison baseline. It was not modified.

The canonical checkout at `F:\BIMLog\Repositories\bimlog` is not a release
source. Its local `main` is `835354da1ded3fd742e6b80246ea52f35de50aae`,
which is 2,258 commits behind and one unique commit ahead of the published
baseline, with eleven dirty/untracked entries. GitHub `main` at
`63983e72c8530460d967c00f82b94b27a99cac13` is an ancestor of published
`master`, 335 commits behind and zero ahead. Neither `main` identity may replace
published `master` by branch-name inference.

## Replit publication-marker reconciliation

Build 001 correctly observed that Replit Shell `master` points to
`132d132e4000dcfe5db5ab47a940afa99ab9c89`, not the GitHub commit ID. Build 002
proved why:

- Replit HEAD: `132d132e4000dcfe5db5ab47a940afa99ab9c89`
- Parent: `07d024ef3de739abb436da58fe29797af5304b8a`
- Timestamp: `2026-09-19T02:54:32Z`
- Subject: `Published your App`
- Replit `origin/master`: `07d024ef3de739abb436da58fe29797af5304b8a`
- Replit versus `origin/master`: zero behind, one commit ahead
- Replit HEAD tree: `fb27a5e19d9572cb96c1c7b01af1f5f01617590d`
- Parent tree: `fb27a5e19d9572cb96c1c7b01af1f5f01617590d`
- Files changed by marker commit: `0`
- Replit worktree: clean

Classification: `EMPTY_PROVIDER_PUBLICATION_MARKER_TREE_MATCH_PASS`.

Therefore GitHub and Replit have different commit IDs but identical source
trees. The Build 001 provisional provider-source divergence is superseded by
this tree-level proof. Future release receipts must record both the GitHub
source commit and the Replit publication marker instead of falsely requiring
their commit hashes to be equal.

## Complete worktree topology

- Registered worktrees: `142`
- Clean, present worktrees: `123`
- Dirty, present worktrees: `18`
- Missing/prunable registry entries: `1`
- Worktrees exactly at published HEAD: `1`
- Worktree HEADs that are ancestors of published source: `81`
- Worktree HEADs that are descendants of published source: `0`
- Worktree HEADs diverged from published source: `60`

The missing entry is:

- Path: `C:\Users\soporte\.codex\worktrees\97cc\bimlog`
- Detached HEAD: `79f296f6fe16e0740c56ecf2595768b0b9f47e8a`
- Subject: `docs(recovery): correct candidate and BIMTech planned-state truth`
- Relationship: ancestor of published source
- Owner/status: `BIMLog MAIN 04 / PRESERVE_REGISTRY_ENTRY_UNTIL_RECOVERABLE_CLEANUP_REVIEW`

No worktree was pruned, repaired, moved, deleted, cleaned, or altered.

## Dirty-worktree preservation map

Every dirty worktree has an explicit owner and status. “Effective diff” means
compare actual behavior/files against the published tree before deciding to
integrate or supersede; it does not authorize integration.

| Branch | Relationship | Tracked | Untracked | Owner/status |
|---|---:|---:|---:|---|
| `main` | diverged | 1 | 10 | BIMLog MAIN 04 — preserve; canonical checkout is not a release source |
| `codex/commercial-financial-recovery-successor-20260731` | diverged | 2 | 34 | BIMLog MAIN 04 — preserve dirty delta; effective diff required |
| `codex/electron-runtime-hardening-20260803` | diverged | 0 | 1 | BIMLog MAIN 04 — preserve untracked fixture/evidence; classify before cleanup |
| `codex/generic-apu-ui-20260805` | diverged | 2 | 2 | BIMLog MAIN 04 — preserve dirty delta; effective diff required |
| `codex/generic-apu-ui-row8-states-20260805` | diverged | 0 | 1 | BIMLog MAIN 04 — preserve untracked test candidate; classify before cleanup |
| `codex/living-brief-runtime-closure-20260805` | ancestor | 3 | 0 | BIMLog MAIN 04 — preserve documentation delta; effective diff required |
| `codex/bimlog-build38-navisworks2025-field-rc-20260907` | diverged | 0 | 4 | BIMLog MAIN 04 — preserve Native packages/evidence; field reconciliation required |
| `codex/bimlog-build39-xml-missing-scale-20260908` | diverged | 0 | 2 | BIMLog MAIN 04 — preserve Native package evidence; classify before cleanup |
| `codex/bimlog-build41-xml-legacy-repair-20260908` | ancestor | 0 | 2 | BIMLog MAIN 04 — preserve Native package evidence; classify before cleanup |
| `codex/bimlog-build7-advanced-contracts-backend-20260816` | diverged | 0 | 1 | BIMLog MAIN 04 — preserve disposable fixture; classify before cleanup |
| `codex/bimlog-feedback-addendum-20260817` | ancestor | 0 | 2 | BIMLog MAIN 04 — preserve untracked scanner source/tests; effective diff required |
| `codex/bimlog-lens-mockup-block01-20260917` | ancestor | 13 | 1 | BIMLog MAIN 04 — active Lens/platform delta; preserve and reconcile in program |
| `codex/lens-next-build25e-manual-range-proof-20260905` | ancestor | 0 | 3 | BIMLog MAIN 04 — preserve field evidence; classify before cleanup |
| `codex/lens-next-build32-create-open-repair-20260907` | ancestor | 1 | 2 | BIMLog MAIN 04 — preserve package receipt and artifacts; reconcile identity |
| `codex/lens-next-forensic-recovery-20260831` | ancestor | 1 | 35 | BIMLog MAIN 04 — mixed source/evidence; preserve and effective-diff |
| `lens-next-m3-authoritative-integration` | diverged | 13 | 22 | BIMLog MAIN 04 — mixed Lens source/schema candidate; preserve and effective-diff |
| `DETACHED` at `6936f546...` (`bimlog-n09-p04-release-20260902`) | ancestor | 4 | 4 | BIMLog MAIN 04 — mixed generated/brief/package state; preserve and classify |
| `codex/bimlog-product-defaults-block01-20260915` | diverged | 2 | 0 | BIMLog MAIN 04 — preserve Living Brief delta; effective diff required |

The active Lens mockup delta contains 209 insertions and 65 deletions across
eleven tracked files plus one untracked responsible-company behavior test. The
older M3 Lens candidate contains 378 insertions and 14 deletions across ten
tracked diff-visible files plus additional tracked/untracked Lens workflow,
publishing, visual-state, route, and schema files. These candidates overlap;
neither is safe to merge wholesale.

## Ancestry-unmerged branch classification

Exactly `61` local branches are not ancestors of published source. Every one is
classified as `PRESERVE_DIVERGED_BRANCH_EFFECTIVE_DIFF_REQUIRED` under
`BIMLog MAIN 04`, except the single unmapped recovery branch, which is
`PRESERVE_UNMAPPED_BRANCH_EFFECTIVE_DIFF_REQUIRED`. None may be merged,
cherry-picked, deleted, or called authoritative solely because it has unique
commits.

Checked-out/mapped branches (`60`):

1. `codex/auth-audit-redaction-rebind-20260816`
2. `codex/auth-redaction-card1-20260730`
3. `codex/bimlog-build38-navisworks2025-field-rc-20260907`
4. `codex/bimlog-build39-xml-missing-scale-20260908`
5. `codex/bimlog-build7-advanced-contracts-backend-20260816`
6. `codex/bimlog-build7-advanced-contracts-ui-20260816`
7. `codex/bimlog-coordination-release-a-build1-20260909`
8. `codex/bimlog-coordination-release-a-builds2-11-20260909`
9. `codex/bimlog-intake-apu-01-20260831`
10. `codex/bimlog-intake-apu-02-20260831`
11. `codex/bimlog-intake-apu-03-20260831`
12. `codex/bimlog-intake-apu-04-20260831`
13. `codex/bimlog-intake-apu-05-20260831`
14. `codex/bimlog-intake-apu-06-20260831`
15. `codex/bimlog-intake-apu-07-20260831`
16. `codex/bimlog-intake-apu-08-20260831`
17. `codex/bimlog-intake-apu-09-20260831`
18. `codex/bimlog-intake-apu-10-20260901`
19. `codex/bimlog-lens-next-20260812`
20. `codex/bimlog-lens-sync-correlation-api-20260813`
21. `codex/bimlog-next200-block01-20260915`
22. `codex/bimlog-prework02-security-20260908`
23. `codex/bimlog-prework02-security-build47-20260908`
24. `codex/bimlog-prework03-project-retirement-20260908`
25. `codex/bimlog-prework03-retirement-build47-20260908`
26. `codex/bimlog-prework04-enterprise-identity-20260908`
27. `codex/bimlog-prework04-enterprise-identity-build47-20260908`
28. `codex/bimlog-prework05-action-audit-build47-20260908`
29. `codex/bimlog-prework06-connector-foundation-build47-20260908`
30. `codex/bimlog-product-defaults-block01-20260915`
31. `codex/bimlog-smoke-intake-01-client-contact-20260907`
32. `codex/clash-report-delete-reason-20260805`
33. `codex/clash-reports-ui-correction-20260805`
34. `codex/commercial-financial-recovery-successor-20260731`
35. `codex/dashboard-two-path-encoding-guard`
36. `codex/electron-runtime-hardening-20260803`
37. `codex/generic-apu-ui-20260805`
38. `codex/generic-apu-ui-clean-six-20260805`
39. `codex/generic-apu-ui-row8-states-20260805`
40. `codex/h1-http-runtime-20260730`
41. `codex/help-center-print-pdf-20260811`
42. `codex/integration-runtime-ui-20260730`
43. `codex/lens-next-build25j-import-diagnostic-20260905`
44. `codex/linked-items-creation-ux-20260805`
45. `codex/living-brief-f5-password-removal-20260805`
46. `codex/platform-pdf-consistency-20260730`
47. `codex/process-manifest-phase-a-20260730`
48. `codex/procore-rfi-e2e-20260805`
49. `codex/public-origin-phase-a-20260730`
50. `codex/release-clash-readonly-20260805`
51. `codex/replit-create-observability-reconcile-20260902`
52. `codex/ux-master-sidebar-failures-20260730`
53. `codex/ux-project-shell-states-20260730`
54. `codex/ux-project-sidebar-modal-20260730`
55. `codex/ux-public-pricing-features-es-20260730`
56. `codex/worker-runtime-20260730`
57. `integrations-error-state-20260730`
58. `lens-next-m3-authoritative-integration`
59. `main`
60. `recovery/proposed-rfi-20260729`

Unmapped branch (`1`):

61. `recovery/platform-print-pdf-successor-20260728`

Two pairs share identical heads and must not be counted as independent product
changes:

- `codex/generic-apu-ui-20260805` and
  `codex/generic-apu-ui-row8-states-20260805` share
  `362c9533ab432206bbb2ed207bbf4d8746bf4260`.
- `codex/dashboard-two-path-encoding-guard` and
  `recovery/platform-print-pdf-successor-20260728` share
  `4129f37b00d5da50a350fba53c89911b5b2c40b9`.

High-volume current candidates remain candidates, not authorities:

- Next-200: 135 published-only commits / 71 candidate-only commits.
- Product defaults: 60 published-only / 44 candidate-only commits.
- Lens mockup committed HEAD: 26 published-only / zero candidate-only commits,
  plus the preserved uncommitted delta listed above.
- M3 Lens integration: 773 published-only / one candidate-only commit, plus its
  preserved uncommitted delta.

## Reconciliation decision

`AUTHORITATIVE_CONTINUATION=GITHUB_MASTER_07d024ef3de739abb436da58fe29797af5304b8a`

`REPLIT_SOURCE_TREE_MATCH=PASS`

`CANONICAL_LOCAL_MAIN_SAFE_FOR_RELEASE=NO`

`BLIND_MERGE_OR_CLEANUP_AUTHORIZED=NO`

`WORKTREE_PRESERVATION_MAP=COMPLETE`

Build 003 may now inventory release scripts, provider instructions, schema
checks, rollback paths, and historical receipts against this exact authority.
Later Builds 026-030 own effective-diff integration and recoverable cleanup;
Build 002 intentionally performs neither.

## Mutation boundary and program position

- Product/source files changed: `NO`
- BIMLog evidence/worktrees changed: `NO`
- Git merge/cherry-pick/rebase/reset/clean/prune: `NO`
- Commit/push/publish/deploy: `NO`
- Replit provider/source changed: `NO`
- Database/schema/customer data changed: `NO`
- Completed builds: `2 of 120`
- Remaining builds: `118`
- Current unpublished builds: `2 of maximum 10`
- Next build: `003 — release-script, provider-procedure, schema-check, rollback, and receipt inventory`
- Next push: after Build `005`
- Next publication and authenticated Chrome smoke: after Build `010`
- Blocker: `NONE_FOR_BUILD_003`

