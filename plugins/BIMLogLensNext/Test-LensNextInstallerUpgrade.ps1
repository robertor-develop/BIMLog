[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet(2021,2025)][int]$Year,
  [Parameter(Mandatory=$true)][string]$PackageRoot
)
$ErrorActionPreference='Stop'
$package=[IO.Path]::GetFullPath($PackageRoot).TrimEnd('\')
$requiredRoot="H:\BIMLogPlugin$Year"
if(-not $package.StartsWith($requiredRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw "STOP: package must be under $requiredRoot."}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fffffff'
$proofRoot=Join-Path $requiredRoot "installer-upgrade-proof\$stamp"
$loadRoot=Join-Path $proofRoot 'Autodesk-ApplicationPlugins'
$rollbackRoot=Join-Path $proofRoot 'rollback-evidence'
$bundleName="BIMLogLensNext$Year.bundle"
$legacy=Join-Path $loadRoot 'BIMLog.bundle'
$active=Join-Path $loadRoot $bundleName
$staleRollback=Join-Path $loadRoot "$bundleName.rollback-old"
$staleStage=Join-Path $loadRoot "$bundleName.installing-old"
foreach($directory in @($legacy,$active,$staleRollback,$staleStage)){New-Item -ItemType Directory -Force -Path $directory|Out-Null}
[IO.File]::WriteAllText((Join-Path $legacy 'legacy.txt'),'original-lens',[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $active 'active.txt'),'previous-lens-next',[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $staleRollback 'rollback.txt'),'stale-rollback',[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $staleStage 'stage.txt'),'stale-stage',[Text.UTF8Encoding]::new($false))

$installer=Join-Path $package "Install-BIMLogLensNext$Year.ps1"
& $installer -SimulationRoot $loadRoot -RollbackRoot $rollbackRoot
if($LASTEXITCODE){throw 'STOP: first simulated upgrade failed.'}
if(Test-Path -LiteralPath $legacy){throw 'STOP: Original Lens remained after simulated upgrade.'}
if(-not(Test-Path -LiteralPath $active -PathType Container)){throw 'STOP: Lens Next was not installed.'}
if(@(Get-ChildItem -LiteralPath $loadRoot -Directory).Count -ne 1){throw 'STOP: load root contains more than the single intended Lens Next bundle.'}
$receipts=@(Get-ChildItem -LiteralPath $rollbackRoot -Filter rollback-evidence.json -Recurse -File)
if($receipts.Count -ne 1){throw 'STOP: first upgrade did not produce exactly one rollback receipt.'}
$first=Get-Content -LiteralPath $receipts[0].FullName -Raw|ConvertFrom-Json
if($first.preserved.Count -ne 4){throw "STOP: expected four preserved load-root trees, got $($first.preserved.Count)."}

& $installer -SimulationRoot $loadRoot -RollbackRoot $rollbackRoot
if($LASTEXITCODE){throw 'STOP: repeated simulated upgrade failed.'}
if(@(Get-ChildItem -LiteralPath $loadRoot -Directory).Count -ne 1){throw 'STOP: repeated upgrade left more than one loadable bundle.'}
$receipts=@(Get-ChildItem -LiteralPath $rollbackRoot -Filter rollback-evidence.json -Recurse -File)
if($receipts.Count -ne 2){throw 'STOP: repeated upgrade did not preserve independent rollback evidence.'}
[ordered]@{status='PASS';year=$Year;packageRoot=$package;proofRoot=$proofRoot;activeBundle=$active;rollbackReceipts=$receipts.FullName}|ConvertTo-Json -Depth 5
