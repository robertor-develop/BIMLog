# Lens Next Build 14 — camera up-vector XML contract

Date: 2026-09-03

Rollback checkpoint: `dcab7d00af63a8b8c2bdb00b2082904f56526859`

## Proven source and target

The authoritative source is the validated BIMLog Visual Package `Camera.WorldUpVector`, captured from `Autodesk.Navisworks.Api.Viewpoint.WorldUpVector`.

Installed Autodesk API documentation defines `WorldUpVector` as the preferred up vector used by walk-paradigm navigation and exposes it as immutable `Autodesk.Navisworks.Api.UnitVector3D`, a unit-length direction. Frozen native capture calls `Point(view.WorldUpVector)` and copies `X`, `Y`, and `Z` directly into BIMLog without conversion.

The installed Autodesk `nw-exchange-12.0.xsd` defines optional viewpoint element `up` as `vector3fType`, containing `vec3f` with float attributes `x`, `y`, and `z`. A genuine local Navisworks-generated exchange file uses `<up><vec3f x="..." y="..." z="..."/></up>` with the same component names/order.

Therefore the export mapping is raw:

- `WorldUpVector.X` to `up/vec3f@x`
- `WorldUpVector.Y` to `up/vec3f@y`
- `WorldUpVector.Z` to `up/vec3f@z`

No axis conversion, negation, swizzle, normalization, localization, or stored-data mutation is applied. Values use invariant-culture round-trip (`R`) formatting, consistent with position and quaternion serialization.

## Missing and invalid policy

The Autodesk schema declares `up` with `minOccurs="0"`. A missing BIMLog `WorldUpVector` is therefore explicitly valid for XML structure and omits the entire `up` element. No default vector is invented.

When a vector is present, all three components must be finite and the vector must be non-zero. Zero, NaN, positive infinity, or negative infinity rejects the active export record with `InvalidDataException`. A finite non-unit vector remains unchanged because the target vector type imposes no normalization facet and mutation is outside Build 14 authority.

## Acceptance

Focused/core suite: PASS `92/92`.

The Build 14 cases prove:

- positive, negative, fractional, normalized, and finite non-unit raw serialization;
- deterministic invariant numeric round-trip;
- explicit omission for missing input;
- zero and non-finite rejection;
- unchanged Build 09 position values;
- unchanged Build 12 quaternion values/sign/order;
- unchanged Build 13 quaternion comparison behavior;
- unchanged `Camera.SourceLinearUnit` input;
- unchanged ordering, naming, GUID, and exchange metadata tests;
- no projection, focal/FOV, sectioning, units, schema URL, or unrelated camera semantics.

Complete `scripts/test-lens-next-n10-p05-regression.ps1` result:

- focused/core contracts: PASS `92/92`;
- Navisworks 2021 adapter contracts: PASS `54/54`;
- Platform atomic-create contract: PASS;
- create/capture UI contract: PASS;
- Open Working View contracts: PASS;
- `REGRESSION_GATE_RESULT=PASS`.

No capture, restore, Open Working View, bridge, Platform, database/schema, deployment, package, customer environment, or immutable N10-P05 fallback was changed or exercised.
