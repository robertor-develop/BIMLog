[CmdletBinding()]
param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\..\..\artifacts\lens-next-sandbox-packages'),
  [string]$ReceiptPath
)

$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $pluginRoot '..\..')
$output = [IO.Path]::GetFullPath($OutputRoot)
if (-not $output.StartsWith((Join-Path $repoRoot 'artifacts'), [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Sandbox packages must remain under this repository artifacts directory.'
}

$packages = @()
foreach ($year in @(2021, 2025)) {
  $project = Join-Path $PSScriptRoot "$year\BIMLogLensNext.Native$year.csproj"
  & dotnet build $project -c Release --no-restore
  if ($LASTEXITCODE -ne 0) { throw "Navisworks $year adapter build failed." }

  $staging = Join-Path $output "staging-$year"
  $zip = Join-Path $output "BIMLogLensNext-Navisworks$year-readonly-sandbox.zip"
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  foreach ($name in @('BIMLogLensNext.dll','BIMLogLensNext.pdb')) {
    Copy-Item -LiteralPath (Join-Path $pluginRoot "bin\Release\net48\$name") -Destination $staging -Force
  }
  foreach ($name in @("BIMLogLensNext.Native$year.dll","BIMLogLensNext.Native$year.pdb")) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "$year\bin\Release\net48\$name") -Destination $staging -Force
  }
  $manifest = [ordered]@{
    schemaVersion = 'bimlog-lens-next-readonly-sandbox-package-v1'
    productYear = $year
    mode = 'read_only_exact_guid_navigation'
    installAuthorized = $false
    phase2Enabled = $false
    autodeskAssembliesIncluded = $false
    files = @(Get-ChildItem -LiteralPath $staging -File | Sort-Object Name | ForEach-Object {
      [ordered]@{ name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash }
    })
  }
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $staging 'manifest.json') -Encoding utf8
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -Force
  $zipItem = Get-Item -LiteralPath $zip
  $packages += [ordered]@{ productYear=$year; path=[IO.Path]::GetRelativePath($repoRoot,$zip); bytes=$zipItem.Length; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash }
}

$receipt = [ordered]@{
  schemaVersion = 'bimlog-lens-next-readonly-adapter-sandbox-v1'
  status = 'LOCAL_SANDBOX_PACKAGES_HELD_NO_INSTALL'
  sourceBaseline = (& git -C $repoRoot rev-parse HEAD).Trim()
  packages = $packages
  boundaries = [ordered]@{ install=$false; deploy=$false; legacyIo=$false; customerData=$false; phase2=$false; autodeskRuntime=$false }
}
if ($ReceiptPath) {
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding utf8
}
$receipt | ConvertTo-Json -Depth 8
