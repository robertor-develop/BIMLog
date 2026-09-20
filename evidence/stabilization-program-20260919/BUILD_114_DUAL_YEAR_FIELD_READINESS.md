# Build 114 — Dual-year Lens Next acceptance and field readiness

Status: `PASS_AUTOMATED_FIELD_ENVIRONMENT_PENDING`

## Passed now

- Core Lens Next contract suite: `132/132 PASS`.
- Navisworks 2021 Native adapter suite: `57/57 PASS`.
- Navisworks 2025 Native adapter suite: `57/57 PASS`.
- Shared release identity: `v1.05.N18-P36` / `1.5.18.36 PASS`.
- Navisworks 2021 package SHA-256: `CD0C8A2C63711E4C89EA82B53FA781ED558ED398C724458780E3422895AE6E84`.
- Navisworks 2025 package SHA-256: `30F78C364603138587E1F6C809B564D3C0A8B58F8DBF91D6E6698BD05BFB3608`.
- Package-only first-install and repeated-upgrade simulation passed for both years. Each simulation removed Original Lens from the isolated load root, left exactly one Lens Next bundle, and preserved two independent rollback receipts.

## Current workstation truth

The live Autodesk field-readiness scan remains `NOT READY` without modifying Autodesk installation state:

- Navisworks 2021 exists, but its controlled NWD is absent, installed Lens Next is historical `1.5.17.12`, Original Lens remains loadable, and historical rollback directories remain under the live Autodesk root.
- Navisworks 2025 is not installed and no controlled 2025 model is available on this workstation.

These are explicit external field-environment prerequisites, not an unresolved source/package/installer P0 or P1. No live Autodesk directory was changed. Final connected/customer field proof remains a mandatory Build 119 gate; the Block 23 candidate is not publishable as a final release until that gate passes.

Package-only proof roots:

- `H:\BIMLogPlugin2021\installer-upgrade-proof\20260920-081200-3046297`
- `H:\BIMLogPlugin2025\installer-upgrade-proof\20260920-081213-4429606`

