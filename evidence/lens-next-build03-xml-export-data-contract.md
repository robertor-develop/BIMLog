# Lens Next Build 03 — XML export data contract

## Governing boundary

The sole future export source is the authoritative BIMLog `lens_viewpoints` row
and its validated `visual_state_json` package returned by the Platform visual-state
API. The Navisworks Saved Viewpoints collection is not an export source. This
contract creates no XML, defines no XML element mapping, converts no camera value,
and authorizes no product or capture change.

The existing `Export XML` command in `LensNextDockPanelControl.cs` drives the
Navisworks `XmlViewpointsExportPlugin`, which exports Navisworks Saved Viewpoints.
That legacy command is explicitly outside this future BIMLog-record export
contract and must not be reused or relabelled as its implementation.

## Authoritative data surfaces

- Record: `lib/db/src/schema/lens-viewpoints.ts`, table `lens_viewpoints`.
- Record inventory API: `GET /projects/:projectId/clash-reports/lens-pull` in
  `artifacts/api-server/src/routes/clash_reports.ts`.
- Visual package API: `GET /projects/:projectId/clash-reports/lens-viewpoints/:viewpointId/visual-state`
  in the same route file. It verifies record identity and digest before returning
  `visualStateJson`.
- Visual package schema: `LensNextVisualState` and `LensNextCameraState` in
  `plugins/BIMLogLensNext/src/LensNextVisualStateContracts.cs`.

An exporter must reject a row whose package is absent, invalid, identity-mismatched,
or digest-mismatched. It must not reconstruct missing values from a local Saved
Viewpoint or from the currently displayed Navisworks camera.

## Field inventory

### Record and identity fields

FIELD=authoritative BIMLog viewpoint ID
SOURCE_FILE_OR_API=lib/db/src/schema/lens-viewpoints.ts; lens-pull and visual-state APIs
SOURCE_PROPERTY=lens_viewpoints.id; identity.serverId
TYPE=positive integer
AUTHORITATIVE=YES
OPTIONAL=NO
CURRENTLY_AVAILABLE=YES
NOTES=Platform primary key; distinct from the external viewpointId string.

FIELD=viewpoint identity
SOURCE_FILE_OR_API=lib/db/src/schema/lens-viewpoints.ts; validated visual package
SOURCE_PROPERTY=lens_viewpoints.viewpoint_id; LensNextVisualState.ViewpointId
TYPE=non-empty string
AUTHORITATIVE=YES
OPTIONAL=NO
CURRENTLY_AVAILABLE=YES
NOTES=The visual package value must equal its owning row identity.

FIELD=title/name
SOURCE_FILE_OR_API=lens_viewpoints record
SOURCE_PROPERTY=display_id, viewpoint_id, note
TYPE=nullable string candidates plus required viewpoint_id
AUTHORITATIVE=NO
OPTIONAL=YES
CURRENTLY_AVAILABLE=NO
NOTES=BIMLog stores these distinct values but no authoritative export-title property or naming policy. A future build must choose a policy explicitly; this build does not guess one.

FIELD=ordering/display identity
SOURCE_FILE_OR_API=lib/db/src/schema/lens-viewpoints.ts; lens-pull API
SOURCE_PROPERTY=display_id, trade_floor_seq, trade_floor_seq_correction, captured_at, id
TYPE=nullable string; nullable integers; nullable timestamp; positive integer
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=All values are stored, but no XML tree/order policy exists. The lens-pull transport orders rows by captured_at descending; the UI applies a separate priority/capture/server-id sort. Neither is silently promoted to export order.

FIELD=screenshot reference
SOURCE_FILE_OR_API=lib/db/src/schema/lens-viewpoints.ts; lens-pull API
SOURCE_PROPERTY=screenshot_url
TYPE=nullable string
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=The validated package can also contain ScreenshotDataUrl and ScreenshotSha256; screenshot evidence is not required for camera reconstruction.

FIELD=project identity
SOURCE_FILE_OR_API=lib/db/src/schema/lens-viewpoints.ts; visual-state API
SOURCE_PROPERTY=lens_viewpoints.project_id; identity.projectId; LensNextVisualState.ProjectId
TYPE=positive integer
AUTHORITATIVE=YES
OPTIONAL=NO
CURRENTLY_AVAILABLE=YES
NOTES=All three representations must agree.

FIELD=model identity
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=LensNextVisualState.ModelFingerprint; ModelReferences[]
TYPE=SHA-256 string plus structured model-reference array
AUTHORITATIVE=YES
OPTIONAL=NO
CURRENTLY_AVAILABLE=YES
NOTES=ModelFingerprint and a complete ModelReferences component are required for a current reopenable package. modelBindingKey and displayName belong to live bridge context and are not stored on each viewpoint row.

FIELD=revision/lifecycle information
SOURCE_FILE_OR_API=lib/db/src/schema/lens-viewpoints.ts; lens-pull and visual-state APIs
SOURCE_PROPERTY=lifecycle_status, revision_number, mutation_version, supersedes_id, updated_at, created_at
TYPE=string; positive integers; nullable integer; nullable timestamps
AUTHORITATIVE=YES
OPTIONAL=NO for lifecycle/revision/mutation; YES for supersedes/timestamps
CURRENTLY_AVAILABLE=YES
NOTES=The package embeds lifecycle status and revision number and must match the row.

### Camera and view fields

FIELD=camera position
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.Position.{X,Y,Z}
TYPE=three IEEE-754 doubles
AUTHORITATIVE=YES
OPTIONAL=NO for a reopenable package
CURRENTLY_AVAILABLE=YES
NOTES=Captured directly from Autodesk Viewpoint.Position. Values remain in the captured Navisworks/model coordinate basis; no XML conversion is defined here.

