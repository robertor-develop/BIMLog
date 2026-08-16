[CmdletBinding()]
param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\..\..\artifacts\lens-next-readonly-packages'),
  [string]$ReceiptPath
)

$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = [IO.Path]::GetFullPath((Join-Path $pluginRoot '..\..'))
$output = [IO.Path]::GetFullPath($OutputRoot)
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'artifacts'))
if (-not $output.StartsWith($allowedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Lens Next packages must remain under this repository artifacts directory.'
}
New-Item -ItemType Directory -Force -Path $output | Out-Null
Add-Type -AssemblyName System.IO.Compression

function Get-Bytes([string]$Path) { [IO.File]::ReadAllBytes($Path) }
function Get-Hash([byte[]]$Bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash($Bytes) | ForEach-Object { $_.ToString('X2') }) } finally { $sha.Dispose() }
}
function Add-Entry($Archive, [string]$Name, [byte[]]$Bytes) {
  $entry = $Archive.CreateEntry($Name, [IO.Compression.CompressionLevel]::Optimal)
  $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
  $stream = $entry.Open()
  try { $stream.Write($Bytes, 0, $Bytes.Length) } finally { $stream.Dispose() }
}

$packages = @()
foreach ($year in @(2021, 2025)) {
  $project = Join-Path $PSScriptRoot "$year\BIMLogLensNext.Native$year.csproj"
  & dotnet build $project -c Release --no-restore
  if ($LASTEXITCODE -ne 0) { throw "Navisworks $year Release build failed." }

  $inputs = [ordered]@{
    'PackageContents.xml' = Join-Path $PSScriptRoot "$year\PackageContents.xml"
    'Contents/BIMLogLensNext.dll' = Join-Path $pluginRoot 'bin\Release\net48\BIMLogLensNext.dll'
    'Contents/BIMLogLensNext.pdb' = Join-Path $pluginRoot 'bin\Release\net48\BIMLogLensNext.pdb'
    "Contents/BIMLogLensNext.Native$year.dll" = Join-Path $PSScriptRoot "$year\bin\Release\net48\BIMLogLensNext.Native$year.dll"
    "Contents/BIMLogLensNext.Native$year.pdb" = Join-Path $PSScriptRoot "$year\bin\Release\net48\BIMLogLensNext.Native$year.pdb"
  }
  $entries = @()
  foreach ($name in $inputs.Keys) {
    $bytes = Get-Bytes $inputs[$name]
    $entries += [ordered]@{ name=$name; bytes=$bytes.Length; sha256=(Get-Hash $bytes) }
  }
  $manifest = [ordered]@{
    schemaVersion = 'bimlog-lens-next-readonly-loadable-package-v1'
    productYear = $year
    mode = 'read_only_exact_guid_navigation'
    dockPluginId = 'BIMLogLensNext.IgniteSmart'
    buttonPluginId = 'BIMLogLensNextButton.IgniteSmart'
    installTargetChosen = $false
    installAuthorized = $false
    phase2Enabled = $false
    legacyIo = $false
    autodeskAssembliesIncluded = $false
    files = $entries
  }
  $manifestBytes = [Text.UTF8Encoding]::new($false).GetBytes(($manifest | ConvertTo-Json -Depth 8) + "`n")
  $zipPath = Join-Path $output "BIMLogLensNext-Navisworks$year-readonly-loadable.zip"
  $fileStream = [IO.File]::Open($zipPath, [IO.FileMode]::Create, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  try {
    $archive = [IO.Compression.ZipArchive]::new($fileStream, [IO.Compression.ZipArchiveMode]::Create, $true)
    try {
      foreach ($name in $inputs.Keys) { Add-Entry $archive $name (Get-Bytes $inputs[$name]) }
      Add-Entry $archive 'manifest.json' $manifestBytes
    } finally { $archive.Dispose() }
  } finally { $fileStream.Dispose() }
  $zipItem = Get-Item -LiteralPath $zipPath
  $packages += [ordered]@{
    productYear = $year
    path = [IO.Path]::GetRelativePath($repoRoot, $zipPath)
    bytes = $zipItem.Length
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash
  }
}

$receipt = [ordered]@{
  schemaVersion = 'bimlog-lens-next-readonly-loadable-packages-v1'
  status = 'LOCAL_LOADABLE_PACKAGES_HELD_NO_INSTALL'
  sourceBaseline = (& git -C $repoRoot rev-parse HEAD).Trim()
  packages = $packages
  boundaries = [ordered]@{ install=$false; installTargetChosen=$false; launch=$false; legacyIo=$false; productionIo=$false; phase2=$false }
}
if ($ReceiptPath) { $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding utf8 }
$receipt | ConvertTo-Json -Depth 8
