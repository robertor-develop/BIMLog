# Lens Next Build 19 — stored sectioning contract

Date: 2026-09-04

Development rollback point: `6555ba7fb1dae49f5c261b0b2b463a90b6a5139b`

Result: **PASS — current opaque JSON contract and proven XML correspondences inventoried**

## Authoritative source and custody

Navisworks 2021 exposes `Autodesk.Navisworks.Api.Document.ActiveView` as `Autodesk.Navisworks.Api.View`. Its public `string View.GetClippingPlanes()` returns “clipping planes in the form of a JSON ClipPlaneSet object,” according to the installed `Autodesk.Navisworks.Api.xml`. The paired public APIs are `void SetClippingPlanes(string)` and `bool TrySetClippingPlanes(string)`.

`AutodeskVisualStateAdapter.TryGetSectioningJson()` calls `ActiveView.GetClippingPlanes()` first and returns the string unchanged. Its reflection fallback probes `GetClippingPlanes` and `GetClipPlaneSet` on the current viewpoint. The installed 2021 public `Viewpoint` type exposes neither method; the authoritative installed path is `Document.ActiveView`.

Current lightweight capture stores the returned string as `LensNextNavigationView.SectioningJson` under contract `lens-next-navigation.v1`, schema version 1. The Platform persists the complete navigation envelope as opaque `visualStateJson`; there is no separate sectioning database column. Platform validation checks envelope identity and digest but does not parse or normalize the inner sectioning JSON.

The navigation digest appends the exact `SectioningJson` string. Therefore whitespace, property order, numeric spelling, and case are integrity-significant. The historical `bimlog.lens_next.visual_state.v1` package likewise stores `LensNextVisualState.SectioningJson`; visual digest v1/v2/v3 all append the exact string.

## Stored JSON fields

| Field | Source API | Stored property/type | Authoritative | Optional | Available | Restored | Notes |
|---|---|---|---|---|---|---|---|
| `Type` | `View.GetClippingPlanes()` | `SectioningJson.Type` / string | yes | no within returned object | yes | yes, opaquely | Observed `ClipPlaneSet`. |
| `Version` | same | `SectioningJson.Version` / integer | yes | no | yes | yes, opaquely | Observed version 1. |
| `Planes` | same | `SectioningJson.Planes` / array | yes | no | yes | yes, opaquely | Empty and multiple-plane arrays proven. |
| `Linked` | same | `SectioningJson.Linked` / boolean | yes | no | yes | yes, opaquely | Both false and true accepted/read back. |
| `Enabled` | same | `SectioningJson.Enabled` / boolean | yes | no | yes | yes, opaquely | Top-level set enabled state. |
| `Planes[].Type` | same | nested string | yes | no per plane | yes | yes, opaquely | Observed `ClipPlane`. |
| `Planes[].Version` | same | nested integer | yes | no per plane | yes | yes, opaquely | Observed version 1. |
| `Planes[].Normal` | same | nested three-number array | yes | no per plane | yes | yes, opaquely | World-space plane normal represented directly by X/Y/Z components. |
| `Planes[].Distance` | same | nested number/double | yes | no per plane | yes | yes, opaquely | Signed plane-equation distance. |
| `Planes[].Enabled` | same | nested boolean | yes | no per plane | yes | yes, opaquely | Enabled and disabled planes proven together. |
| `Completeness.Sectioning.RequiredForReconstruction` | capture-derived | nullable boolean metadata | yes for historical full package | yes in navigation v1 (absent) | historical only | readiness input | Derived from string presence, not parsed `Enabled`. |
| `Active`, `Supported`, `Captured`, `Complete`, `Truncated`, `Count`, `Status`, `Message` | capture-derived | `LensNextVisualComponentState` fields | yes for historical full package | absent from navigation v1 | historical only | readiness input | `Count` is 1 for a present payload, not plane count. `Truncated` is always false. |

## Current behavior and compatibility

