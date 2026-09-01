# N05 VISUAL PACKAGE READINESS CONTRACT REPORT

Date: 2026-09-01  
Scope: BIMLog Lens Next Navisworks Manage 2021 and 2025  
Field evidence: Project 30, Issue 684, display ID `OT-001`, viewpoint `0d308675-9a55-495d-9389-191c643a87a0`  
Field build: `v1.05.N04-P01`; native and core file version `1.5.4.1`  
Candidate evaluated here: `v1.05.N05-P01`; binary file version `1.5.5.1`  
Release state: **SOURCE CANDIDATE ONLY — NOT PACKAGED, INSTALLED, PUBLISHED, PUSHED, OR SENT**

## Executive determination

The digest is good. The stored, received, and recomputed Issue 684 digest is exactly:

`cf79a06ed8cdd429f9da919b2b776c8e09485f52731f2af5da259b8845fbdc92`

Contract: `lens-next-visual-digest.v2`; canonical length: `4834`; field validation: `13 ms`.

N04 rejected the package one millisecond later because its readiness contract treated every schema component as required and treated one global bounded model-scan truncation as incompleteness of both visibility and appearance. Issue 684 contains six hidden objects and its visibility scan was incomplete. Exact visibility restoration therefore cannot be proved. Appearance contains zero overrides, but N04 nevertheless marked appearance required and incomplete because the same global scan was truncated.

Issue 684 does **not** qualify for FULL RESTORE. Its active visibility state is incomplete, so restoring it exactly would require guessing. N05 continues to block this historical package, but identifies every blocking component and reason precisely. It does not weaken exact-restore doctrine to force the package open.

N05 fixes the system contract instead:

- requiredness comes from active/meaningful captured state, not field presence;
- empty collections are valid complete states;
- component presence, activity, capture, completeness, support, truncation, count, and status are separate facts;
- capture and apply use the same readiness evaluator;
- a current-build capture cannot claim success if that same package would be rejected by apply;
- visibility and appearance are scanned and diagnosed independently;
- the old generic 409 is removed;
- camera remains mandatory;
- no partial restore is silently invented;
- no Navisworks Saved Viewpoint is created.

## 1. Exact failing components in N04

Two stored N04 component declarations failed the generic readiness predicate:

1. `Visibility`
   - Required: `true`
   - Captured: `false`
   - Supported: `true`
   - Active data: `true` (six hidden references)
   - Truncated: represented only by the package-wide diagnostic in N04
   - Reason: `Model scan exceeded the bounded capture limit; visibility is incomplete.`
   - This is a real exact-restore blocker. Six hidden objects prove visibility was active, but the truncated scan cannot prove that all hidden objects were captured.

2. `AppearanceOverrides`
   - Required: `true`
   - Captured: `false`
   - Supported: `true`
   - Active data: `false` (zero appearance overrides)
   - Truncated: represented only by the same package-wide diagnostic in N04
   - Reason: `Appearance scan exceeded the bounded capture limit.`
   - This is an N04 requiredness defect. The schema field existed, but the view contained no active appearance override. Schema presence alone must not make it required.

N04's generic message concealed both components.

## 2. Exact N04 source line and check

Historical N04 throw/return site:

- File: `plugins/BIMLogLensNext/native/AutodeskVisualStateAdapter.cs`
- Function: `ApplyVisualState`
- N04 source location: lines 141–145 before the N05 edit
- Condition: `state.Completeness != null && !state.Completeness.CanReconstructWithoutGuessing`
- Returned error: `Visual state declares a required component incomplete or unsupported; Lens Next will not guess.`

`LensNextVisualStateCompleteness.CanReconstructWithoutGuessing` evaluated each component whose `RequiredForReconstruction` was true and required both `Supported == true` and `Captured == true`. N04's `NewCompleteness()` hard-coded camera, selection, visibility, appearance, model references, and sectioning as required before it knew whether those components were active. The global model scan then set both visibility and appearance `Captured=false` when the 250,000-element bound was exceeded.

The N04 false branch was therefore:

`Visibility.Required && !Visibility.Captured`, and independently `AppearanceOverrides.Required && !AppearanceOverrides.Captured`.

## 3–6. Issue 684 capture, persistence, apply interpretation, and rejection reason

### Authoritative stored summary

| Field | Value |
|---|---|
| issueId | `684` |
| projectId | `30` |
| displayId | `OT-001` |
| viewpointId | `0d308675-9a55-495d-9389-191c643a87a0` |
| visual package schema | `bimlog.lens_next.visual_state.v1` |
| digest contract | `lens-next-visual-digest.v2` |
| capturedAtUtc | `2026-09-01T15:35:36.9960562+00:00` |
| capture source | `BIMLog Lens Next / Navisworks 2021` |
| JSON size | `178291` bytes |
| camera | present |
| selection count | `0` |
| hidden count | `6` |
| appearance count | `0` |
| model count | `17` |
| sectioning | active; one plane |
| redlines | absent/empty |
| screenshot | present |
| package diagnostic truncated | `true` |

### Three-stage comparison

