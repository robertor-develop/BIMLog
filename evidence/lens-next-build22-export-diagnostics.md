# Lens Next Build 22 — per-viewpoint XML export diagnostics

Date: 2026-09-04

Development rollback point: `57e7784c32724de46e99a49b710d0b021b7c9a79`

Result: **PASS — deterministic in-memory diagnostics added without changing Build 21 classification**

## Diagnostic record

Every active viewpoint that passes the unchanged collection-integrity phase receives one ordered `LensNextXmlExportDiagnostic` in the existing `LensNextXmlExportResult`:

- authoritative `ServerId`;
- authoritative `ViewpointId`;
- trimmed `DisplayId` when present, otherwise null;
- `Result`: `EXPORTED` or `SKIPPED`;
- stable `ReasonCode`;
- sanitized `ReasonDetail` from the existing validator exception when skipped, otherwise null.

No camera JSON, camera component values, screenshot data, sectioning JSON, timestamp, or other payload content is copied into diagnostics.

## Stable codes

- successful validation: `exported`;
- absent required camera: `missing_camera`;
- position validation failure: `invalid_position`;
- rotation validation failure: `invalid_rotation`;
- optional up-vector validation failure: `invalid_up_vector`;
- projection validation failure: `invalid_projection`;
- focal/FOV/scale validation failure: `invalid_scale`;
- present sectioning validation failure: `invalid_sectioning`.

The code is selected by the unchanged existing validator stage, not by parsing mutable exception text. The exact existing exception message remains `ReasonDetail`.

## Fatal and ordering policy

Build 21 collection-fatal validation still runs before diagnostics exist. Cross-project contamination, null records, identity/digest/package mismatch, duplicate identity, and the other frozen collection failures throw their existing collection-level exception, return no per-viewpoint result, and do not create or replace destination XML.

Diagnostics follow the same priority, descending capture time, and server-ID ordering used by export eligibility. Both exported and skipped records retain their place in that ordered requested set. Repeated runs and shuffled source enumeration produce the same diagnostic classification and ordering. Timestamps are not diagnostic identity and no diagnostic timestamp is emitted.

Zero exportable viewpoints still throw the unchanged clear Build 21 failure before writing, preserving any existing destination.

## Verification

- three valid viewpoints produce three explicit `EXPORTED` diagnostics;
- mixed valid/missing-camera/invalid-position/invalid-rotation/invalid-sectioning inputs produce distinct exact codes and useful details;
- diagnostic records contain identifiers and classification only, without raw payloads;
- shuffled repeated runs produce equivalent ordered diagnostics;
- collection-fatal contamination produces no result and preserves the destination;
- all pre-existing camera, sectioning, eligibility, fatal-integrity, name, GUID, and ordering tests remain unchanged and passing;
- focused Lens Next suite: PASS 117/117;
- Navisworks 2021 adapter suite: PASS 54/54;
- Platform atomic-create, create/capture UI, and Open Working View source contracts: PASS;
- complete N10-P05 regression gate: PASS.

No capture, restore, XML mapping, eligibility, collection-fatal rule, Platform, database/schema, deployment, package, or immutable fallback change occurred.
