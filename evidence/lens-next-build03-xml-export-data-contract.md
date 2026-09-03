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

## Build 05 membership and ordering checkpoint

The isolated export-input selector accepts only records supplied for one positive,
authoritative BIMLog project ID. Any cross-project record rejects the collection.
Only `active` records are selected, preserving the existing default BIMLog export
and report lifecycle scope; `superseded` and `voided` records remain audit/history
records and are not silently promoted into the current export.

Every selected active record must have a complete positive identity and a validated
package identity matching project ID, server ID, viewpoint ID, lifecycle status,
and revision number. Its record digest and package digest must both be SHA-256 and
must match. An invalid identity or digest rejects the collection rather than being
treated as exportable.

Ordering reuses the current Lens Next issue ordering rule:

1. priority ascending (`1` before `5`, null last);
2. capture timestamp descending (newest first, missing timestamp last);
3. authoritative server viewpoint ID ascending as the unique deterministic tie-break.

Input enumeration/database order is irrelevant. Build 05 emits no `view` node,
name, GUID, camera value, unit, schema attribute, or sectioning value, and it never
consults the Navisworks Saved Viewpoints collection.

## Build 06 export-name checkpoint

There is no dedicated authoritative viewpoint-title column. The minimal export-name
policy therefore uses only existing authoritative BIMLog values:

1. use trimmed `display_id` as the visible identity;
2. when `display_id` is absent, use trimmed authoritative `viewpoint_id`;
3. when stored `note` is non-empty, append ` - ` plus the trimmed note;
4. otherwise emit the identity alone.

The note is the stored BIMLog issue/viewpoint descriptor; no other field is
promoted into a title. Names are written through `XmlWriter`, so XML metacharacters
are escaped without changing their parsed value. Long values are preserved without
randomness or truncation.

The active-project database policy normally makes non-null display IDs unique. If
two selected records nevertheless produce the same complete visible name, append
` [serverId]` to each colliding name, using the authoritative positive server ID.
This is deterministic and changes no BIMLog identifier. Build 06 emits only empty
`view` elements with a `name` attribute. It emits no GUID, viewpoint/camera payload,
units, schema attributes, sectioning, or Saved Viewpoint-derived value.

## Build 07 export-GUID checkpoint

Each exported `view` receives an interoperability-only deterministic UUIDv5. The
UUID namespace is the RFC 4122 URL namespace
`6ba7b811-9dad-11d1-80b4-00c04fd430c8`. The canonical UTF-8 name is:

`bimlog:lens-next:xml-view-guid:v1|project={projectId}|server={serverId}|viewpoint={UTF8-byte-length}:{exact-viewpointId}|revision={revisionNumber}`

Numeric fields use invariant decimal formatting. The authoritative viewpoint ID is
used exactly as stored, without case folding or trimming; its UTF-8 byte length
prevents delimiter ambiguity. UUID construction follows RFC 4122 version 5:
namespace bytes are converted from .NET `Guid` layout to network byte order, the
namespace plus canonical UTF-8 name is SHA-1 hashed, the first 16 bytes are used,
version and RFC variant bits are set, and bytes are converted back to .NET layout.
The standard RFC test vector is part of the focused proof.

The policy is revision-specific because BIMLog's immutable identity includes the
authoritative server row and revision number. A title/display-name change does not
change the GUID. A different project, server row, viewpoint ID, or revision does.
Collision behavior relies on UUIDv5's 122 effective identity bits; no random GUID,
timestamp-only identity, customer constant, Navisworks Saved Viewpoint GUID, or
local Saved Viewpoint state participates.

## Build 08 exchange-metadata and target-schema checkpoint

The proven emitted exchange metadata is deliberately limited to:

- XML declaration version `1.0` with UTF-8 encoding, produced by the isolated writer;
- `exchange@filename="BIMLog"`;
- `exchange@filepath="BIMLog"`;
- the existing product-controlled `viewfolder@name="BIMLog Viewpoints"`.

`filename` and `filepath` identify the BIMLog exporter namespace only. They do not
represent a customer model name, disk path, project, or model identity. No generator
attribute or XML export-version attribute is emitted because the repository does not
prove those attribute names as part of a target Navisworks exchange contract.

`UNITS_PROVEN=NO`. The authoritative visual package stores raw Autodesk doubles but
does not store a linear-unit identifier, scale, or coordinate-basis declaration.
Therefore the exchange root has no `units` attribute. A later units build must prove
the source unit and the exact target-schema unit token/conversion before emitting one.

`TARGET_SCHEMA_PROVEN=NO`. Repository inspection found only:

- `plugins/BIMLogLensNext/native/LensNextDockPanelControl.cs`, which invokes the
  Autodesk `XmlViewpointsExportPlugin` but does not expose a schema URI/version;
- `plugins/BIMLogLensNext/native/tests/AdapterContractTests.cs`, whose fake plugin
  writes only a minimal `<exchange />` document;
- `artifacts/api-server/test-xml.cjs`, an unvalidated parser sample containing only
  the W3C XML Schema-instance namespace and no schema location.

None proves a Navisworks exchange schema URL or version, so no `xmlns:xsi`,
`xsi:noNamespaceSchemaLocation`, `nw-exchange` URI, schema version, units, or scale
is emitted. Build 08 preserves the Build 05 ordering, Build 06 names, Build 07 UUIDs,
and emits no camera or sectioning data.