| Component fact | Capture receipt | Server persistence | N04 apply interpretation |
|---|---|---|---|
| Identity | provisional server identity used during capture | rebound atomically to authoritative Issue `684`; digest recomputed | authoritative identity accepted |
| Camera | captured successfully | present, captured/supported/required | ready |
| Selection | count `0`, captured successfully | empty list preserved; captured/supported/required | ready; empty was not the current blocker |
| Visibility | six hidden references found; global scan truncated | six references preserved; `Captured=false`, `Supported=true`, `Required=true` | **blocked** because required and captured=false |
| Appearance | zero overrides found; same global scan truncated | empty list preserved; `Captured=false`, `Supported=true`, `Required=true` | **blocked** because required and captured=false despite inactive data |
| Model references | 17 models captured | 17 preserved; captured/supported/required | ready |
| Sectioning | active, one plane | payload preserved; captured/supported/required | ready |
| Redlines | none | empty/absent; captured/supported/not required | nonblocking |
| Screenshot | captured | present; captured/supported/not required | nonblocking |
| Digest | pre-authoritative-identity digest emitted | server assigned Issue 684 and recomputed authoritative digest; component state unchanged | stored=received=recomputed; accepted in 13 ms |

There is no silent component mutation between capture and persistence. The only intentional mutation is provisional-to-authoritative server identity, followed by deterministic digest recomputation. The rejection comes from contradictory N04 capture/apply policy: N04 allowed CREATE to succeed while storing required components as incomplete, then apply rejected the same package.

## 7. Full component requiredness matrix

N05 uses the following deterministic matrix. `Present`, `Active`, `Complete`, `Supported`, and `Required` are independent.

| Component | Active/meaningful rule | Required rule | Valid empty/absent state | Blocking rule |
|---|---|---|---|---|
| Camera | always active for a working view | always required | none | missing, incomplete, or unsupported camera blocks |
| Selection | active when captured selection count > 0 | required only when active in current packages | `[]` is complete and nonblocking | active selection that is incomplete, truncated, unresolved, or unsupported blocks |
| Visibility/hidden | active when hidden/isolation references exist | required only when active | `[]` is complete and nonblocking | active visibility that is incomplete, truncated, unresolved, or unsupported blocks |
| Appearance overrides | active when override records exist | required only when active | `[]` is complete and nonblocking | active appearance that is incomplete, truncated, unresolved, or unsupported blocks |
| Model references | active when the package identifies source models | required for deterministic reference resolution | a deliberately empty model set is allowed only when no active reference-bearing component needs it | missing/incomplete/unsupported references needed by active state block |
| Sectioning/clipping | active when a meaningful section payload exists | required only when active | null/inactive sectioning is complete and nonblocking | active sectioning that is incomplete or unsupported blocks |
| Redlines | active when redline state is actually present | required only when product semantics declare active redlines authoritative; current package keeps them noncritical | absent/empty is nonblocking | no silent exact-restore claim if future contract marks active redlines required and they cannot restore |
| Screenshot | present when thumbnail/screenshot bytes or reference exists | never required for Navisworks apply | absent is nonblocking | screenshot failure does not block camera/visual-state apply |

### State taxonomy

N05 distinguishes:

- `absent/inactive`: component was not used; nonblocking;
- `captured complete`: component is available for exact restore;
- `captured intentionally empty`: valid complete state with count zero;
- `unsupported inactive`: nonblocking;
- `unsupported active required`: blocking with the exact component and reason;
- `capture failed`: blocking if active/required;
- `truncated`: blocking if active/required;
- `omitted by legacy contract`: evaluated with explicit backward-compatibility rules rather than undefined-to-false coercion.

For legacy packages that already explicitly declare `RequiredForReconstruction`, N05 honors that declaration. It does not reinterpret historical incomplete data as complete. New packages carry explicit activity/completeness/truncation/count/status metadata.

### Issue 684 matrix

| Component | Present | Active | Count | Complete | Supported | Required | Truncated | Result/reason |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Camera | yes | yes | 1 | yes | yes | yes | no | ready |
| Selection | yes | no | 0 | yes | yes | N04 stored yes; N05 current semantics no | no | valid empty |
| Visibility | yes | yes | 6 | no | yes | yes | yes/inferred | **blocking: incomplete bounded scan of active hidden state** |
| Appearance | yes | no | 0 | no in N04 metadata | yes | N04 stored yes; N05 current semantics no | yes/inferred | historical N04 declaration blocks; current semantics identify it as inactive |
| Model references | yes | yes | 17 | yes | yes | yes | no | ready |
| Sectioning | yes | yes | 1 plane | yes | yes | yes | no | ready |
| Redlines | no/empty | no | 0 | yes | yes | no | no | nonblocking |
| Screenshot | yes | yes for thumbnail only | 1 | yes | yes | no | no | nonblocking for apply |

## 8. Changes made for N05

### Shared contract

`LensNextVisualStateComponentCompleteness` now has backward-compatible nullable metadata:

- `Active`
- `Complete`
- `Truncated`
- `Count`
- `Status`

The new shared evaluator is `LensNextVisualReadiness`, contract `lens-next-visual-readiness.v1`. It returns a component-by-component report and a complete blocking diagnostic containing:

