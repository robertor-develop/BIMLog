[CmdletBinding()]
param([switch]$PackageOnly)
$ErrorActionPreference='Stop'
$packageRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$manifestPath=Join-Path $packageRoot 'manifest.json'
if(-not(Test-Path -LiteralPath $manifestPath -PathType Leaf)){throw 'STOP: manifest.json is missing.'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
if($manifest.productYear -ne 2025 -or $manifest.release -ne 'v1.05.N09-P04' -or $manifest.binaryVersion -ne '1.5.9.4'){throw 'STOP: wrong product year or release.'}
foreach($file in $manifest.files){
  $path=[IO.Path]::GetFullPath((Join-Path $packageRoot $file.path))
  if(-not $path.StartsWith($packageRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw "STOP: manifest path escaped package: $($file.path)"}
  if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "STOP: package file missing: $($file.path)"}
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256){throw "STOP: hash mismatch: $($file.path)"}
}
Write-Host 'PACKAGE INTEGRITY PASS' -ForegroundColor Green
if($PackageOnly){Write-Host 'PACKAGE-ONLY PASS - INSTALL_PERFORMED=false' -ForegroundColor Green;exit 0}
if(Get-Process -Name 'roamer' -ErrorAction SilentlyContinue){throw 'STOP: close Navisworks Manage 2025 before installation.'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=[Security.Principal.WindowsPrincipal]::new($identity)
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'))
  $process=Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  exit $process.ExitCode
}
$source=Join-Path $packageRoot 'BIMLogLensNext2025.bundle'
$installRoot='C:\ProgramData\Autodesk\ApplicationPlugins'
$target=Join-Path $installRoot 'BIMLogLensNext2025.bundle'
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$rollback="$target.rollback-$stamp"
$stage="$target.installing-$stamp"
New-Item -ItemType Directory -Force -Path $installRoot|Out-Null
try{
  Copy-Item -LiteralPath $source -Destination $stage -Recurse -Force
  foreach($sourceFile in (Get-ChildItem -LiteralPath $source -Recurse -File)){
    $relative=$sourceFile.FullName.Substring($source.Length).TrimStart('\')
    $stagedFile=Join-Path $stage $relative
    if((Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $stagedFile -Algorithm SHA256).Hash){throw "STOP: staged copy hash mismatch: $relative"}
  }
  if(Test-Path -LiteralPath $target){Move-Item -LiteralPath $target -Destination $rollback}
  Move-Item -LiteralPath $stage -Destination $target
  $installedManifest=Join-Path $target 'PackageContents.xml'
  $installedNative=Join-Path $target 'Contents\BIMLogLensNext.Native2025.dll'
  if(-not(Test-Path -LiteralPath $installedManifest -PathType Leaf)){throw 'STOP: installed PackageContents.xml is missing.'}
  if(-not(Test-Path -LiteralPath $installedNative -PathType Leaf)){throw 'STOP: installed native plugin DLL is missing.'}
  $installedXml=[xml](Get-Content -LiteralPath $installedManifest -Raw)
  $installedComponent=$installedXml.ApplicationPackage.Components.ComponentEntry
  $installedRequirements=$installedXml.ApplicationPackage.Components.RuntimeRequirements
  if($installedComponent.AppType -ne 'ManagedPlugin'){throw 'STOP: installed package is not declared as an Autodesk managed plugin.'}
  if($installedComponent.ModuleName -ne './Contents/BIMLogLensNext.Native2025.dll'){throw 'STOP: installed package points to the wrong native module.'}
  if($installedRequirements.Platform -ne 'NAVMAN' -or $installedRequirements.SeriesMin -ne 'Nw22' -or $installedRequirements.SeriesMax -ne 'Nw22'){throw 'STOP: installed package does not target Navisworks Manage 2025 exactly.'}
  Write-Host "INSTALL PASS: $target" -ForegroundColor Green
  if(Test-Path -LiteralPath $rollback){Write-Host "Previous Lens Next preserved: $rollback"}
  Write-Host 'Original BIMLog Lens bundle was not changed.' -ForegroundColor Green
}catch{
  if(Test-Path -LiteralPath $stage){Move-Item -LiteralPath $stage -Destination "$stage.failed" -ErrorAction SilentlyContinue}
  if(-not(Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $rollback)){Move-Item -LiteralPath $rollback -Destination $target}
  throw
}
