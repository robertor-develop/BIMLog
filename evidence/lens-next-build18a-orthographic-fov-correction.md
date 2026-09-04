# Lens Next Build 18A — orthographic FOV presence correction

Date: 2026-09-04

Development rollback point: `89e4d1bbd598bc600b5322d3d81a5673bc7e2f87`

Result: **PASS — isolated orthographic attribute-presence defect corrected**

## Correction

The existing Build 16 field-angle calculation remains unchanged. The isolated XML scale model now emits `viewpoint@fov` for either projection only when that calculated angle is greater than or equal to `Math.PI / 18` radians. Below that threshold it omits the attribute. The XML writer itself, focal formula, aspect formula, perspective/orthographic height formulas, and every other camera mapping are unchanged.

## Build 18 comparison

The focused regression uses the exact six Build 18 API cases and compares exporter output with the captured genuine Navisworks presence and numeric results:

| Case | Expected `fov` | Result |
|---|---|---|
| Large: F/H/V = 10/300/200 | present | PASS |
| Medium: F/H/V = 10/80/60 | present | PASS |
| Small: F/H/V = 100/10/5 | omitted | PASS |
| 10 degrees minus 0.000001 rad | omitted | PASS |
| Exactly 10 degrees | present | PASS |
| 10 degrees plus 0.000001 rad | present | PASS |

For emitted values, the unchanged calculated FOV is compared directly. Focal, aspect, and orthographic height are also asserted for every case. The captured authoritative evidence remains:

- `evidence/build18-orthographic-output/api-values.csv` SHA-256 `28BC157454FCA1A4B22918538770EFF6EADE143E14ED7A2EADD211A94607CCCD`
- `evidence/build18-orthographic-output/navisworks-export.xml` SHA-256 `C66C074F8C4C617DBC0AB12E0B277DA561B829FFF8B1D5F3C857218F826717C1`
- `evidence/build18-orthographic-output/comparison-results.csv` SHA-256 `5E35E2D09712432C7DC360DA2FD5125E11FBC7F0680C7475D28065C8080665A1`

## Verification

- Focused Lens Next suite: PASS 103/103.
- Build 17A perspective threshold test: PASS.
- Navisworks 2021 adapter suite: PASS 54/54.
- Platform atomic-create, create/capture UI, and Open Working View contracts: PASS.
- Complete N10-P05 regression gate: PASS.

No capture, restore, normal workflow, Platform, database/schema, deployment, package, or immutable fallback change occurred.