`Component, Required, Active, Present, Captured, Complete, Supported, Truncated, Count, Status, Reason`.

### Capture

- Removed the 250,000-element early termination from the model scan.
- Scans the full model to establish visibility and appearance truth.
- Tracks visibility and appearance truncation independently.
- Records actual active counts.
- Treats empty selection, hidden, and appearance lists as complete.
- Makes sectioning required only when active.
- Keeps screenshot non-required.
- Detects capped/unresolved immutable references on the relevant component only.
- Calls `LensNextVisualReadiness.EnsureCaptureCanReopen(state)` before claiming a successful Visual Package.

### Apply

- Uses the same `LensNextVisualReadiness.Evaluate(state)` contract as capture.
- Logs `component-readiness-evaluated` with all component facts.
- Removes the generic readiness 409.
- Returns: `Working View cannot be restored exactly: <component diagnostics>`.
- Preserves the existing camera, sectioning, visibility, appearance, selection, and redline application sequence.
- Does not create or depend on a Saved Viewpoint.

### Result doctrine

The implemented N05 result is deterministic FULL RESTORE or precise BLOCKED. A silent PARTIAL RESTORE was not introduced because current product doctrine requires exact restoration of active required state. The data model can identify noncritical inactive limitations without blocking, but it does not call a guessed result successful.

## 9. Automated A–M matrix results

All required fixtures pass:

| Fixture | Expected | Result |
|---|---|---|
| A camera only | open | PASS |
| B camera + selection | open | PASS |
| C camera + hidden | open | PASS |
| D camera + appearance | open | PASS |
| E camera + active supported sectioning | open | PASS |
| F camera + inactive/null sectioning | open | PASS |
| G empty selection | not incomplete; open | PASS |
| H empty appearance | not incomplete; open | PASS |
| I empty hidden | not incomplete; open | PASS |
| J unsupported inactive component | nonblocking; open | PASS |
| K unsupported active required component | precise block | PASS |
| L truncated active required component | precise block | PASS |
| M same current-build capture/open contract | creation-ready package accepted by apply evaluator | PASS |

Complete validation totals:

- shared/core contract suite: `51/51 PASS`
- Navisworks 2021 native contract suite: `49/49 PASS`
- Navisworks 2025 native contract suite: `49/49 PASS`
- 2021 Release build: `PASS`, zero warnings, zero errors
- 2025 Release build: `PASS`, zero warnings, zero errors

## 10. Proof a new current-build issue reopens

Fixture M constructs a current N05 Visual Package, invokes `EnsureCaptureCanReopen`, and then evaluates the exact same state through the apply readiness evaluator. Both accept it. Native contract tests also prove capture contains the same readiness gate used by apply.

This proves source/contract self-consistency: N05 cannot return successful capture for a package that its own readiness evaluator would reject moments later.

This is automated pre-package proof, not a claim of live field acceptance in Navisworks. A packaged N05 has deliberately not been created or sent, so live 2021/2025 field acceptance remains a later release gate.

## 11. Proof the visual digest remains identical

- No camera, selection, visibility, appearance, model-reference, sectioning, redline, screenshot, identity, or canonical ordering rule was changed.
- Completeness/readiness metadata is deliberately excluded from digest canonicalization.
- Existing digest v1/v2 regression fixtures continue to pass.
- Fixture M computes the digest, changes readiness metadata, recomputes, and proves the digest is identical.
- Issue 684 continues to prove stored, received, and recomputed v2 digest equality.

Canonicalization was not modified to solve this readiness failure.

## 12. Proof camera restores

- Camera is always active and required in the readiness matrix.
- Fixtures A through F and M require a valid camera and pass only when it is ready.
- Native apply retains the `ApplyCamera` operation before dependent visual-state restoration.
- Missing, incomplete, or unsupported camera state produces a precise block; there is no global camera-only fallback.

## 13. Proof no Saved Viewpoint is created

- Apply mutates the current Navisworks viewpoint/model/selection state only.
- The native implementation contains no Saved Viewpoint creation call in the working-view apply path.
- Existing native regression `legacy_and_saved_viewpoints_never_touched` passes.
- The existing redline inspection helper may read current Saved Viewpoint redline context; it does not create a Saved Viewpoint.

This preserves the product rule: Open Working View operates on temporary current state and does not clutter Navisworks Saved Viewpoints.

## 14. Proposed N05 version

Proposed Lens Next candidate:

`v1.05.N05-P01`

Binary file version:

`1.5.5.1`

`P01` is preserved. This is a native Lens Next contract repair and does not increment the Platform/APU-owned P counter. No Replit/platform mutation or publish is required for this native readiness repair; the production database was accessed read-only solely to inspect Issue 684.

## Release gate and stop condition

The N05 source candidate passes the complete automated readiness matrix and both product-year builds. Issue 684 remains honestly non-reopenable as an exact historical package because its active visibility capture was truncated. It must be recreated from the intended live view under N05 after packaging and installation, at which point N05 will either create a self-consistent reopenable package or block capture with a precise component reason.

Per instruction, work stops here before package creation. No N05 ZIP has been built or sent to Ruben.
