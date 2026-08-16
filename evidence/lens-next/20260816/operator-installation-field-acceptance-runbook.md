# BIMLog Lens Next installation and live field-acceptance runbook

Status: `LOCAL_LOADABLE_PACKAGE_READY_EXTERNAL_INSTALL_AUTHORITY_PENDING`

Prepared from clean candidate `bb016eb59baffa12b6b4d9c830ee8f4aaad94325` on branch
`codex/bimlog-lens-next-20260812` in
`F:\BIMLog\Worktrees\bimlog-lens-next-20260812`.

This runbook prepares the next operator gate. It does not authorize or perform installation,
Navisworks launch or document mutation, production access, customer/provider contact, push,
publish, or deployment.

## Current package disposition

The earlier sandbox artifacts remain source/build review packages. The new year-specific loadable
package artifacts are:

| Navisworks | Held artifact | SHA-256 |
| --- | --- | --- |
| 2021 | `artifacts\lens-next-readonly-packages\BIMLogLensNext-Navisworks2021-readonly-loadable.zip` | `FAD1EAC5A5B5EB7AEF3C2C9A2E1ABCE323549036791A8A982BFCEA5689DAA593` |
| 2025 | `artifacts\lens-next-readonly-packages\BIMLogLensNext-Navisworks2025-readonly-loadable.zip` | `C916D997EAEC84E0D39600ADB4146650AA8EF5B1645C5E02764E63EADA40C8DC` |

Each ZIP contains `PackageContents.xml`, `BIMLogLensNext.dll`, its matching
`BIMLogLensNext.Native{year}.dll`, PDBs, and a hash manifest. The matching native assembly contains
the distinct registered `DockPanePlugin` and `AddInPlugin` entry points. Install/uninstall contracts
include the exact year-native payloads, while intentionally choosing no installation target.

## Side-by-side identity boundary

| Surface | Lens Next | Protected Legacy Lens |
| --- | --- | --- |
| Assembly / DLL | `BIMLogLensNext` / `BIMLogLensNext.dll` plus matching `BIMLogLensNext.Native2021.dll` or `BIMLogLensNext.Native2025.dll` | `BIMLogNavisPlugin` / `BIMLogNavisPlugin.dll` |
| Dock / panel | `BIMLogLensNext.IgniteSmart` | `BIMLogLens.IgniteSmart` |
| Button | `BIMLogLensNextButton.IgniteSmart` | `BIMLogLensButton.IgniteSmart` |
| Install leaf | `BIMLogLensNext` | `BIMLogNavisPlugin` |
| State | `%LOCALAPPDATA%\BIMLog\LensNext` | `%APPDATA%\BIMLog` |
| Bridge | `http://127.0.0.1:8766` | `http://localhost:8765` |
| Metadata | `bimlog.lens_next.v1` / `BIMLogLensNext` | Legacy `BIMLogLens` metadata |
| Published marker | `bimlog.lens_next.published.v1` | Legacy markers/folders |

All eight `lens_next.*` write feature flags remain exactly `false`. Phase 1 may resolve one exact,
nonzero SavedViewpoint GUID and set only `CurrentSavedViewpoint`; it may not enumerate, create,
copy, edit, move, replace, remove, publish, migrate, or recover SavedViewpoints.

## Read-only operator preflight

Run only after an independently accepted installable artifact exists, while both Navisworks
versions are closed. Save the complete console transcript into the evidence root described below.

1. Verify candidate identity with `git -C F:\BIMLog\Worktrees\bimlog-lens-next-20260812
   rev-parse HEAD`, `git ... branch --show-current`, and `git ... status --short`; require the
   accepted commit/branch and no output from short status.
2. Compute `Get-FileHash -Algorithm SHA256` for the accepted year ZIP and compare it with the
   separately accepted receipt. Stop on any mismatch.
3. List every ZIP entry without extraction. Require only the accepted Lens Next DLL/PDB/manifest
   inventory, the matching product year, and no Autodesk, Legacy, installer executable, script,
   configuration, cache, log, or customer-data payload.
4. Verify the signed/frozen manifest names the exact assembly, dock, panel, button, command,
   state, bridge, metadata, feature-flag, and installation identities above.
5. Verify no `Navisworks`, `Roamer`, or related Autodesk process is running. Do not terminate one
   automatically; stop for the operator if any is active.
6. Inventory the exact proposed Lens Next target and the protected Legacy targets with file names,
   byte counts, timestamps, and SHA-256 hashes. Stop if the target overlaps any Legacy path.
7. Copy the complete pre-existing Lens Next target, if any, to a new timestamped F-root rollback
   directory. Hash both copies before any replacement. Do not back up, copy, rename, or remove
   Legacy files.
8. Confirm the approved synthetic/test NWF/NWD path, its read-only safety copy, expected BIMLog
   project ID, exact SHA-256 model fingerprint, and exact nonzero SavedViewpoint GUID. No
   production/customer document is permitted by this gate.

## Installation boundary and rollback

