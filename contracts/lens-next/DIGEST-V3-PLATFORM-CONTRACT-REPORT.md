# DIGEST V3 PLATFORM CONTRACT REPORT

Date: 2026-09-01
Platform implementation commit: `92f93ce9d2f824a47d7a290bfe516de0a3a2a000`
Contract: `lens-next-visual-digest.v3`
Status: source implemented and clean-production-build verified; production deployment not yet performed

## Outcome

The Platform now has a strict, backward-compatible v3 digest implementation that integrity-protects the existing Working View state plus every field in `ElementReference v2` and `ModelReference v2`. Historical v1 and v2 packages retain their original canonicalizers and are never reinterpreted as v3. No database schema change, historical package rewrite, Legacy Lens change, or Saved Viewpoint change was made.

The previously unguarded Lens Next visual-state persistence route now recomputes and validates the embedded, supplied, and server-computed digest before write. The same validation runs before a stored package is returned. The legacy `lens-sync` route was deliberately left unchanged because it belongs to Legacy Lens and is outside this authorization.

## Contract selection

- Explicit `lens-next-visual-digest.v1` uses the historical v1 rules, including the existing bounded .NET floating-point evidence compatibility path.
- Explicit `lens-next-visual-digest.v2` uses the historical v2 rules.
- Missing contract metadata continues to mean v2. It does not opt a package into v3.
- Explicit `lens-next-visual-digest.v3` uses the rules below.
- Any other contract value fails with `visual_state_digest_contract_unsupported` and HTTP 409.

## Exact v3 canonical representation

The canonical byte stream is UTF-8. Each token below is converted to its canonical string and followed by one U+001F byte. Field names are diagnostic labels and are not included in the byte stream. The order is fixed.

### Existing visual-state sequence

1. `schemaVersion`
2. `projectId`
3. `serverId`
4. `viewpointId`
5. `lifecycleStatus`
6. `revisionNumber`
7. `modelFingerprint`
8. Camera, either the literal `camera:null`, or in this order:
   - position X, Y, Z
   - rotation A, B, C, D
   - world-up X, Y, Z
   - projection
   - focal distance
   - horizontal extent at focal distance
   - vertical extent at focal distance
9. `selected.length`, followed by each selected reference in deterministic order
10. `hidden.length`, followed by each hidden reference in deterministic order
11. `appearance.length`, followed by each appearance record in deterministic element-reference order
12. `models.length`, followed by each model reference in deterministic order
13. `sectioningJson`
14. `redlinesJson`
15. `screenshotSha256`

Each selected item begins with `S`; each hidden item begins with `H`; each appearance item begins with `A`. After an appearance item’s ElementReference tokens, the sequence is red, green, blue, transparency.

### ElementReference v2 sequence

Every selected, hidden, or appearance element contributes exactly this order:

1. `referenceVersion`
2. `persistenceScope`
3. `strategy`
4. nested ModelReference `referenceVersion`
5. nested model `modelGuid`
6. nested model `sourceGuid`
7. nested model `sourceFileNameNormalized`
8. nested model `currentFileNameNormalized`
9. nested model `transformFingerprint`
10. nested model `modelInstanceDiscriminator`
11. `instanceGuid`
12. stable category `categoryName`
13. stable category `valueKind`
14. stable category `value`
15. source element `namespace`
16. source element `categoryName`
17. source element `propertyName`
18. source element `valueType`
19. source element `value`
20. hierarchy path length
21. each hierarchy path integer, in original path order
22. confirmation `className`
23. confirmation `displayName`
24. confirmation `stablePropertyFingerprint`

Accepted reference version is exactly `lens-next-element-reference.v2`. Accepted persistence scopes are `same-document-reopen`, `source-version-stable`, and `source-reload-stable`. Accepted strategies are `instance-guid`, `autodesk-stable-id`, `source-element-id`, and `exact-tree-path`.

### ModelReference v2 sequence

Every top-level model reference contributes exactly:

1. `referenceVersion`
2. `modelGuid`
3. `sourceGuid`
4. `sourceFileNameNormalized`
5. `currentFileNameNormalized`
6. `transformFingerprint`
7. `modelInstanceDiscriminator`

Accepted reference version is exactly `lens-next-model-reference.v2`.

## Canonicalization rules

- Null: the literal `<null>`.
- Booleans and nested JSON subdocuments: existing authoritative `sectioningJson` and `redlinesJson` remain exact serialized strings. Their exact UTF-8 bytes are protected; semantic reserialization is intentionally not treated as equal.
- Integers: invariant base-10 safe integers with no grouping. Hierarchy paths preserve element order.
- Floating point: finite IEEE-754 binary64, negative zero normalized to positive zero, serialized as `f64:` followed by the 16 lowercase hexadecimal bytes of the big-endian representation.
- Strings: exact UTF-8 supplied by the producer. No culture-dependent conversion and no path case or separator rewriting occurs in the digest layer.
- GUIDs: braces are removed if present, then the value is validated and serialized as lowercase canonical D format. `00000000-0000-0000-0000-000000000000` remains an explicit value; it is not converted to null or used as a fake element token.
- Arrays: explicit array length is digested. Element and model arrays are sorted ordinally by their complete canonical v2 reference tokens. Hierarchy-path arrays are not sorted.
- Transforms: camera numeric transforms use the binary64 rule. Model transforms use the exact authoritative `transformFingerprint` string supplied by ModelReference v2.
- Objects: property order in input JSON is irrelevant; the fixed sequence above is authoritative.
- Diagnostics and transient telemetry are excluded.

## Shared golden vectors

