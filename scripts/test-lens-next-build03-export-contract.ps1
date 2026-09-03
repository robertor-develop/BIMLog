[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Require-Match([string]$Text, [string]$Pattern, [string]$Proof) {
    if ($Text -notmatch $Pattern) { throw "BUILD03 contract proof failed: $Proof" }
    Write-Host "PASS $Proof"
}

$schema = Get-Content -LiteralPath (Join-Path $root "lib/db/src/schema/lens-viewpoints.ts") -Raw
$route = Get-Content -LiteralPath (Join-Path $root "artifacts/api-server/src/routes/clash_reports.ts") -Raw
$visual = Get-Content -LiteralPath (Join-Path $root "plugins/BIMLogLensNext/src/LensNextVisualStateContracts.cs") -Raw
$adapter = Get-Content -LiteralPath (Join-Path $root "plugins/BIMLogLensNext/native/AutodeskVisualStateAdapter.cs") -Raw
$spec = Get-Content -LiteralPath (Join-Path $root "evidence/lens-next-build03-xml-export-data-contract.md") -Raw

Require-Match $schema 'pgTable\("lens_viewpoints"' "authoritative_record_table"
foreach ($field in @("projectId", "viewpointId", "displayId", "screenshotUrl", "visualStateJson", "visualStateDigest", "tradeFloorSeq", "lifecycleStatus", "revisionNumber", "mutationVersion")) {
    Require-Match $schema ("\b" + [regex]::Escape($field) + ":") ("record_field_" + $field)
}
Require-Match $route 'router\.get\("/projects/:projectId/clash-reports/lens-pull"' "record_inventory_api"
Require-Match $route 'router\.get\("/projects/:projectId/clash-reports/lens-viewpoints/:viewpointId/visual-state"' "validated_visual_state_api"
Require-Match $route 'validatePersistedLensNextVisualState\(row\.visualStateJson, row\.visualStateDigest' "visual_state_digest_and_identity_validation"

foreach ($field in @("ProjectId", "ServerId", "ViewpointId", "LifecycleStatus", "RevisionNumber", "ModelFingerprint", "CapturedAt", "Camera", "SectioningJson", "ScreenshotDataUrl", "ScreenshotSha256", "Completeness", "DigestSha256")) {
    Require-Match $visual ("public .*\b" + [regex]::Escape($field) + " \{ get; set; \}") ("visual_state_field_" + $field)
}
foreach ($field in @("Position", "Rotation", "WorldUpVector", "Projection", "FocalDistance", "HorizontalExtentAtFocalDistance", "VerticalExtentAtFocalDistance")) {
    Require-Match $visual ("public .*\b" + [regex]::Escape($field) + " \{ get; set; \}") ("camera_field_" + $field)
}
Require-Match $adapter 'Position = Point\(view\.Position\), Rotation = Rotation\(view\.Rotation\), WorldUpVector = Point\(view\.WorldUpVector\)' "camera_direct_capture"
Require-Match $adapter 'Projection = view\.Projection\.ToString\(\)' "projection_direct_capture"
Require-Match $spec 'sole future export source is the authoritative BIMLog' "bimlog_only_export_source"
Require-Match $spec 'Navisworks Saved Viewpoints collection is not an export source' "saved_viewpoints_excluded"
Require-Match $spec 'creates no XML' "no_xml_generation"
Require-Match $spec 'converts no camera value' "no_camera_mapping"
Require-Match $spec 'CAPTURE_CHANGE_POTENTIALLY_REQUIRED=YES' "missing_units_gap_recorded"

Write-Host "BUILD03_EXPORT_DATA_CONTRACT=PASS"
