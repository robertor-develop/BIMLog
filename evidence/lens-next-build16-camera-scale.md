# Lens Next Build 16 — camera scale XML contract

Date: 2026-09-03

Rollback checkpoint: `0ca11ba7a8357e2f591599233027bb0c2d2610e7`

## Authoritative source fields

Frozen native capture reads these Autodesk `Viewpoint` values directly and stores them in the validated BIMLog Visual Package:

- `FocalDistance`: positive nullable double; distance from camera position along the view direction to the focal plane.
- `HorizontalExtentAtFocalDistance`: positive nullable double; distance between the left/right frustum planes at the focal plane.
- `VerticalExtentAtFocalDistance`: positive nullable double; distance between the top/bottom frustum planes at the focal plane.
- `Projection`: exact `Perspective` or `Orthographic` value already mapped by Build 15.

The installed Autodesk API documentation also defines `Viewpoint.HeightField`: for perspective it is the vertical angular field between the top/bottom frustum planes; for orthographic it is the linear distance between those planes. BIMLog does not store `HeightField`, but it is deterministically recoverable from the stored extents and focal distance.

## Controlled Autodesk proof

The repeatable helper under `evidence/helpers/build16-camera-probe` launches the installed Navisworks Manage 2021 automation host hidden, creates two synthetic viewpoints in a new ephemeral document, calls the Autodesk API with focal distance `10` and extents `8 × 6`, invokes Navisworks' own `XmlViewpointsExportPlugin`, writes evidence, and closes without saving a model.

Autodesk API readback:

- Perspective: focal `10`, horizontal `8`, vertical `6`, `HeightField=0.5829135889557342`, aspect `1.3333333333333333`.
- Orthographic: focal `10`, horizontal `8`, vertical `6`, `HeightField=6`, aspect `1.3333333333333333`.

Navisworks' own XML output for those exact objects emitted:

- Perspective: `viewpoint@focal=10`, `viewpoint@fov=0.5829135890`, `camera@aspect=1.3333333333`, `camera@height=0.5829135890`.
- Orthographic: `viewpoint@focal=10`, `viewpoint@fov=0.5829135890`, `camera@aspect=1.3333333333`, `camera@height=6`.

The raw probe evidence is retained in `evidence/build16-probe-output`. SHA-256:

- `api-values.txt`: `597A773A310FEE2A3B8827A16C814277A3661F9501F92194D20D3A0B8C08BEE7`
- `navisworks-export.xml`: `E8D6EC4CB6F9726220DC68A156E9435A257374F37AD89234C663F6AB60CC2A99`

The installed XSD independently places `focal` and `fov` on `viewpoint`, and `aspect` and `height` on `camera`. It also exposes `linear` and `angular`, but installed API documentation proves those are camera navigation speeds. BIMLog does not store them and Build 16 does not emit them.

## Deterministic mapping

Let `F` be focal distance, `H` horizontal extent at focal distance, and `V` vertical extent at focal distance.

- `viewpoint@focal = F`
- `viewpoint@fov = 2 × atan(V / (2 × F))`
- `camera@aspect = H / V`
- Perspective `camera@height = 2 × atan(V / (2 × F))`
- Orthographic `camera@height = V`

The implementation uses a scale-safe `atan2` form equivalent to the proven equation and invariant round-trip formatting. No rounding, normalization, source mutation, unit conversion, or default is applied.

Focal distance and both extents are required by this isolated export gate. Missing, zero, negative, NaN, infinite, or geometrically non-representable results reject the active export record clearly. This does not change normal BIMLog capture or restore behavior.

`Camera.SourceLinearUnit` remains unchanged and is not serialized. No XML unit token is added because Build 10A explicitly established that its stored Autodesk enum name is not itself a proven XML token.

No near/far clipping, `linear`, `angular`, sectioning, lighting, render/tool state, schema URL, units, or other semantics are added by the isolated exporter.

## Acceptance

- Focused/core contracts: PASS `101/101`.
- Navisworks 2021 adapter contracts: PASS `54/54`.
- Platform atomic-create contract: PASS.
- Create/capture UI contract: PASS.
- Open Working View contracts: PASS.
- Complete `scripts/test-lens-next-n10-p05-regression.ps1`: `REGRESSION_GATE_RESULT=PASS`.

Position, rotation, up vector, projection, ordering, names, GUIDs, metadata, capture, restore, bridge, Platform, database/schema, Saved Viewpoint behavior, deployment, packages, and immutable N10-P05 fallback remain unchanged.