- No sectioning: the real 2021 getter returns a non-null disabled object: `{"Type":"ClipPlaneSet","Version":1,"Planes":[],"Linked":false,"Enabled":false}`. Current capture stores and digest-protects it; it does not collapse it to null. Lightweight restore reapplies it, explicitly restoring sectioning-disabled state.
- Active sectioning: the complete JSON string is stored and sent unchanged to `SetClippingPlanes(string)`. The controlled single-plane and two-plane payloads round-tripped exactly except ordinary binary64 spelling of one decimal value.
- Getter unavailable/failure: the capture helper catches the failure and can return null. Lightweight restore skips a null/blank payload and still restores the camera.
- Partial/unavailable metadata: navigation v1 has no component-completeness object. Historical full packages use `Completeness.Sectioning`; active unsupported/incomplete/truncated metadata blocks full restore before mutation, while inactive unsupported metadata does not block.
- Malformed sectioning string: Platform integrity validation treats it as opaque and accepts it if its surrounding navigation digest is valid. Lightweight Open Working View applies the camera first, catches the section setter failure as an optional warning, and returns applied success. Historical full restore may pass readiness only if its metadata claims completeness; setter failure then triggers the transactional failure/rollback path.

## Capabilities represented

Stored today: set enabled/disabled; linked/unlinked; zero, one, or multiple planes; per-plane enabled/disabled; per-plane three-component normal; signed distance/offset; JSON set/plane type identifiers; JSON versions. Plane location is represented by normal plus signed distance, not by a separate origin.

Not stored today: explicit plane origin; active/current plane index; XML alignment classification; XML outer `clipplane@distance`; explicit section mode (`planes` versus `box`); section-box range/min/max; box rotation/transform; named alignment; gizmo/interaction state; explicit active-plane count. A section box may potentially be reduced by Navisworks to planes, but that semantic preservation is not proven and is not claimed.

## Proven Navisworks XML correspondences

Installed `nw-exchange-12.0.xsd` and genuine `XmlViewpointsExportPlugin` output prove:

| Stored JSON field | Target XML | Proven | Evidence |
|---|---|---|---|
| set `Enabled` | `clipplaneset@enabled` (`true→1`, `false→0`) | yes | Active single/multiple exports plus prior inactive genuine exports. |
| `Linked` | `clipplaneset@linked` (`true→1`, `false→0`) | yes | Controlled false single-plane and true two-plane exports. |
| `Planes[]` | `clipplaneset/clipplanes/clipplane` | yes | Controlled one- and two-plane exports; Navisworks adds default slots independently. |
| plane `Enabled` | `clipplane@state` (`true→enabled`, `false→disabled`) | yes | Two-plane genuine export. |
| plane `Normal[0..2]` | `clipplane/plane/vec3f@x,@y,@z` | yes | X- and Y-normal planes plus negative-Z plane. |
| plane `Distance` | `clipplane/plane@distance` | yes | `-53.1620981117`, `-10.5`, and `20.25` matched genuine XML. |
| set `Type=ClipPlaneSet` | `clipplaneset` with `mode="planes"` | yes for observed contract | Genuine outputs. No box-mode claim. |
| set/plane `Version` | none identified | no | XSD/output contains no matching version field. |
| active/current plane | `clipplaneset@current` | no | XML field exists, but BIMLog JSON does not store it. |
| alignment | `clipplane@alignment` | no direct mapping | XML emits `custom`; BIMLog JSON stores no alignment token. |
| range/box/box rotation | `range`, `box`, `box-rotation` | no | XML requires/emits values not present in stored JSON; controlled empty-model values are not usable mappings. |
| outer clip-plane distance | `clipplane@distance` | no | Genuine exports emit zero independently of JSON `Distance`. |

No sectioning element is emitted by the BIMLog XML exporter in Build 19.

## Capture-gap conclusion

No capture change is required to export the currently stored plane-set semantics that have proven mappings. Exact reproduction of XML current-plane, alignment, range/box, box rotation, or explicit box-mode semantics would require additional authoritative evidence and potentially additional capture data; Build 19 neither adds nor authorizes those fields.

Bound controlled evidence is in `evidence/build19-sectioning-output`. The product source is unchanged.