Canonical fixture: `contracts/lens-next/lens-next-visual-digest-v3-vectors.json`
Fixture bytes: `27336`
Fixture SHA-256: `25E8BF94286DB34D05518BB0D2403B77BD0EBDD9381EE42861D8AA80399DEDC7`

| ID | Case | Canonical bytes | Expected SHA-256 |
|---|---|---:|---|
| A | InstanceGuid reference | 684 | `cbaddaf4c097cff9b10d89e70625131b39d2856c35ab14d6084f0c890c103ad3` |
| B | Autodesk stable-ID fallback | 671 | `738b9a524a2566f005d1a89114037a94d6324dd38620458f7cc6cf5dd8a74f79` |
| C | source-element-ID fallback | 689 | `7faf54b5d7277bba28bd977d295f750b8b98f5475fa7a06c5b80e197e8c11f36` |
| D | exact-tree-path fallback | 669 | `523dd9326227dec8edab5f6738e21e789fd0afa9452f67582828d98ca482106f` |
| E | duplicate model metadata | 625 | `6c5da56f8f0f302d32304eb287377250dfaf925ba3d7c60b9114f3711e6ae9e6` |
| F | Guid.Empty source object | 397 | `a054ed36620d90ba3f3100a9d6b1a734f0e9c6e791ade3eb9a1a7140c96a8dbc` |
| G | null optional fields | 419 | `eb67bc75138f6e2f71b59055357c3545f6416a3e90deb570cd7c08065657ac74` |
| H | populated transform and IEEE-754 camera | 674 | `c53c35580d9086cbf53ad0b788e707ed948616dd1cfff4c3eb2242caace5c0d7` |
| I | empty arrays | 169 | `ab82998da6eb153fda1d4833760bfa11391ef500ec26122557db24b43c11647a` |
| J | Unicode/path strings and nested booleans | 461 | `8a2e84f6e12eba5c3e33b00c2bcf26f829b3e138ab821a64203b1e1b4550bb90` |
| K | tampered ElementReference | mutation must produce the fixture’s different tampered digest and stale-digest validation must fail |
| L | tampered ModelReference | mutation must produce the fixture’s different tampered digest and stale-digest validation must fail |

The fixture contains the full input visual state, canonical input as Base64, canonical byte length, expected digest, and named K/L tamper mutations. It is the shared Platform/native authority; Main 04 must consume this exact file rather than reproduce the expected values independently.

## Tamper proof

Automated Platform tests mutate and reject all 23 authoritative identity slots: ElementReference version, persistence scope, strategy, all seven nested ModelReference slots, InstanceGuid, all three stable-category slots, all five source-element slots, hierarchy path, and all three confirmation slots. Structural-version tampering fails before hashing; valid structural mutations produce a different digest and the stale embedded digest is rejected. K and L additionally record deterministic original and tampered hashes in the shared fixture.

## Persistence and API validation

- Atomic create and local-upload paths retain their existing validate-then-rebind behavior.
- `POST .../lens-viewpoints/:id/visual-state` now requires outer digest = embedded digest = server recomputation, plus exact record identity, before persistence.
- `GET .../lens-viewpoints/:id/visual-state` repeats the same verification before returning stored bytes.
- Invalid packages fail closed with specific 409/422 errors and digest diagnostics.
- No historical record is rewritten, recomputed, or migrated.

## Backward-compatibility proof

- Historical v1 null-vector hash remains `a2f9dae5c4bfb18073d72775318fdd2d70c1a24bdbafbfc9b3df5f7d2fc4407a`.
- Historical v2 floating-point vector hash remains `55bad86cd7f9d4fb5f935b8b8aef597348322a15fd4f439557af357dc55ff918`.
- The existing v1 bounded .NET floating-point evidence path remains unchanged and its tamper denial still passes.
- The complete Lens Next Build 1–10 behavior sequence passed, including the new v3 test.
- API TypeScript strict typecheck passed.
- The production API build passed from reconciled clean commit `380fabffb5ee052a43c434d675ac45bf93a5fd6a`, including deterministic `PLATFORM.md`, server bundling, and runtime-closure verification of 15 direct packages, 15 dependencies, and 16,142 files.
- The referenced TypeScript project build, Living Brief integrity check (11 required documents, 38 internal links, 40 standards links), `git diff --check`, and clean worktree status passed after artifact assembly.

## Database impact

No schema migration is required. The existing `visual_state_json TEXT` stores the versioned opaque package, and `visual_state_digest TEXT` stores its digest. No DDL or data mutation was performed.

## Version decision

The exact current shared field/package identity present in the authorized source is `v1.05.N05-P01`. The Platform digest-v3 release therefore increments only P and preserves N05: proposed coordinated Platform identity `v1.05.N05-P02`. This report does not increment N and does not change any native package identity.

## Deployment plan and readiness

1. Reconcile and commit this report/Living Brief against implementation commit `92f93ce9d2f824a47d7a290bfe516de0a3a2a000`.
2. Clean production build and publication-source gates passed at reconciled commit `380fabffb5ee052a43c434d675ac45bf93a5fd6a`.
3. Push the reviewed Platform commit.
4. Publish through Replit Shell only.
5. Verify production still accepts known v1 and v2 packages, rejects tampering, and accepts a v3 API fixture.
6. Only after production verification may Main 04 emit v3 from Lens Next.

Current readiness: **implementation, local regression, clean production artifact, and publication-source gates are ready; production is not yet v3-ready because push, Replit publication, and post-deploy verification have not occurred.** Main 04 must not switch native capture to v3 yet.
