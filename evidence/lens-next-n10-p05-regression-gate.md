# Lens Next N10-P05 regression gate

## Scope and baseline

This non-production gate protects the frozen Lens Next core workflow at Platform
`v1.05.N10-P05` and native N10 (`FileVersion 1.5.10.4`). It does not change or
exercise production behavior, a customer environment, or the frozen fallback
artifact.

Run before future Lens Next changes from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-lens-next-n10-p05-regression.ps1
```

The command passes only when every automated contract exits successfully. A
passing automated gate is source/contract proof; it is not a claim that a real
Navisworks-to-Platform-to-database workflow was executed.

## Automated and source-contract proof

| Required regression contract | Repeatable evidence |
| --- | --- |
| Native capture returns success | `CORE_NATIVE_CONTRACTS` exercises the native bridge capture success contract. |
| Camera data exists | `new_viewpoint_capture_uses_minimal_navigation_payload` and camera payload assertions reject a successful capture without camera data. |
| Platform atomic creation commits successfully | `PLATFORM_ATOMIC_CREATE_SOURCE_CONTRACT` protects the existing `db.transaction(...)`, issue insert, visual-state rebind, and committed response sequence. Runtime commit success still requires the manual protocol below. |
| Authoritative BIMLog record exists | The create source contract protects the inserted/returned authoritative issue. Runtime persistence still requires the manual protocol below. |
| Open Working View invokes the existing native apply path | The Platform reconstruction and working-view contracts require `applyPlatformWorkingView(...)` with stored Platform state. |
| Writable temporary `Viewpoint` remains in use | `camera_apply_uses_writable_current_viewpoint_copy` requires `CurrentViewpoint.CreateCopy()` and rejects direct read-only mutation. |
| `DocumentCurrentViewpoint.CopyFrom(Viewpoint)` remains in use | The same native adapter contract requires `_document.CurrentViewpoint.CopyFrom(writableView)`. |
| Camera apply returns success | Native adapter and core bridge contracts exercise the successful apply response. |
| Normal workflow creates no local Navisworks Saved Viewpoint | Core tests require zero saved-viewpoint writes; UI source contracts reject `SavedViewpoint` use and local creation. |

The 2021 native adapter test is the available controlled compile/runtime contract
for the shared adapter source. The 2025 reference root is not available in this
controlled environment, so this gate does not claim a 2025 Navisworks execution.

## Manual acceptance protocol

Use only an approved controlled internal BIMLog account, project, model, and
Navisworks 2025 installation. Never use Ruben or a customer environment. If that
environment is not available, record `MANUAL_PROOF=NOT AVAILABLE`; do not invent
or substitute an environment.

1. Record date/time, tester, environment identifier, exact Platform commit, native
   DLL SHA-256/FileVersion, project ID, and model fingerprint. Confirm local Saved
   Viewpoint count before the test.
2. Position the camera at a distinctive, reproducible view. Create one BIMLog
   Viewpoint through the normal Lens Next UI.
3. Retain the correlated native capture success entry and sanitized camera payload
   evidence showing position, rotation, and projection data.
4. Retain the Platform create response/correlation ID and atomic-create completion
   evidence. Query through the normal authorized Platform read path and retain the
   authoritative BIMLog record ID plus stored visual-state digest. PASS requires
   one committed issue and its bound visual package; duplicates or partial records
   fail.
5. Move the Navisworks camera to an obviously different view, then select **Open
   Working View** for the created BIMLog record.
6. Retain the native apply success entry and compare the restored camera against
   the captured camera using the existing diagnostic values. Any apply error or
   material camera mismatch fails.
7. Confirm the local Navisworks Saved Viewpoint count is unchanged. Any Saved
   Viewpoint created by the normal workflow fails.
8. Record one terminal result: `MANUAL_PROOF=PASS` only if steps 1-7 all pass;
   otherwise `MANUAL_PROOF=FAIL` with the failed step, or `NOT AVAILABLE` when no
   approved controlled environment exists.

## Proof classification

- `AUTOMATED_PROOF`: deterministic core/native adapter tests and TypeScript
  behavior contracts executed by the script.
- `SOURCE_CONTRACT_PROOF`: static/runtime assertions preserving the frozen create,
  apply, writable-viewpoint, and no-Saved-Viewpoint architecture.
- `FIELD_PROVEN_BASELINE`: the separately governed N10-P05 acceptance evidence;
  this document does not recreate or enlarge that evidence.

