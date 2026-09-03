# Lens Next Build 11 — orientation contract proof

Date: 2026-09-03

Base checkpoint: `8e345d7ee0c657168173dae8e4d94e64af785e1e`

## Decision

`ORIENTATION_POLICY=RAW_NATIVE_VALUES`

The proposed export representation maps BIMLog `Camera.Rotation.A/B/C/D` directly to Navisworks XML quaternion `a/b/c/d`. There is no handedness change, axis change, component reorder, conjugation, or multiplication. The proof layer validates that every component is finite and that the quaternion is not zero length, then preserves all four source values unchanged.

Quaternion sign is not canonicalized. A stored quaternion always produces the same proposed representation, while comparison accepts both `q` and `-q` as the same spatial rotation. Export proof never rewrites the stored camera.

## Authoritative evidence chain

1. Installed Autodesk API documentation at `C:\Program Files\Autodesk\Navisworks Manage 2021\Autodesk.Navisworks.Api.xml` defines `Rotation3D` as a quaternion, exposes components `A`, `B`, `C`, `D`, and documents `Viewpoint.Rotation` as the camera rotation from the Navisworks base orientation: looking down negative Z with positive X right and positive Y up. Its identity/default is `0 0 0 1`.
2. Frozen native capture in `plugins/BIMLogLensNext/native/AutodeskVisualStateAdapter.cs` reads `view.Rotation` and assigns `A=r.A`, `B=r.B`, `C=r.C`, `D=r.D` without conversion.
3. Frozen Open Working View restore in the same source constructs `new Rotation3D(camera.Rotation.A, camera.Rotation.B, camera.Rotation.C, camera.Rotation.D)` and applies the writable viewpoint through `DocumentCurrentViewpoint.CopyFrom(Viewpoint)`, also without conversion.
4. Installed Autodesk schema `C:\Program Files\Autodesk\Navisworks Manage 2021\schemas\nw-exchange-12.0.xsd` defines `<rotation><quaternion a="..." b="..." c="..." d="..."/></rotation>` in that order. SHA-256: `47F8111547A4ACD92D22757E409C9D567B20E34358F2807C1ECEA7249627B78F`.
5. A genuine Navisworks 12.0 export, `F:\BIMLog\BIMLog\BIMLog Part 10\BIMTECH - BIMLOG\35-45 41ST_COORD_MODEL_05-20-26.xml`, uses those exact quaternion attributes under the Autodesk exchange namespace. SHA-256: `6385F6BFB9141866995A0E437DCC10A6E8A5F28E4E25624F98FED3E0D032AB03`. This is installed/local Autodesk-generated evidence, not a numeric inference or internet example.

Together these sources bind the same Navisworks quaternion type, base coordinate frame, component names/order, stored representation, restore representation, and Autodesk XML representation. There is no evidence or contract boundary requiring a coordinate conversion.

## Exact proposed conversion contract

- Source type/property: `Autodesk.Navisworks.Api.Rotation3D`, `Autodesk.Navisworks.Api.Viewpoint.Rotation`.
- Source order: `A, B, C, D`.
- Target order: XML attributes `a, b, c, d`.
- Handedness change: none.
- Axis change: none; retain Navisworks base frame (view negative Z, positive X right, positive Y up).
- Sign rule: preserve the stored sign; for equivalence testing, accept component-wise `q` or `-q` after scale-safe normalization.
- Normalization rule: do not normalize or otherwise modify export components; reject zero length and non-finite input.
- Formula: `a=A; b=B; c=C; d=D`.
- Formatting proof: invariant-culture round-trip (`R`) strings.

## Focused acceptance

The test-only `LensNextXmlOrientationProof` is deliberately outside product source and disconnected from the production XML writer. Tests cover identity, X-axis and Y-axis single rotations, a normalized compound rotation, an equivalent negated quaternion, zero length, NaN, and infinity. They also prove deterministic output, source object immutability, unchanged Build 09 position, unchanged Build 10A `SourceLinearUnit`, and absence of rotation, up, projection, focal, or sectioning XML.

Command:

`dotnet run --project plugins\BIMLogLensNext\tests\BIMLogLensNext.Tests.csproj -c Release`

Result: `PASS 77/77`.

No production XML rotation is emitted in Build 11.
