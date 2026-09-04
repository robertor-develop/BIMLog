# Lens Next Build 17A — perspective FOV attribute presence

Date: 2026-09-04

Development rollback point: `c35f86a5de783177ef11a233d7a49e7f90497371`

Result: **PASS — genuine Navisworks presence rule reproduced and isolated exporter corrected**

## Authoritative controlled method

The controlled helper in `evidence/helpers/build17-perspective-probe` launched the locally installed Navisworks Manage 2021 automation host hidden. It created perspective `Autodesk.Navisworks.Api.Viewpoint` instances from explicit focal distances and vertical extents, recorded the resulting API camera values, and invoked Navisworks' genuine `XmlViewpointsExportPlugin`.

The exporter emitted `viewpoint@fov` exactly when the API `HeightField` was greater than or equal to 10 degrees (`Math.PI / 18` radians). It omitted the attribute below that boundary while continuing to emit the identical angular value as `camera@height`.

## Boundary evidence

| Controlled case | API HeightField (rad) | Genuine XML `viewpoint@fov` | Genuine XML `camera@height` |
|---|---:|---|---:|
| Narrow original | 0.049989587237840319 | omitted | 0.0499895872 |
| 0.150 rad | 0.15 | omitted | 0.1500000000 |
| 10 degrees minus 0.000001 rad | 0.17453192519943295 | omitted | 0.1745319252 |
| exactly 10 degrees | 0.17453292519943295 | 0.1745329252 | 0.1745329252 |
| 10 degrees plus 0.000001 rad | 0.17453392519943295 | 0.1745339252 | 0.1745339252 |
| 0.200 rad | 0.2 | 0.2000000000 | 0.2000000000 |
| Medium original | 0.5829135889557342 | 0.5829135890 | 0.5829135890 |
| Wide original | 1.5707963267948966 | 1.5707963268 | 1.5707963268 |

The 0.05-radian case was also repeated at focal distances 9.999, 10, and 10.001 and omitted `fov` in every case. The medium angle was repeated at focal distances 20 and 100 and emitted `fov` in both cases. This excludes focal distance as the controlling condition in the tested range.

## Correction and frozen semantics

Only perspective `viewpoint@fov` presence is conditional: omit below `Math.PI / 18`; emit at and above it. The existing calculated field-of-view value is retained for `camera@height`. Focal, aspect, height, position, rotation, up vector, projection, and orthographic output are unchanged. No default is introduced.

## Verification

- Focused Lens Next suite: PASS 102/102.
- Navisworks 2021 adapter suite: PASS 54/54.
- Platform atomic-create source contract: PASS.
- Create/capture UI source contract: PASS.
- Open Working View source contract: PASS.
- Complete N10-P05 regression gate: PASS.

Bound evidence:

- `build17a-fov-boundary-output/api-values.csv` SHA-256: `F6110FF8337FB44B5841EB71F1540D3882BA48C719D46AFB9E70A5C643D58DFB`
- `build17a-fov-boundary-output/navisworks-export.xml` SHA-256: `DD1565FEA08CCEF6D4B6462449D2ED32E8D58CBDA9B60CEB74FBD9D8F6F7FFDB`

No deployment, package, Platform mutation, database/schema mutation, capture/restore change, or N10-P05 fallback change occurred.
