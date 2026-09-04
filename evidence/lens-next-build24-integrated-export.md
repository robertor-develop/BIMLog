# Lens Next Build 24 — integrated three-view XML export

Date: 2026-09-04

Development rollback point: `7cd7166663ca2069f611bf09efdca9a01aa06e27`

Result: **PASS — one deterministic three-view artifact generated and validated**

## Controlled source fixtures

No customer, Ruben, production, or newly captured record was used. The integration harness reuses values already present in the controlled exporter tests:

- `VP-160`, server 160: Build 16 perspective scale fixture combined with the repository's v3 digest-vector-H position/rotation/up values; no sectioning.
- `VP-161`, server 161: Build 18 orthographic scale fixture, Build 12 single-axis rotation, Build 14 up-vector values, and Build 20 enabled negative-Z single-plane fixture.
- `VP-172`, server 172: existing Build 12 compound rotation and position cases, existing up-vector case, and Build 20 linked mixed-state two-plane fixture.

These are non-production authoritative test-package fixtures: every record carries matching project, server/viewpoint identity, lifecycle, revision, and digest fields required by the established test contract. The input enumeration is intentionally shuffled; Build 05 orders the output by priorities 1, 2, and 3 as `VP-160`, `VP-161`, `VP-172`.

## Preserved artifacts

- `evidence/build24-integrated-export/bimlog-three-viewpoints.xml`
- `evidence/build24-integrated-export/source-to-output.json`

The comparison artifact records fixture provenance, reconciled summary counts, expected/actual names and GUIDs, source/XML projection, source/XML position and rotation, up-vector presence, and source/XML clip-plane counts.

## Integrated result

- requested: 3;
- serialized: 3;
- skipped: 0;
- export result: `SUCCESS`;
- validation result: `PASS`;
- exact `<view>` count: 3;
- ordered names: `VP-160`, `VP-161`, `VP-172`;
- deterministic GUIDs: `d6616019-16e4-5840-ad94-cb07e4b4dcf5`, `1dac4577-cbe7-5839-86c7-a5fd10de0fe7`, `e7b0cbc4-1079-57b7-82ca-edcd9bc8bc82`;
- projections: perspective, orthographic, perspective;
- clip-plane counts: 0, 1, 2.

All source positions and rotations round-trip numerically. Up vectors are present for all three fixtures. Perspective/orthographic focal, FOV-presence, aspect, and height behavior uses the unchanged Builds 16–18A pipeline. Sectioning uses the unchanged Build 20 subset. The generated document contains no duplicate/missing view, unit/schema declaration, range, box, box rotation, current-plane index, alignment, near/far, linear/angular, lighting, render, or tool semantics.

Running the same fixture twice produces byte-identical XML. The preserved file is 2,702 bytes with SHA-256 `5A174329192682D61FE35D0FDB630F59E47690467C42F3A67AFEE0019995358A`.

Verification:

- focused Lens Next suite: PASS 122/122;
- Navisworks 2021 adapter suite: PASS 54/54;
- Platform atomic-create, create/capture UI, and Open Working View source contracts: PASS;
- complete N10-P05 regression gate: PASS.

No product mapping code, capture, restore, diagnostic policy, Platform, database/schema, deployment, package, Navisworks import, or immutable fallback change occurred.
