[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet(2021,2025)][int]$Year,
  [switch]$PackageOnly,
  [string]$SimulationRoot,
  [string]$RollbackRoot
)
$ErrorActionPreference='Stop'
$packageRoot=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$manifestPath=Join-Path $packageRoot 'manifest.json'
if(-not(Test-Path -LiteralPath $manifestPath -PathType Leaf)){throw 'STOP: manifest.json is missing.'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
if($manifest.productYear -ne $Year -or $manifest.release -ne 'v1.05.N18-P35' -or $manifest.binaryVersion -ne '1.5.18.35'){throw 'STOP: wrong product year or release.'}
foreach($file in $manifest.files){
  $path=[IO.Path]::GetFullPath((Join-Path $packageRoot $file.path))
  if(-not $path.StartsWith($packageRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw "STOP: manifest path escaped package: $($file.path)"}
  if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "STOP: package file missing: $($file.path)"}
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256){throw "STOP: hash mismatch: $($file.path)"}
}
Write-Host 'PACKAGE INTEGRITY PASS' -ForegroundColor Green
if($PackageOnly){Write-Host 'PACKAGE-ONLY PASS - INSTALL_PERFORMED=false' -ForegroundColor Green;exit 0}

$bundleName="BIMLogLensNext$Year.bundle"
$source=Join-Path $packageRoot $bundleName
if(-not(Test-Path -LiteralPath $source -PathType Container)){throw "STOP: packaged bundle is missing: $bundleName"}
$isSimulation=-not [string]::IsNullOrWhiteSpace($SimulationRoot)
if($isSimulation){
  $installRoot=[IO.Path]::GetFullPath($SimulationRoot).TrimEnd('\')
}else{
  if(Get-Process -Name 'roamer' -ErrorAction SilentlyContinue){throw "STOP: close Navisworks Manage $Year before installation."}
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $principal=[Security.Principal.WindowsPrincipal]::new($identity)
  if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'STOP: the verified Autodesk load-root cutover requires an Administrator PowerShell.'}
  $installRoot='C:\ProgramData\Autodesk\ApplicationPlugins'
}
if([string]::IsNullOrWhiteSpace($RollbackRoot)){$RollbackRoot=Join-Path $packageRoot "rollback-evidence\$Year"}
$rollbackBase=[IO.Path]::GetFullPath($RollbackRoot).TrimEnd('\')
if($rollbackBase.Equals($installRoot,[StringComparison]::OrdinalIgnoreCase) -or $rollbackBase.StartsWith($installRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'STOP: rollback evidence must remain outside the Autodesk load root.'}

function Get-TreeReceipt([string]$Root){
  @((Get-ChildItem -LiteralPath $Root -Recurse -File|Sort-Object FullName|ForEach-Object{
    [ordered]@{path=$_.FullName.Substring($Root.Length).TrimStart('\').Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
  }))
}
function Assert-MatchingTrees([string]$Expected,[string]$Actual){
  $left=(Get-TreeReceipt $Expected)|ConvertTo-Json -Depth 5 -Compress
  $right=(Get-TreeReceipt $Actual)|ConvertTo-Json -Depth 5 -Compress
  if($left -ne $right){throw "STOP: preserved tree does not match source: $Expected"}
}

New-Item -ItemType Directory -Force -Path $installRoot,$rollbackBase|Out-Null
$target=Join-Path $installRoot $bundleName
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fffffff'
$evidenceRoot=Join-Path $rollbackBase $stamp
$stage=Join-Path $installRoot "$bundleName.installing-$stamp"
$candidates=@()
foreach($path in @($target,(Join-Path $installRoot 'BIMLog.bundle'))){if(Test-Path -LiteralPath $path -PathType Container){$candidates+=[IO.Path]::GetFullPath($path)}}
foreach($pattern in @("$bundleName.rollback-*","$bundleName.installing-*")){
  $candidates+=@(Get-ChildItem -LiteralPath $installRoot -Directory -Filter $pattern -ErrorAction SilentlyContinue|ForEach-Object FullName)
}
$candidates=@($candidates|Sort-Object -Unique)
$preserved=@()
try{
  New-Item -ItemType Directory -Force -Path $evidenceRoot|Out-Null
  foreach($candidate in $candidates){
    $destination=Join-Path $evidenceRoot (Split-Path -Leaf $candidate)
    Copy-Item -LiteralPath $candidate -Destination $destination -Recurse -Force
    Assert-MatchingTrees $candidate $destination
    $preserved+=[ordered]@{source=$candidate;evidence=$destination;files=(Get-TreeReceipt $destination)}
  }
  $receipt=[ordered]@{schemaVersion='bimlog-lens-next-upgrade-evidence-v1';year=$Year;release=$manifest.release;createdAtUtc=[DateTime]::UtcNow.ToString('o');simulation=$isSimulation;installRoot=$installRoot;preserved=$preserved}
  [IO.File]::WriteAllText((Join-Path $evidenceRoot 'rollback-evidence.json'),($receipt|ConvertTo-Json -Depth 10)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))

  Copy-Item -LiteralPath $source -Destination $stage -Recurse -Force
  Assert-MatchingTrees $source $stage
  foreach($candidate in $candidates){Remove-Item -LiteralPath $candidate -Recurse -Force}
  Move-Item -LiteralPath $stage -Destination $target

  $installedManifest=Join-Path $target 'PackageContents.xml'
  $installedNative=Join-Path $target "Contents\BIMLogLensNext.Native$Year.dll"
  if(-not(Test-Path -LiteralPath $installedManifest -PathType Leaf)){throw 'STOP: installed PackageContents.xml is missing.'}
  if(-not(Test-Path -LiteralPath $installedNative -PathType Leaf)){throw 'STOP: installed native plugin DLL is missing.'}
  $installedXml=[xml](Get-Content -LiteralPath $installedManifest -Raw)
  $component=$installedXml.ApplicationPackage.Components.ComponentEntry
  $requirements=$installedXml.ApplicationPackage.Components.RuntimeRequirements
  $expectedModule="./Contents/BIMLogLensNext.Native$Year.dll"
  $expectedSeries=if($Year -eq 2021){'Nw18'}else{'Nw22'}
  if($component.AppType -ne 'ManagedPlugin' -or $component.ModuleName -ne $expectedModule){throw 'STOP: installed package points to the wrong native module.'}
  if($requirements.Platform -ne 'NAVMAN' -or $requirements.SeriesMin -ne $expectedSeries -or $requirements.SeriesMax -ne $expectedSeries){throw "STOP: installed package does not target Navisworks Manage $Year exactly."}
  if(Test-Path -LiteralPath (Join-Path $installRoot 'BIMLog.bundle')){throw 'STOP: Original Lens remains in the Autodesk load root.'}
  $stale=@(Get-ChildItem -LiteralPath $installRoot -Directory -Filter "$bundleName*"|Where-Object Name -ne $bundleName)
  if($stale.Count){throw 'STOP: a stale Lens Next manifest-bearing directory remains in the Autodesk load root.'}
  Write-Host "INSTALL PASS: $target" -ForegroundColor Green
  Write-Host "ROLLBACK EVIDENCE PASS: $evidenceRoot" -ForegroundColor Green
}catch{
  if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue}
  if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue}
  foreach($entry in $preserved){if(Test-Path -LiteralPath $entry.evidence){Copy-Item -LiteralPath $entry.evidence -Destination $entry.source -Recurse -Force}}
  throw
}
