[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$PackageRoot2021,
  [Parameter(Mandatory=$true)][string]$PackageRoot2025,
  [string]$Model2021='C:\Users\soporte\Desktop\1185 RIVER AV MODEL-06-11-26.nwd',
  [string]$Model2025=''
)
$ErrorActionPreference='Stop'
$release='v1.05.N18-P36'
$binaryVersion='1.5.18.36'
$loadRoot='C:\ProgramData\Autodesk\ApplicationPlugins'
$results=@()
foreach($year in @(2021,2025)){
  $packageRoot=[IO.Path]::GetFullPath((Get-Variable -Name "PackageRoot$year" -ValueOnly)).TrimEnd('\')
  $model=(Get-Variable -Name "Model$year" -ValueOnly)
  $zip=Join-Path $packageRoot "BIMLog-Lens-Next-Navisworks$year-$release.zip"
  $sidecar="$zip.sha256"
  $application="C:\Program Files\Autodesk\Navisworks Manage $year\Roamer.exe"
  $bundleName="BIMLogLensNext$year.bundle"
  $bundle=Join-Path $loadRoot $bundleName
  $native=Join-Path $bundle "Contents\BIMLogLensNext.Native$year.dll"
  $expectedHash=if(Test-Path -LiteralPath $sidecar -PathType Leaf){((Get-Content -LiteralPath $sidecar -Raw).Trim()-split '\s+')[0]}else{''}
  $actualHash=if(Test-Path -LiteralPath $zip -PathType Leaf){(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash}else{''}
  $stale=@(Get-ChildItem -LiteralPath $loadRoot -Directory -Filter "BIMLogLensNext$year.bundle.*" -ErrorAction SilentlyContinue|Where-Object{$_.Name -ne $bundleName})
  $result=[ordered]@{
    year=$year
    packageRoot=$packageRoot
    packageHashPass=($expectedHash -and $expectedHash -eq $actualHash)
    zipSha256=$actualHash
    navisworksInstalled=(Test-Path -LiteralPath $application -PathType Leaf)
    modelPath=$model
    controlledModelAvailable=(-not [string]::IsNullOrWhiteSpace($model) -and (Test-Path -LiteralPath $model -PathType Leaf))
    lensNextInstalled=(Test-Path -LiteralPath $bundle -PathType Container)
    nativeVersion=if(Test-Path -LiteralPath $native -PathType Leaf){(Get-Item -LiteralPath $native).VersionInfo.FileVersion}else{''}
    nativeVersionPass=(Test-Path -LiteralPath $native -PathType Leaf) -and ((Get-Item -LiteralPath $native).VersionInfo.FileVersion -eq $binaryVersion)
    staleLensNextLoaders=$stale.FullName
  }
  $result.readyForRealFieldAcceptance=$result.packageHashPass -and $result.navisworksInstalled -and $result.controlledModelAvailable -and $result.lensNextInstalled -and $result.nativeVersionPass -and $stale.Count -eq 0
  $results+=$result
}
$legacyBundle=Join-Path $loadRoot 'BIMLog.bundle'
$receipt=[ordered]@{
  schemaVersion='bimlog-lens-next-field-readiness-v1'
  release=$release
  checkedAtUtc=[DateTime]::UtcNow.ToString('o')
  legacyLensLoadable=(Test-Path -LiteralPath $legacyBundle -PathType Container)
  years=$results
  ready=((-not(Test-Path -LiteralPath $legacyBundle -PathType Container)) -and @($results|Where-Object{-not $_.readyForRealFieldAcceptance}).Count -eq 0)
}
$receipt|ConvertTo-Json -Depth 8
if(-not $receipt.ready){exit 1}
