# Lens Next Build 23 — export-level summary diagnostics

Date: 2026-09-04

Development rollback point: `1a91e66c43084b2a6a8b6bf7abf25c892bc095ae`

Result: **PASS — deterministic summary metadata added without changing export semantics**

## Summary format

Successful and partial exports expose `LensNextXmlExportSummary` through the existing `LensNextXmlExportResult.Summary`:

- nullable `RequestedCount`, `SerializedCount`, and `SkippedCount`;
- exact resolved `OutputPath`;
- `OutputWritten` truth flag;
- `XmlEncoding="utf-8"`;
- `XmlRoot="exchange"`;
- `ViewFolderName="BIMLog Viewpoints"`;
- `UnitsStatus="NOT_EMITTED"`;
- `SchemaStatus="NOT_EMITTED"`;
- `ValidationResult="PASS"` or `"FAIL"`;
- `ExportResult="SUCCESS"`, `"PARTIAL_SUCCESS"`, or `"FAIL"`;
- sanitized `FailureDetail` only on failure.

Build 22 per-viewpoint diagnostics remain present and unchanged.

## Result and count policy

- all requested active viewpoints serialized: `SUCCESS`;
- one or more serialized and one or more skipped: `PARTIAL_SUCCESS`;
- zero serialized or collection-fatal rejection: `FAIL`.

Successful/partial summary construction enforces `RequestedCount = SerializedCount + SkippedCount`. Zero-valid failure reports the already-known requested/skipped counts and serialized zero. Collection-fatal failure preserves the safe Build 21 behavior: requested/skipped counts remain null because classification did not complete; no counts are fabricated.

Failure summaries are attached to the existing `InvalidDataException` and retrieved with `LensNextXmlExportFailure.SummaryFor(exception)`. This preserves the Build 21 exception type and collection-fatal behavior. `OutputWritten=false` distinguishes an attempted destination from a replaced output. Existing destinations remain untouched on zero-valid or collection-fatal rejection.

## Output validation

After atomic write, the exporter reopens the actual resolved destination and requires:

- well-formed XML;
- an explicit UTF-8 declaration;
- exact `exchange` root;
- exactly one `viewpoints` element and one named `viewfolder`;
- actual direct `<view>` count equal to `SerializedCount`;
- absence of unproven `range`, `box`, and `box-rotation` elements;
- absence of unproven `units`, schema, current, alignment, near/far, linear, and angular attributes.

Only after these checks does `ValidationResult` become `PASS`. No unit or schema token/URL is emitted.

## Verification

- 3 valid → 3/3/0, validated `SUCCESS`;
- 2 valid plus 1 skipped → 3/2/1, validated `PARTIAL_SUCCESS`;
- zero valid → `FAIL`, exact resolved destination, no created/replaced file;
- collection-fatal → `FAIL`, no fabricated requested/skipped counts, existing destination preserved;
- Build 22 ordered per-viewpoint diagnostics remain unchanged;
- focused Lens Next suite: PASS 121/121;
- Navisworks 2021 adapter suite: PASS 54/54;
- Platform atomic-create, create/capture UI, and Open Working View source contracts: PASS;
- complete N10-P05 regression gate: PASS.

No camera/sectioning mapping, membership, ordering, classification, capture, restore, Platform, database/schema, deployment, package, or immutable fallback change occurred.
