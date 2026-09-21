# Build 192 — dual-year installation inventory

The 2021 physical installation, 2021 package, and 2025 package were reconciled.

- The accepted ApplicationPlugins topology is Pulse-only `BIMLog.bundle` plus the matching-year Lens Next bundle.
- The physical 2021 installation also contains an older direct-load DLL under `Program Files\...\Plugins\BIMLogNavisPlugin`.
- Reflection proves that older DLL still contains `BIMLogNavisPlugin.BIMLogLensPanel`; it is therefore retired Original Lens code, not accepted Pulse-only topology.
- Navisworks 2025 is not installed on this workstation; its package and simulated topology remain the available evidence.
