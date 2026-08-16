# Lens Next install-target feasibility audit

Status: `READ_ONLY_FEASIBILITY_COMPLETE_NO_TARGET_SELECTED`

Candidate: `cad5866e066cfe03d46bf8ed4a9639574147ad72` on
`codex/bimlog-lens-next-20260812`, clean at audit start.

This audit performed no installation, package copy, registry/configuration/environment change,
Navisworks launch, target selection, Legacy access, or production/customer access.

## Authoritative Autodesk findings

- Autodesk's current Navisworks publisher guideline says Manage and Simulate packages live in a
  unique `.bundle` below `%APPDATA%\Autodesk\ApplicationPlugins`, with `PackageContents.xml` at the
  bundle root and binaries under `Contents`. It identifies `Nw22` as Navisworks 2025 and requires
  a separately compiled binary per major release. Source: [Navisworks publisher guidelines](https://aps.autodesk.com/marketplace/publisher-center/navisworks-publisher-guidelines).
- Autodesk Support identifies the normal Navisworks discovery locations as the product-install
  `Plugins` directory plus `%APPDATA%\Autodesk\ApplicationPlugins` and
  `%PROGRAMDATA%\Autodesk\ApplicationPlugins`. Source: [How to disable add-ins and Plugins in Navisworks](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-Disable-Plugins-in-Navisworks.html).
- Autodesk's versioned Navisworks command-line documentation says normal plug-ins are auto-loaded
  from the installation directory's `Plugins` folder, and `-AddPluginAssembly [filename]` can load
  plug-ins from .NET assemblies in other locations. This is a launch-time assembly-load mechanism,
  not registration of an arbitrary package-search root. Sources: [Navisworks 2021 command-line switches](https://help.autodesk.com/cloudhelp/2021/ENU/Navisworks-Quick-Start/files/GUID-3891FB9F-7BF1-4510-A1EE-121E975C0ACE.htm) and [Navisworks 2025 command-line switches](https://help.autodesk.com/cloudhelp/2025/ENU/Navisworks-Quick-Start/files/GUID-3891FB9F-7BF1-4510-A1EE-121E975C0ACE.htm).
- Navisworks `Site` and `Project` directories are documented for shared configuration settings;
  Autodesk does not describe them as managed-plugin discovery roots. Source: [Navisworks 2021
  Search Directories](https://help.autodesk.com/cloudhelp/2021/ENU/Navisworks-Freedom/files/GUID-2E721ECE-3CBE-4A07-8A6C-822A4D12E433.htm).

No official Navisworks source reviewed documents `ADSK_APPLICATION_PLUGINS`, an Options Editor
field, registry value, environment variable, junction, or symlink as a supported way to add an
arbitrary F/H bundle auto-discovery root. Autodesk documents `ADSK_APPLICATION_PLUGINS` for 3ds Max,
not Navisworks; applying it to Navisworks would be an unsupported inference and is prohibited.

## Local facts and package contract

- Exact readback found `C:\Program Files\Autodesk\Navisworks Manage 2021\roamer.exe`, file version
  `18.0.1347.51`. The default 2025 executable path was absent. Exact Navisworks registry readback
  exposed only `HKLM\SOFTWARE\Autodesk\Navisworks Manage\23.0`, without an install path; this does
  not prove a 2025 installation or authorize searching other drives.
- 2021 ZIP SHA-256 remains
  `FAD1EAC5A5B5EB7AEF3C2C9A2E1ABCE323549036791A8A982BFCEA5689DAA593`; its manifest routes only
  `Nw18` to `Contents/BIMLogLensNext.Native2021.dll`.
- 2025 ZIP SHA-256 remains
  `C916D997EAEC84E0D39600ADB4146650AA8EF5B1645C5E02764E63EADA40C8DC`; its manifest routes only
  `Nw22` to `Contents/BIMLogLensNext.Native2025.dll`.
- Each held ZIP is storage/distribution only until extracted into a supported `.bundle` discovery
  root or its matching native assembly is explicitly supplied to `-AddPluginAssembly`. The
  install/uninstall contracts remain `contract_only`, choose no exact target, and forbid Legacy
  targets. Package storage on F does not make F an auto-load location.

## Decision matrix

| Year | F/H package storage | F/H automatic bundle discovery | F/H runtime assembly load | Supported persistent bundle target | Local runtime fact |
| --- | --- | --- | --- | --- | --- |
| 2021 (`Nw18`) | Yes; inert ZIP/storage | Not documented; prohibited | Yes, only through explicit `-AddPluginAssembly` launch using the matching native DLL | C-root profile/shared `ApplicationPlugins` or product-install `Plugins` | Default C install verified, `roamer.exe` 18.0.1347.51 |
| 2025 (`Nw22`) | Yes; inert ZIP/storage | Not documented; prohibited | Yes, only through explicit `-AddPluginAssembly` launch using the matching native DLL | C-root profile/shared `ApplicationPlugins` or product-install `Plugins` | Default C install not found; installed 2025 runtime not established |

## Smallest necessary C-root boundary and rollback

If persistent automatic bundle discovery is required, the smallest documented scope is a single
per-user, uniquely named Lens Next `.bundle` directory under
`%APPDATA%\Autodesk\ApplicationPlugins`; it avoids machine-wide ProgramData/Program Files scope.
The exact leaf is deliberately not selected here. Ownership is limited to that one Lens Next
bundle and its six held-package files. Rollback removes/restores only those hash-verified owned
files and the exact empty Lens Next bundle leaf; it must not enumerate, rename, copy, or remove
sibling bundles or Legacy state.

This C-root write is outside the present Lens Next authority. Roberto must explicitly authorize
the exact constitutional exception/amendment text, literal target, year, package hash, inventory,
launch action, and rollback before any persistent installation. Ordinary source/package acceptance
does not supply that authority.

## Recommended next gate

Request one separately bounded Roberto authorization for a **2021-only, no-copy runtime-load field
gate**: invoke the verified installed 2021 executable with `-AddPluginAssembly` pointing directly to
the frozen F-hosted `BIMLogLensNext.Native2021.dll`, using an approved synthetic document and the
existing read-only checklist. This tests Autodesk's documented non-C runtime path without creating
a C-root bundle or modifying discovery configuration. Stop afterward and independently verify no
state/configuration changes. A 2025 gate must remain separate until its exact installed executable,
version, and matching load behavior are verified read-only; evidence from 2021 cannot accept 2025.
