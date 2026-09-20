# Build 075 - Dual-year field acceptance status

## Automated evidence completed

- Navisworks 2021 and 2025 source builds and native/core suites pass from their mandatory H-drive roots.
- Both release ZIPs rebuild deterministically and match their SHA-256 sidecars.
- Both packaged installers pass integrity checks.
- Both installers pass first-install and repeated-upgrade simulations with external hash-verified rollback evidence and exactly one loadable Lens Next bundle.
- A checked-in field-readiness gate now verifies package hash, application presence, controlled-model presence, exact installed native version, legacy absence, and duplicate-loader absence for each year.

## Real field result on this workstation

`NOT READY` as of 2026-09-19:

- Navisworks Manage 2021 is installed, but the governed controlled model previously recorded at `C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd` is absent.
- Navisworks Manage 2025 is not installed on this workstation.
- The P35 packages have not been installed into the live Autodesk load root in this block. The currently installed 2021 native binary is `1.5.17.12`, not P35 `1.5.18.35`.
- The existing Original Lens load bundle and fifteen historical 2021 Lens Next rollback directories remain present until a separately authorized live installation runs the verified preserve-first cutover.

Therefore real create/camera/sectioning/Working View/XML/save-reopen acceptance cannot honestly pass here. This is an environment/field-evidence failure, not a source, package, or installer-test failure. No live Autodesk directory was mutated.
