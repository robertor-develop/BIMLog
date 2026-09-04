# Lens Next Build 15 — camera projection XML contract

Date: 2026-09-03

Rollback checkpoint: `6041018a5926761e734d336fb7c9efbe2db6fb01`

## Proven source and target

The authoritative source is the validated BIMLog Visual Package `Camera.Projection`, captured directly from `Autodesk.Navisworks.Api.Viewpoint.Projection` by calling `ToString()`.

Installed Autodesk Navisworks API documentation identifies the source property type as `Autodesk.Navisworks.Api.ViewpointProjection`. Its complete enum values are `Perspective` and `Orthographic`. Frozen native capture stores those values without projection conversion.

The installed Autodesk `nw-exchange-12.0.xsd` defines `camera@projection` as `projectionType`, whose complete allowed tokens are `persp` and `ortho`. A genuine local Navisworks-generated exchange file independently demonstrates `camera projection="persp"`. The installed schema is the authoritative evidence for both target tokens.

Therefore the isolated XML export mapping is exact and deterministic:

- `Perspective` to `camera@projection="persp"`
- `Orthographic` to `camera@projection="ortho"`

No default is used. Missing, empty, whitespace-only, case-altered, padded, or unknown values reject the active export record with `InvalidDataException`. The mapping uses ordinal source comparison and does not mutate stored BIMLog camera data.

The schema requires `position` and `rotation` as children of `camera`; `up` remains a sibling of `camera` under `viewpoint`. Build 15 therefore adds the required camera container while preserving all previously proven component values and serialization policies.

## Scope and acceptance

Focused/core suite: PASS `96/96`.

Build 15 proves:

- both authoritative source values map to their exact schema tokens;
- missing, unknown, whitespace, and casing variants fail closed;
- repeated input produces byte-identical output;
- Build 09 position values remain unchanged;
- Build 12 rotation components, order, sign, and precision remain unchanged;
- Build 13 quaternion validation/comparison remains unchanged;
- Build 14 up-vector values and placement remain unchanged;
- `Camera.SourceLinearUnit` remains unchanged and is not emitted;
- no default projection and no near, far, aspect, height, FOV, focal, sectioning, units, schema URL, or other new XML semantics.

No camera capture, camera restore, Open Working View, bridge, Platform, database/schema, deployment, package, customer environment, or immutable N10-P05 fallback is changed or exercised.

Complete `scripts/test-lens-next-n10-p05-regression.ps1` result:

- focused/core contracts: PASS `96/96`;
- Navisworks 2021 adapter contracts: PASS `54/54`;
- Platform atomic-create contract: PASS;
- create/capture UI contract: PASS;
- Open Working View contracts: PASS;
- `REGRESSION_GATE_RESULT=PASS`.
