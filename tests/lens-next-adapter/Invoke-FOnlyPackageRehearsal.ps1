[CmdletBinding()]
param(
  [string]$TempBoundary = 'F:\BIMLog\Temp',
  [string]$PackageRoot = (Join-Path $PSScriptRoot '..\..\artifacts\lens-next-readonly-packages'),
  [string]$ReceiptPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$packageBoundary = [IO.Path]::GetFullPath((Join-Path $repoRoot 'artifacts')).TrimEnd('\')
$packageRootFull = [IO.Path]::GetFullPath($PackageRoot).TrimEnd('\')
if (-not $packageRootFull.StartsWith($packageBoundary + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Rehearsal packages must remain below this repository artifacts boundary.'
}
$packageCursor = $packageRootFull
while ($packageCursor.Length -ge $packageBoundary.Length) {
  if (Test-Path -LiteralPath $packageCursor) {
    $packageItem = Get-Item -LiteralPath $packageCursor -Force
    if (($packageItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Rehearsal package path may not traverse a reparse point: $packageCursor"
    }
  }
  if ($packageCursor.Equals($packageBoundary, [StringComparison]::OrdinalIgnoreCase)) { break }
  $packageCursor = Split-Path -Parent $packageCursor
}
$boundary = [IO.Path]::GetFullPath($TempBoundary).TrimEnd('\')
if (-not $boundary.Equals('F:\BIMLog\Temp', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Rehearsal boundary must be exactly F:\BIMLog\Temp.'
}

function Assert-UnderBoundary([string]$Path) {
  $full = [IO.Path]::GetFullPath($Path)
  if (-not $full.StartsWith($boundary + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escapes the rehearsal boundary: $full"
  }
  $cursor = $full
  while ($cursor.Length -ge $boundary.Length) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Reparse traversal is forbidden: $cursor"
      }
    }
    if ($cursor.Equals($boundary, [StringComparison]::OrdinalIgnoreCase)) { break }
    $cursor = Split-Path -Parent $cursor
  }
  return $full
}

function Hash-Bytes([byte[]]$Bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash($Bytes) | ForEach-Object { $_.ToString('X2') }) } finally { $sha.Dispose() }
}

function Read-Package([string]$ZipPath, [int]$ExpectedYear) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    $entries = @($archive.Entries | Sort-Object FullName)
    $expected = @('Contents/BIMLogLensNext.dll', "Contents/BIMLogLensNext.Native$ExpectedYear.dll", "Contents/BIMLogLensNext.Native$ExpectedYear.pdb", 'Contents/BIMLogLensNext.pdb', 'manifest.json', 'PackageContents.xml') | Sort-Object
    if (($entries.FullName -join '|') -ne ($expected -join '|')) { throw "Unexpected package inventory for $ExpectedYear." }
    foreach ($entry in $entries) {
      if ([IO.Path]::IsPathRooted($entry.FullName) -or $entry.FullName.Contains('..') -or $entry.FullName.Contains('\')) {
        throw "Unsafe ZIP entry: $($entry.FullName)"
      }
    }
    $manifestEntry = $entries | Where-Object FullName -eq 'manifest.json'
    $reader = [IO.StreamReader]::new($manifestEntry.Open())
    try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if ($manifest.productYear -ne $ExpectedYear -or $manifest.installAuthorized -ne $false -or $manifest.phase2Enabled -ne $false -or $manifest.legacyIo -ne $false) {
      throw "Package boundary mismatch for $ExpectedYear."
    }
    $xmlEntry = $entries | Where-Object FullName -eq 'PackageContents.xml'
    $reader = [IO.StreamReader]::new($xmlEntry.Open())
    try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $series = if ($ExpectedYear -eq 2021) { 'Nw18' } else { 'Nw22' }
    if ($xml.ApplicationPackage.Components.RuntimeRequirements.SeriesMin -ne $series -or
        $xml.ApplicationPackage.Components.RuntimeRequirements.SeriesMax -ne $series -or
        $xml.ApplicationPackage.Components.ComponentEntry.ModuleName -ne "./Contents/BIMLogLensNext.Native$ExpectedYear.dll") {
      throw "Year routing mismatch for $ExpectedYear."
    }
    $entryBytes = @{}
    foreach ($entry in $entries) {
      $stream = $entry.Open(); $memory = [IO.MemoryStream]::new()
      try { $stream.CopyTo($memory); $entryBytes[$entry.FullName] = $memory.ToArray() } finally { $memory.Dispose(); $stream.Dispose() }
    }
    foreach ($file in $manifest.files) {
      $bytes = $entryBytes[$file.name]
      if ($null -eq $bytes -or $bytes.Length -ne $file.bytes -or (Hash-Bytes $bytes) -ne $file.sha256) {
        throw "Internal manifest mismatch: $($file.name)"
      }
    }
    return [pscustomobject]@{ Year=$ExpectedYear; Zip=$ZipPath; ZipHash=(Get-FileHash $ZipPath -Algorithm SHA256).Hash; Manifest=$manifest; Xml=$xml; Bytes=$entryBytes; Entries=$entries.FullName }
  } finally { $archive.Dispose() }
}

function Install-Package($Package, [string]$Target, [bool]$AllowOwnedReplacement) {
  $targetRoot = Assert-UnderBoundary $Target
  $foreignNative = if ($Package.Year -eq 2021) { 'BIMLogLensNext.Native2025.dll' } else { 'BIMLogLensNext.Native2021.dll' }
  if (Test-Path -LiteralPath (Join-Path $targetRoot "Contents\$foreignNative")) { throw 'Cross-year collision refused.' }
  New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
  $owned = @()
  foreach ($name in $Package.Entries) {
    $relative = $name.Replace('/', '\')
    $destination = Assert-UnderBoundary (Join-Path $targetRoot $relative)
    if (Test-Path -LiteralPath $destination) {
      $existingHash = (Get-FileHash $destination -Algorithm SHA256).Hash
      $packageHash = Hash-Bytes $Package.Bytes[$name]
      if ($existingHash -ne $packageHash -and -not $AllowOwnedReplacement) { throw "Collision refused: $relative" }
    }
    $parent = Assert-UnderBoundary (Split-Path -Parent $destination)
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    [IO.File]::WriteAllBytes($destination, $Package.Bytes[$name])
    $owned += $relative
  }
  return $owned
}

function Uninstall-Owned([string]$Target, [string[]]$Owned) {
  $targetRoot = Assert-UnderBoundary $Target
  foreach ($relative in $Owned) {
    $path = Assert-UnderBoundary (Join-Path $targetRoot $relative)
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  }
  foreach ($folder in @((Join-Path $targetRoot 'Contents'), $targetRoot)) {
    if ((Test-Path -LiteralPath $folder) -and -not (Get-ChildItem -LiteralPath $folder -Force)) { Remove-Item -LiteralPath $folder -Force }
  }
}

New-Item -ItemType Directory -Force -Path $boundary | Out-Null
$runRoot = Join-Path $boundary ("lens-next-rehearsal-" + [Guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $runRoot) { throw "Collision at run root: $runRoot" }
New-Item -ItemType Directory -Path $runRoot | Out-Null
$runRoot = Assert-UnderBoundary $runRoot
$checks = [Collections.Generic.List[object]]::new()
function Pass([string]$Id, $Detail) { $checks.Add([ordered]@{ id=$Id; passed=$true; detail=$Detail }) }

try {
  try { Assert-UnderBoundary (Join-Path $runRoot '..\..\escape') | Out-Null; throw 'escape accepted' } catch { if ($_.Exception.Message -eq 'escape accepted') { throw }; Pass 'path_escape_refused' $_.Exception.Message }
  $reparseTarget = Join-Path $runRoot 'reparse-target'; $reparse = Join-Path $runRoot 'reparse-link'
  New-Item -ItemType Directory -Path $reparseTarget | Out-Null
  New-Item -ItemType Junction -Path $reparse -Target $reparseTarget | Out-Null
  try { Assert-UnderBoundary (Join-Path $reparse 'file.bin') | Out-Null; throw 'reparse accepted' } catch { if ($_.Exception.Message -eq 'reparse accepted') { throw }; Pass 'reparse_traversal_refused' $_.Exception.Message }
  Remove-Item -LiteralPath $reparse -Force

  foreach ($year in @(2021, 2025)) {
    $zip = Join-Path $packageRootFull "BIMLogLensNext-Navisworks$year-readonly-loadable.zip"
    $package = Read-Package $zip $year
    Pass "package_${year}_routing_inventory_hashes" $package.ZipHash
    $target = Join-Path $runRoot "year-$year\BIMLogLensNext.bundle"
    New-Item -ItemType Directory -Force -Path (Join-Path $target 'Contents') | Out-Null
    $sentinel = Join-Path $target 'unrelated.keep'; [IO.File]::WriteAllText($sentinel, "unrelated-$year")
    $prior = Join-Path $target 'Contents\BIMLogLensNext.dll'; [IO.File]::WriteAllText($prior, "prior-$year")
    $priorBytes = [IO.File]::ReadAllBytes($prior); $priorHash = Hash-Bytes $priorBytes
    try { Install-Package $package $target $false | Out-Null; throw 'collision accepted' } catch { if ($_.Exception.Message -eq 'collision accepted') { throw }; Pass "package_${year}_collision_refused" $_.Exception.Message }
    $owned = Install-Package $package $target $true
    $firstHashes = $owned | ForEach-Object { (Get-FileHash (Join-Path $target $_) -Algorithm SHA256).Hash }
    $ownedAgain = Install-Package $package $target $false
    $secondHashes = $ownedAgain | ForEach-Object { (Get-FileHash (Join-Path $target $_) -Algorithm SHA256).Hash }
    if (($firstHashes -join '|') -ne ($secondHashes -join '|')) { throw "Non-idempotent reinstall for $year." }
    Pass "package_${year}_install_reinstall_idempotent" $firstHashes
    $foreignYear = if ($year -eq 2021) { 2025 } else { 2021 }
    $foreignZip = Join-Path $packageRootFull "BIMLogLensNext-Navisworks$foreignYear-readonly-loadable.zip"
    $foreign = Read-Package $foreignZip $foreignYear
    try { Install-Package $foreign $target $false | Out-Null; throw 'cross-year accepted' } catch { if ($_.Exception.Message -eq 'cross-year accepted') { throw }; Pass "package_${year}_cross_year_refused" $_.Exception.Message }
    [IO.File]::WriteAllBytes($prior, $priorBytes)
    if ((Get-FileHash $prior -Algorithm SHA256).Hash -ne $priorHash) { throw "Rollback mismatch for $year." }
    foreach ($relative in $owned | Where-Object { $_ -ne 'Contents\BIMLogLensNext.dll' }) { $path=Join-Path $target $relative; if(Test-Path $path){Remove-Item -LiteralPath $path -Force} }
    if (-not (Test-Path $sentinel)) { throw "Unrelated file removed during rollback for $year." }
    Pass "package_${year}_rollback_restored" $priorHash
    Remove-Item -LiteralPath $prior -Force
    $owned = Install-Package $package $target $false
    Uninstall-Owned $target $owned
    if (-not (Test-Path $sentinel)) { throw "Unrelated file removed during uninstall for $year." }
    $residualOwned = @($owned | Where-Object { Test-Path (Join-Path $target $_) })
    if ($residualOwned.Count -ne 0) { throw "Owned residuals remain for $year." }
    Pass "package_${year}_uninstall_exact_ownership_no_residuals" 'unrelated.keep preserved'
  }
  $status = 'PASS'
} finally {
  if (Test-Path -LiteralPath $runRoot) {
    $validatedRunRoot = Assert-UnderBoundary $runRoot
    if (-not (Split-Path -Leaf $validatedRunRoot).StartsWith('lens-next-rehearsal-')) { throw 'Cleanup target identity mismatch.' }
    Remove-Item -LiteralPath $validatedRunRoot -Recurse -Force
  }
}

$receipt = [ordered]@{
  schemaVersion='bimlog-lens-next-f-only-install-rehearsal-v1'
  status=$status
  sourceBaseline=(& git -C $repoRoot rev-parse HEAD).Trim()
  tempBoundary=$boundary
  runRootRemoved=(-not (Test-Path -LiteralPath $runRoot))
  checks=$checks
  boundaries=[ordered]@{ cRoot=$false; hRoot=$false; autodesk=$false; appData=$false; legacy=$false; navisworksLaunch=$false; installTargetChosen=$false; production=$false }
}
if ($ReceiptPath) { $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding utf8 }
$receipt | ConvertTo-Json -Depth 8
