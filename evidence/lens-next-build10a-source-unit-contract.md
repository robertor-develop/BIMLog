# Lens Next Build 10A source linear-unit contract

Date: 2026-09-03
Baseline: Build 10 commit `254de34cd679c3b0fb7deedbd61e066f9395a80d`

## Phase 1 decision

- `SOURCE_UNIT_PROPERTY=Autodesk.Navisworks.Api.Document.Units`
- `SOURCE_UNIT_TYPE=Autodesk.Navisworks.Api.Units`
- `CAN_STORE_IN_EXISTING_VISUAL_PACKAGE=YES`
- `DATABASE_SCHEMA_CHANGE_REQUIRED=NO`
- `DIGEST_IMPACT=New non-null metadata is conditionally included in native and
  Platform canonical digests; historical packages with the field absent retain their
  exact prior digest.`
- `BACKWARD_COMPATIBILITY_POLICY=Missing SourceLinearUnit means unknown for future
  XML-unit-dependent behavior and remains valid for all normal BIMLog operations.`

## Stored representation

New native camera captures set `Camera.SourceLinearUnit` to the exact canonical
`Autodesk.Navisworks.Api.Units` enum name returned by `Document.Units.ToString()`,
such as `Feet` or `Meters`. The stored value describes the coordinate values already
captured. It is not an XML token and does not transform position, rotation, or any
other camera value.

The field is additive inside the existing `visual_state_json` package. The existing
`lens_viewpoints.visual_state_json` and `visual_state_digest` columns carry it, so no
database or schema change is required.

## Digest policy

When `SourceLinearUnit` is non-null and non-empty, its exact string is appended before
the existing camera tokens in both:

- `lens-next-navigation.v1`, used by normal new viewpoint capture; and
- the full Visual Package digest canonicalization used by exact capture.

Native and Platform implementations use the same conditional rule. When the field is
absent or null, no token is appended, preserving historical v1/v2/v3 and navigation
digests byte-for-byte. Changing or removing a captured unit from a new package causes
digest mismatch.

## Compatibility and failure boundary

Historical packages deserialize the missing property as null and continue through
Create, persistence, retrieval, Open Working View, camera restore, screenshot, and
sectioning paths exactly as before. ApplyCamera intentionally ignores the metadata.

An unrecognized string remains inert for normal viewpoint operations and is still
integrity-protected by the digest. A future XML-unit-dependent path must map only a
known `Autodesk.Navisworks.Api.Units` enum name to a proven XML token and fail that
future path when the value is absent or unrecognized. Build 10A adds no XML units
token, conversion, inference, or historical backfill.

## Frozen behavior

Camera.Position and Camera.Rotation assignments are unchanged. Open Working View,
`DocumentCurrentViewpoint.CopyFrom(Viewpoint)`, Platform atomic-create semantics,
identity, Saved Viewpoint behavior, database/schema, and production N10-P05 remain
unchanged.
