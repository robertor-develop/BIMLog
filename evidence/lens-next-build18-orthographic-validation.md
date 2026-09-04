# Lens Next Build 18 — genuine orthographic XML validation

Date: 2026-09-04

Development rollback point: `c88e54f7977121764e105c31f17e976cc24eb138`

Result: **FAIL — current orthographic `viewpoint@fov` presence contract disproven**

## Controlled method

The non-production helper in `evidence/helpers/build18-orthographic-probe` launched the locally installed Navisworks Manage 2021 automation host hidden. It created six controlled orthographic `Autodesk.Navisworks.Api.Viewpoint` states, captured their API values, and invoked the genuine `XmlViewpointsExportPlugin`. `Compare-CurrentMapping.ps1` then applied the current BIMLog Build 16 equations directly and compared them with the genuine XML.

Numerical tolerance is `5.01E-11` absolute. Navisworks writes ten fractional decimal places, so decimal serialization contributes at most `5E-11`; the additional `1E-13` covers binary64 calculation/parsing error without accepting a changed tenth decimal digit.

## Result

Focal, calculated FOV (when present), aspect, and orthographic height match the current formulas within tolerance. Attribute presence does not match: genuine Navisworks omits orthographic `viewpoint@fov` below 10 degrees (`Math.PI / 18` radians), emits it at exactly 10 degrees, and emits it above 10 degrees. The current BIMLog exporter emits orthographic `fov` unconditionally.

| Case | API F/H/V | Genuine focal | Genuine fov presence/value | Genuine aspect | Genuine height | Maximum numeric delta |
|---|---|---:|---|---:|---:|---:|
| Large | 10 / 300 / 200 | 10 | present / 2.9422553486 | 1.5 | 200 | 7.47E-12 |
| Medium | 10 / 80 / 60 | 10 | present / 2.4980915448 | 1.3333333333 | 60 | 3.34E-11 |
| Small | 100 / 10 / 5 | 100 | omitted | 2 | 5 | 0 for comparable fields |
| 10 degrees minus 0.000001 rad | 100 / 26.246447909643877 / 17.497631939762584 | 100 | omitted | 1.5 | 17.4976319398 | 3.74E-11 |
| Exactly 10 degrees | 100 / 26.246599057777203 / 17.497732705184802 | 100 | present / 0.1745329252 | 1.5 | 17.4977327052 | 1.52E-11 |
| 10 degrees plus 0.000001 rad | 100 / 26.246750205923753 / 17.497833470615834 | 100 | present / 0.1745339252 | 1.5 | 17.4978334706 | 1.58E-11 |

Per Build 18 authorization, no product correction was made. Perspective behavior, including the Build 17A threshold, is untouched.

## Regression evidence

- Build 17A focused suite: PASS 102/102.
- Navisworks 2021 adapter suite: PASS 54/54.
- Complete N10-P05 regression gate: PASS.

Bound evidence:

- `build18-orthographic-output/api-values.csv`: SHA-256 `28BC157454FCA1A4B22918538770EFF6EADE143E14ED7A2EADD211A94607CCCD`
- `build18-orthographic-output/navisworks-export.xml`: SHA-256 `C66C074F8C4C617DBC0AB12E0B277DA561B829FFF8B1D5F3C857218F826717C1`
- `build18-orthographic-output/comparison-results.csv`: SHA-256 `5E35E2D09712432C7DC360DA2FD5125E11FBC7F0680C7475D28065C8080665A1`

No production source, Platform, database/schema, deployment, package, or immutable fallback mutation occurred.
