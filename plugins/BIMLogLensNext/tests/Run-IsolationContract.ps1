[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$projectPath = Join-Path $pluginRoot 'BIMLogLensNext.csproj'
$installPath = Join-Path $pluginRoot 'install\Install-BIMLogLensNext.contract.json'
$uninstallPath = Join-Path $pluginRoot 'install\Uninstall-BIMLogLensNext.contract.json'
$configSchemaPath = Join-Path $pluginRoot 'config\lens-next.config.schema.json'
$metadataPath = Join-Path $pluginRoot 'contracts\metadata.contract.json'
$registrationPath = Join-Path $pluginRoot 'contracts\plugin-registration.contract.json'

$project = [xml](Get-Content -Raw -LiteralPath $projectPath)
$properties = $project.Project.PropertyGroup
if ($properties.TargetFramework -ne 'net48') { throw 'TargetFramework must be net48.' }
if ($properties.PlatformTarget -ne 'AnyCPU') { throw 'PlatformTarget must be AnyCPU.' }
if ($properties.AssemblyName -ne 'BIMLogLensNext') { throw 'AssemblyName mismatch.' }
if ($properties.RootNamespace -ne 'BIMLogLensNext') { throw 'RootNamespace mismatch.' }

$install = Get-Content -Raw -LiteralPath $installPath | ConvertFrom-Json
$uninstall = Get-Content -Raw -LiteralPath $uninstallPath | ConvertFrom-Json
$configSchema = Get-Content -Raw -LiteralPath $configSchemaPath | ConvertFrom-Json
$metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
$registration = Get-Content -Raw -LiteralPath $registrationPath | ConvertFrom-Json
if ($install.status -ne 'contract_only_no_install_action') { throw 'Install contract must remain non-executable.' }
if ($uninstall.status -ne 'contract_only_no_uninstall_action') { throw 'Uninstall contract must remain non-executable.' }
if ($install.installationFolderLeaf -ne 'BIMLogLensNext') { throw 'Install scope mismatch.' }
if ($uninstall.installationFolderLeaf -ne 'BIMLogLensNext') { throw 'Uninstall scope mismatch.' }
if ($install.migrationOnInstall -or $install.savedViewpointProcessingOnInstall) { throw 'Install must not migrate or scan SavedViewpoints.' }
if ($configSchema.properties.bridge.properties.origin.const -ne 'http://127.0.0.1:8766') { throw 'Config bridge origin mismatch.' }
$enabledFlags = @($configSchema.properties.featureFlags.properties.PSObject.Properties |
  Where-Object { $_.Value.const -ne $false })
if ($enabledFlags.Count -ne 0) { throw 'Every Phase 1 write feature flag must be false.' }
if ($metadata.metadataNamespace -ne 'bimlog.lens_next.v1' -or $metadata.phase1.writeMetadata) { throw 'Metadata contract mismatch.' }
if ($metadata.phase1.scanSavedViewpoints -or $metadata.phase1.migrateLegacyMetadata) { throw 'Metadata contract crosses isolation boundary.' }
if ($registration.dockPluginId -ne 'BIMLogLensNext.IgniteSmart' -or
    $registration.buttonPluginId -ne 'BIMLogLensNextButton.IgniteSmart') { throw 'Plugin registration mismatch.' }

$allFiles = @(Get-ChildItem -LiteralPath $pluginRoot -Recurse -File)
$outside = @($allFiles | Where-Object { -not $_.FullName.StartsWith($pluginRoot, [StringComparison]::OrdinalIgnoreCase) })
if ($outside.Count -ne 0) { throw 'Owned tree containment failed.' }

$sourceText = (Get-ChildItem -LiteralPath (Join-Path $pluginRoot 'src') -File -Filter '*.cs' |
  ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName }) -join "`n"
$required = @(
  'BIMLogLensNext.IgniteSmart',
  'BIMLogLensNextButton.IgniteSmart',
  'http://127.0.0.1:8766',
  'bimlog.lens_next.v1',
  'bimlog.lens_next.published.v1',
  'lens_next.platform_metadata_writes',
  'open-working-view',
  'fallback_resolver_forbidden'
)
foreach ($value in $required) {
  if (-not $sourceText.Contains($value)) { throw "Required contract value missing: $value" }
}

$forbiddenProductionReferences = @(
  'Autodesk.Navisworks.Api.dll',
  '<Reference Include="BIMLogNavisPlugin"',
  '<ProjectReference Include="..\BIMLogNavisPlugin',
  'http://localhost:8765'
)
$projectAndSource = (Get-Content -Raw -LiteralPath $projectPath) + "`n" + $sourceText
foreach ($value in $forbiddenProductionReferences) {
  if ($projectAndSource.Contains($value)) { throw "Legacy/native reference forbidden in Phase 1 foundation: $value" }
}

[pscustomobject]@{
  status = 'PASS'
  files = $allFiles.Count
  targetFramework = $properties.TargetFramework
  platform = $properties.PlatformTarget
  assembly = $properties.AssemblyName
  installExecutable = $false
  legacyReferenceCount = 0
  savedViewpointInstallMutation = $false
} | ConvertTo-Json -Depth 4
