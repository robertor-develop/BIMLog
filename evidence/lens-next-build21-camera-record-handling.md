# Lens Next Build 21 — invalid/missing camera record handling

Date: 2026-09-04

Development rollback point: `13515f76017e9d6fedbf38782bde23ac45893792`

Result: **PASS — invalid individual viewpoints are skipped without weakening collection integrity**

## Classification policy

The isolated exporter now performs two distinct phases before writing:

1. **Collection-fatal integrity validation.** The authoritative project ID must be positive; the collection must be non-null; every record must be non-null and belong to the authoritative project; lifecycle values must be recognized; each active viewpoint must have complete authoritative identity, valid priority, matching SHA-256 visual/package digests, exact package identity/revision/lifecycle agreement, and a unique server viewpoint ID. Any failure aborts the complete export before an output file is created or replaced.
2. **Viewpoint-skippable export eligibility.** Each integrity-valid active viewpoint is independently checked by the existing position, rotation, optional up-vector, projection, camera-scale, and optional sectioning validators. `InvalidDataException` marks only that viewpoint skipped and preserves its exact validator reason. Surviving viewpoints retain the established deterministic order, names, GUIDs, camera mappings, and sectioning mappings.

Inactive recognized lifecycle records remain excluded under the unchanged Build 05 selection policy and are not counted as requested active export viewpoints.

## Export result and zero-valid policy

`LensNextXmlExportResult` reports:

- `RequestedCount`: active, collection-integrity-valid viewpoints evaluated for export;
- `SerializedCount`: surviving viewpoints written;
- `SkippedCount`: individually ineligible viewpoints;
- `SerializedViewpoints`: the ordered authoritative source records written;
- `SkippedViewpoints`: server ID, viewpoint ID, and exact rejection reason for every skip.

The result remains an `IReadOnlyList<LensNextXmlExportInput>` for source compatibility with the existing writer result. If zero exportable active viewpoints remain, the operation throws a clear `InvalidDataException` before XML writing; it does not create or replace a destination with a misleading empty export. The separate legacy shell-only `Write(path)` contract remains unchanged.

## Defaults and optional data

No camera default is created. Missing or invalid required position, rotation, projection, or scale is rejected per viewpoint. Missing optional `WorldUpVector` remains explicitly omitted. Null/absent supported historical `SectioningJson` remains explicitly omitted. Present malformed sectioning follows Build 20 integrity behavior and makes that viewpoint skippable; no section state is invented.

## Focused proof

- 3 valid viewpoints → requested 3, serialized 3, skipped 0;
- independently, 2 valid plus one missing camera, invalid position, or zero-length rotation → requested 3, serialized 2, skipped 1 with exact reason;
- optional up-vector and sectioning absence → camera remains exportable, with both XML elements absent;
- valid plus malformed present sectioning → valid camera serialized, malformed record skipped with exact reason;
- all invalid → clear zero-exportable failure and no output file;
- cross-project contamination, digest mismatch, package identity mismatch, and duplicate identity remain collection-fatal;
- surviving order, names, and GUIDs remain deterministic and unchanged.

Verification:

- focused Lens Next suite: PASS 113/113;
- Navisworks 2021 adapter suite: PASS 54/54;
- Platform atomic-create, create/capture UI, and Open Working View source contracts: PASS;
- complete N10-P05 regression gate: PASS.

No capture, restore, Open Working View, Platform, database/schema, deployment, package, or immutable fallback change occurred.
