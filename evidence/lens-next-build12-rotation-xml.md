# Lens Next Build 12 — BIMLog rotation XML serialization

Date: 2026-09-03

Rollback checkpoint: `ce91b0a7c1cee187bbd8c6cbcc7a23a462ce5548`

## Implemented boundary

The isolated BIMLog XML writer now reads rotation only from the already selected and validated active BIMLog Visual Package camera. Membership, lifecycle, authoritative project identity, package identity, revision identity, and digest equality are validated before an export view is constructed.

The serialized structure is limited to:

```xml
<viewpoint>
  <position>
    <pos3f x="..." y="..." z="..." />
  </position>
  <rotation>
    <quaternion a="..." b="..." c="..." d="..." />
  </rotation>
</viewpoint>
```

The Build 11 contract is applied without reinterpretation:

- `Camera.Rotation.A` to `quaternion@a`
- `Camera.Rotation.B` to `quaternion@b`
- `Camera.Rotation.C` to `quaternion@c`
- `Camera.Rotation.D` to `quaternion@d`
- stored sign preserved
- no normalization, component reorder, axis change, handedness change, or default substitution
- invariant-culture round-trip numeric formatting, matching position policy

Missing rotation, any non-finite component, or a zero-length quaternion rejects the active export package with `InvalidDataException`. No identity quaternion is invented.

The writer does not read Navisworks Saved Viewpoints, the current Navisworks camera, local state, or UI display state.

## Focused acceptance

The shared focused suite passes `82/82`. Its five Build 12 cases prove:

1. exact identity, single-axis, and compound quaternion serialization;
2. exact preservation of negative components and both stored signs of spatially equivalent `q` and `-q`;
3. name changes and input ordering do not alter quaternion values;
4. missing, NaN, positive/negative infinity, and zero-length rotations reject clearly;
5. position remains present and unchanged while up, projection, focal/FOV, sectioning, units, schema URL, and other unproven semantics remain absent.

The four Build 11 orientation proof cases remain unchanged and pass within the same suite.

## Complete regression

Command:

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-lens-next-n10-p05-regression.ps1`

Results:

- core/focused contracts: PASS `82/82`
- Navisworks 2021 adapter suite: PASS `54/54`
- Platform atomic-create source contract: PASS
- create/capture UI source contract: PASS
- Open Working View source contracts: PASS
- terminal result: `REGRESSION_GATE_RESULT=PASS`

No Platform, database, schema, capture, restore, bridge, Saved Viewpoint, deployment, package, or fallback artifact was changed or exercised.
