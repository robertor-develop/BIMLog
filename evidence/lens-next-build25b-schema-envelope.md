# Lens Next Build 25B — Navisworks 2021 schema envelope

Date: 2026-09-05

Development base: `5541bd2c5ce8ea09b4f232917894d4f4d7d4b2ce`

## Authoritative local evidence

Navisworks Manage 2021 installs the no-namespace exchange schema at:

`C:\Program Files\Autodesk\Navisworks Manage 2021\schemas\nw-exchange-12.0.xsd`

Genuine local output produced by `XmlViewpointsExportPlugin` consistently declares:

`xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`

`xsi:noNamespaceSchemaLocation="http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd"`

Evidence files inspected:

- `evidence/build17-perspective-output/navisworks-export.xml`
- `evidence/build18-orthographic-output/navisworks-export.xml`
- `evidence/build19-sectioning-output/navisworks-export.xml`
- `C:\Users\soporte\Documents\BIMLog-viewpoints-20260827-191025.xml`

The installed 12.0 XSD defines the unqualified `exchange` root and makes `units`, `filename`, and `filepath` optional. Build 25B therefore adds only the namespace declaration and schema-location attribute. It does not emit units.

## Root cause and correction

The Build 24 document had no `xsi` namespace declaration and no `xsi:noNamespaceSchemaLocation`. The genuine Navisworks importer therefore had no schema reference to resolve, producing the user-observed `Cannot find schema file 0` before camera validation.

The corrected artifact is:

`evidence/build25b-schema-envelope/bimlog-three-viewpoints.xml`

Its complete `viewpoints` subtree is byte-identical to Build 24. Names, GUIDs, ordering, camera position, rotation, up vector, projection, focal/FOV/scale, and sectioning payloads are unchanged.

## Local XSD validation boundary

The corrected envelope resolves the exact installed 12.0 schema. Full XSD validation then reports two existing sectioning-shape errors: `clipplaneset` expects `range` before `clipplanes` for VP-161 and VP-172. Build 20 and Build 25B explicitly prohibit inventing or emitting unproven range data. Build 25B does not alter that frozen sectioning contract.

This is separate from the corrected `schema file 0` envelope defect and must not be silently repaired in this build.