No installation command is released by this candidate. An accepted installer must be a bounded,
path-literal operation that creates or replaces only the exact Lens Next year target and only the
manifest-listed files. It must never use a recursive wildcard against an Autodesk plugin root,
never touch the Legacy folder/bundle, and never write `%APPDATA%\BIMLog`.

Rollback must be tested before live acceptance:

1. Close Navisworks normally and verify the process has exited.
2. Hash and preserve the failed Lens Next target in the F-root evidence directory.
3. Restore only the timestamped pre-install Lens Next backup to the same exact Lens Next target;
   if no Lens Next target existed before installation, remove only the newly created, exact Lens
   Next files after their evidence copy is verified.
4. Re-hash the restored target and compare it with the preflight inventory.
5. Re-hash the protected Legacy target and require byte-for-byte identity with the preflight
   inventory. Any mismatch is a failed rollback and stops further testing.

## Navisworks 2021 and 2025 smoke / field checklist

Run the same checklist separately with the exact matching year assembly and a separately approved
synthetic/test document. Evidence from one year does not accept the other.

- Navisworks starts normally; Legacy Lens remains present, independently named, and usable.
- Lens Next appears exactly once under its frozen dock/button identities; no duplicate or Legacy
  command/panel is hidden, replaced, or renamed.
- Lens Next reports read-only capability only; Phase 2 commands and all eight write flags remain
  unavailable/false.
- The bridge binds only `127.0.0.1:8766`; Legacy continues on port `8765`; no token, credential, or
  customer content appears in a URL or log.
- Project context requires the approved positive project ID and exact model fingerprint.
- Exact known SavedViewpoint GUID opens the same existing viewpoint. Repeat twice and verify the
  SavedViewpoint tree count, names, GUIDs, comments, folders, and metadata remain unchanged.
- A missing GUID, zero GUID, non-viewpoint GUID, wrong project, wrong fingerprint, changed/renamed
  document, and background-thread request each fail explicitly without navigation or mutation.
- Labels, display names, folder paths, tree position, current view, and first/best-match behavior
  never resolve an issue.
- Close/reopen the test document and repeat exact navigation; verify no new SavedViewpoint,
  metadata, configuration, cache, log, migration, or publication state was created outside the
  frozen Lens Next roots.
- Run the protected Legacy smoke path after Lens Next testing and compare the Legacy file/state and
  SavedViewpoint inventories with preflight. Zero difference is required.
- Exercise rollback, reopen the same test document, and confirm Legacy still works and Lens Next is
  absent or restored to its exact pre-install version.

## Evidence capture plan

Use a new F-root directory such as
`F:\BIMLog\Evidence\lens-next-live-acceptance\<UTC-timestamp>\{2021|2025}`. Capture:

- authorization text and exact approved scope, with secrets excluded;
- candidate commit, branch, clean status, package and internal manifest hashes;
- Navisworks product year/version, OS identity sufficient for reproducibility, and exact loaded
  Lens Next assembly names/versions/hashes;
- before/install/after/rollback target inventories and protected Legacy inventories;
- approved test-document hash, project ID, model fingerprint, and test GUIDs (no customer data);
- timestamped screenshots or screen recording for panel identity, exact open, each refusal state,
  repeated open, side-by-side Legacy behavior, and rollback;
- before/after SavedViewpoint tree export or deterministic inventory proving unchanged counts,
  GUIDs, names, comments, folders, and metadata;
- sanitized Lens Next logs plus explicit confirmation that Legacy config/cache/log files were not
  read or written;
- one year-specific result JSON with every checklist item `PASS`, `FAIL`, or `NOT_RUN`, followed by
  a combined 2021/2025 summary and all evidence hashes.

Any failed, ambiguous, or missing item keeps the candidate unaccepted. Build success, source tests,
or one product year cannot substitute for both installed runtimes.

## Precise Roberto-only authorization boundary

Before any installation or live Navisworks action, Roberto must separately authorize all of the
following in one exact scope: the accepted commit and both package hashes; the exact literal 2021
and 2025 Lens Next installation targets; the exact file inventory; the approved synthetic/test
documents and project identities; Navisworks launch; exact-GUID navigation; evidence capture; and
the rollback operation. That authorization must explicitly exclude Legacy mutation, production or
customer data, Phase 2/write flags, push, publish, and deployment.

The frozen Lens Next install leaf is a new C-root product path, while the current Constitution's
C-root plugin-install exception names only the existing Legacy Autodesk paths. Therefore ordinary
installation approval is insufficient for a C-root Lens Next target. Before such a target may be
written, Roberto must explicitly authorize the necessary constitutional amendment using the
Constitution's required amendment phrase and exact approved text, or name a constitutionally valid
non-C-root test target that Navisworks can load without C-root mutation. No operator should infer
this authority from acceptance of the source or this runbook.

## Current blocker

Installation and live acceptance remain externally gated on independent candidate acceptance,
an exact authorized installation target, and a valid C-root authority path where applicable. The
loadable packages do not grant installation or Navisworks execution authority.
