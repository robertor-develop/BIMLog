# Lens Next Build 17 — real Navisworks perspective validation

Date: 2026-09-03

Rollback checkpoint: `a9f0991c7712f95b27678fe973e0ac507cc6095d`

Result: **FAIL — Build 16 perspective XML field-presence contract disproven**

## Controlled method

The controlled helper in `evidence/helpers/build17-perspective-probe` launches the locally installed Navisworks Manage 2021 automation host hidden, creates three synthetic perspective `Autodesk.Navisworks.Api.Viewpoint` objects, reads their API values, invokes Navisworks' genuine `XmlViewpointsExportPlugin`, writes the XML evidence, and closes without saving a model.

The comparison applies the frozen Build 16 equations directly to the API values:

- `focal = F`
- `fov = 2 × atan(V / (2 × F))`
- `aspect = H / V`
- perspective `height = fov`

## Tolerance

Absolute tolerance: `5.01E-11`.

Navisworks emits these XML values with ten fractional decimal places, creating at most `5E-11` absolute decimal rounding error. The additional `1E-13` allowance covers substantially more than the expected binary64 evaluation/parsing error at the tested magnitudes without masking a changed tenth decimal digit.

## Results

| Case | API F | API H | API V | XML focal | XML fov | XML aspect | XML height | BIMLog focal | BIMLog fov | BIMLog aspect | BIMLog height | Δ focal | Δ fov | Δ aspect | Δ height |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Wide | 10 | 29.999999999999993 | 19.999999999999996 | 10 | 1.5707963268 | 1.5 | 1.5707963268 | 10 | 1.5707963267948966 | 1.5 | 1.5707963267948966 | 0 | 5.1037E-12 | 0 | 5.1037E-12 |
| Medium | 10 | 8 | 6 | 10 | 0.5829135890 | 1.3333333333 | 0.5829135890 | 10 | 0.5829135889557342 | 1.3333333333333333 | 0.5829135889557342 | 0 | 4.42658E-11 | 3.33333E-11 | 4.42658E-11 |
| Narrow | 100 | 10 | 5 | 100 | **MISSING** | 2 | 0.0499895872 | 100 | 0.049989587237840319 | 2 | 0.049989587237840319 | 0 | NOT COMPARABLE | 0 | 3.78403E-11 |

Wide and medium match within tolerance. In the narrow case, Navisworks emits the calculated angular value in `camera@height` but omits `viewpoint@fov` entirely. Build 16 currently emits `viewpoint@fov` unconditionally, so the exact real-output contract is disproven for `viewpoint@fov` presence. The numerical formula itself is not disproven where Navisworks emits the field.

Per the Build 17 task lock, no product correction was attempted. Build 16 product code, orthographic behavior, capture, restore, Platform, database/schema, and immutable N10-P05 remain untouched. Focused and full regressions were not rerun after conclusive disproof because the authorization required an immediate stop rather than a repair.

## Bound evidence

- `api-values.csv` SHA-256: `0B9B5969B77BD3BF43E0EC14A4421C0B3744ED74B42926B6D4763882770FE011`
- `navisworks-export.xml` SHA-256: `23EF368ADD9407E96976C4655BE6268F1C0BDE4BDD43FCE44D3DA89BEB3173B0`
- `comparison-results.csv` SHA-256: `AE965C5A0778525A74101A8ACDA65BE4DD2AFAC69DFFCE323FA1864EC5F757A4`
