# Lens Next Build 20 — proven sectioning subset XML

Date: 2026-09-04

Development rollback point: `d9d68f29c1b41694f2170cbe384126b3ef95c2d7`

Result: **PASS — only the Build 19-proven clipping-plane subset is serialized**

## Implementation

`LensNextXmlExportInput.PackageSectioningJson` carries the authoritative stored sectioning string into the isolated exporter. `LensNextXmlSectioning.FromOptionalJson` consumes it without rewriting it and builds a validated export-only representation.

The parser requires exactly the Build 19 contract:

- set: `Type="ClipPlaneSet"`, `Version=1`, `Planes` array, boolean `Linked`, boolean `Enabled`;
- each plane: `Type="ClipPlane"`, `Version=1`, exactly three finite numeric `Normal` components, finite numeric `Distance`, boolean `Enabled`;
- plane normals must be non-zero;
- unknown fields are rejected because silently discarding them would not represent the source faithfully.

Malformed JSON, missing fields, wrong types/versions, non-finite numeric values, zero normals, and unsupported additional structure fail with `InvalidDataException`. Null or blank `SectioningJson` omits the complete `clipplaneset`. A disabled empty set emits `enabled="0"` and an empty `clipplanes` element without manufacturing planes.

## XML mapping

- set `Enabled` → `clipplaneset@enabled` as `1` or `0`;
- `Linked` → `clipplaneset@linked` as `1` or `0`;
- `Type="ClipPlaneSet"` → `clipplaneset@mode="planes"`;
- `Planes[]` → ordered `clipplanes/clipplane` children;
- plane `Enabled` → `clipplane@state` as `enabled` or `disabled`;
- plane `Distance` → `clipplane/plane@distance` using invariant round-trip formatting;
- plane `Normal[0..2]` → `clipplane/plane/vec3f@x,@y,@z` using invariant round-trip formatting.

No unit conversion, sign reversal, normal normalization, source JSON mutation, or plane insertion occurs.

## Explicit exclusions

The output contains no `current`, `alignment`, `range`, `box`, `box-rotation`, JSON Version attributes, active-plane index, named alignment, section-box bounds, transforms, or box-mode semantics. Capture and `SetClippingPlanes(string)` restore paths are unchanged.

## Verification

Focused tests exercise:

- enabled single negative-Z plane with negative distance;
- linked two-plane set containing enabled X-normal and disabled Y-normal planes with negative and positive distances;
- disabled zero-plane set;
- absent/null sectioning;
- malformed JSON, missing normal, non-finite normal, non-finite distance, and unsupported box structure;
- absence of every prohibited XML field;
- all preceding ordering, naming, GUID, camera, projection, FOV, and scale tests.

Results:

- focused Lens Next suite: PASS 107/107;
- Navisworks 2021 adapter suite: PASS 54/54;
- Platform atomic-create, create/capture UI, and Open Working View contracts: PASS;
- complete N10-P05 regression gate: PASS.

No deployment, package, Platform, database/schema, capture, restore, normal workflow, or immutable fallback change occurred.