FIELD=camera orientation
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.Rotation.{A,B,C,D}
TYPE=four IEEE-754 doubles
AUTHORITATIVE=YES
OPTIONAL=NO for a reopenable package
CURRENTLY_AVAILABLE=YES
NOTES=Captured directly from Autodesk Viewpoint.Rotation. Quaternion ordering/handedness is not remapped in this build.

FIELD=up vector
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.WorldUpVector.{X,Y,Z}
TYPE=three IEEE-754 doubles
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=Captured directly when supplied. Apply preserves it when present.

FIELD=perspective/orthographic state
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.Projection
TYPE=string
AUTHORITATIVE=YES
OPTIONAL=NO for a reopenable package
CURRENTLY_AVAILABLE=YES
NOTES=Captured from Autodesk Viewpoint.Projection.ToString(); no XML token mapping is defined here.

FIELD=focal distance
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.FocalDistance
TYPE=nullable positive double
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=Projection-specific Autodesk values may legitimately be unset and are stored as null.

FIELD=horizontal extent at focal distance
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.HorizontalExtentAtFocalDistance
TYPE=nullable positive double
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=Projection-specific Autodesk values may legitimately be unset.

FIELD=vertical extent at focal distance
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=Camera.VerticalExtentAtFocalDistance
TYPE=nullable positive double
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=Projection-specific Autodesk values may legitimately be unset.

FIELD=field of view
SOURCE_FILE_OR_API=none as a stored field
SOURCE_PROPERTY=none
TYPE=unavailable; potentially derivable numeric angle
AUTHORITATIVE=NO
OPTIONAL=UNKNOWN until target XML schema is fixed
CURRENTLY_AVAILABLE=NO
NOTES=Could be derived only when focal distance and the applicable extent exist and target-schema semantics are proven. No derivation or mapping is authorized in Build 03.

FIELD=zoom
SOURCE_FILE_OR_API=none
SOURCE_PROPERTY=none
TYPE=unavailable
AUTHORITATIVE=NO
OPTIONAL=UNKNOWN until target XML schema is fixed
CURRENTLY_AVAILABLE=NO
NOTES=Must not be guessed from extents without an approved target-schema definition.

FIELD=camera height
SOURCE_FILE_OR_API=none as a named field
SOURCE_PROPERTY=none
TYPE=unavailable; vertical extent is not automatically equivalent
AUTHORITATIVE=NO
OPTIONAL=UNKNOWN until target XML schema is fixed
CURRENTLY_AVAILABLE=NO
NOTES=Must not be inferred or renamed in this build.

FIELD=sectioning/clipping state
SOURCE_FILE_OR_API=validated visual package
SOURCE_PROPERTY=SectioningJson; Completeness.Sectioning
TYPE=nullable opaque JSON string plus structured readiness metadata
AUTHORITATIVE=YES
OPTIONAL=YES
CURRENTLY_AVAILABLE=YES
NOTES=Active sectioning must be complete/supported for a reopenable package. Build 03 does not translate the opaque payload into XML clipping elements.

FIELD=units/model coordinate assumptions
SOURCE_FILE_OR_API=none as viewpoint-package metadata
SOURCE_PROPERTY=none
TYPE=unavailable
AUTHORITATIVE=NO
OPTIONAL=UNKNOWN until target XML schema is fixed
CURRENTLY_AVAILABLE=NO
NOTES=Position, focal distance, and extents are captured as raw Autodesk doubles, but no linear-unit identifier, scale, axis convention, or coordinate-system declaration is stored with the package.

## Classification for future work

### A. Direct authoritative fields

Server ID, viewpoint ID, display/sequence data, project ID, model fingerprint and
model references, lifecycle/revision/mutation data, timestamps, screenshot
reference/evidence, camera position, rotation, world-up vector, projection, focal
distance, horizontal/vertical extents, sectioning payload, package digest, and
component completeness metadata.

### B. Deterministically derivable values

- Export membership: records explicitly selected from the authorized project and
  accepted only when their validated package identity/digest matches.
- Stable record key: `(projectId, serverId, viewpointId, lifecycleStatus,
  revisionNumber)` directly composed without invention.
- Camera direction/basis and horizontal/vertical field angles are mathematically
  derivable from stored rotation/up/focal/extents only after a future build proves
  the target XML conventions. They are candidates, not mappings implemented here.
- A deterministic ordering can be defined from stored sequence/display/capture/ID
  values, but no ordering policy is authoritative today and none is selected here.

### C. Unavailable and forbidden to guess

An authoritative export title, explicit linear units and scale, coordinate-system
or axis declaration, named zoom, named camera height, explicit FOV, and any XML
schema-required clipping/camera field not represented by the validated package.
The requiredness of those values cannot be decided until the target Navisworks XML
schema/version is explicitly fixed and verified.

## Capture-change decision

`CAPTURE_CHANGE_POTENTIALLY_REQUIRED=YES`.

The exact presently missing datum is viewpoint-scoped linear-unit/coordinate-basis
metadata for interpreting position, focal distance, and extents in a generated XML
document. A future schema proof may demonstrate that the target format accepts the
stored Autodesk values without extra metadata; until then the exporter must not
guess units or conversion. Explicit FOV/zoom/camera-height capture may also become
necessary only if the fixed target schema requires one and it cannot be
deterministically derived from the stored values. No capture change is implemented
or authorized by this contract.

