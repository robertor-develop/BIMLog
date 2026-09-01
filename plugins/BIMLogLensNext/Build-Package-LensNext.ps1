[CmdletBinding()]
param([string]$Version='v1.05.N07-P02')
$ErrorActionPreference='Stop'
if($Version -ne 'v1.05.N07-P02'){throw 'STOP: stale or unexpected release requested.'}
& (Join-Path $PSScriptRoot 'Build-Package-LensNext2021.ps1') -Version $Version
if($LASTEXITCODE){throw '2021 package build failed.'}
& (Join-Path $PSScriptRoot 'Build-Package-LensNext2025.ps1') -Version $Version
if($LASTEXITCODE){throw '2025 package build failed.'}
Write-Host 'BIMLog Lens Next 2021+2025 shared-source package build PASS.' -ForegroundColor Green
