[CmdletBinding()]
param([string]$Version)
$ErrorActionPreference='Stop'
$releaseIdentity=Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\..\contracts\release-identity.json') -Raw|ConvertFrom-Json
if(-not $Version){$Version=$releaseIdentity.label}
if($Version -ne $releaseIdentity.label){throw 'STOP: stale or unexpected release requested.'}
& (Join-Path $PSScriptRoot 'Build-Package-LensNext2021.ps1') -Version $Version
if($LASTEXITCODE){throw '2021 package build failed.'}
& (Join-Path $PSScriptRoot 'Build-Package-LensNext2025.ps1') -Version $Version
if($LASTEXITCODE){throw '2025 package build failed.'}
Write-Host 'BIMLog Lens Next 2021+2025 shared-source package build PASS.' -ForegroundColor Green
