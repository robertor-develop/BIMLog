$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $root 'src\LensNextRevitNavigationContracts.cs') -Raw
$required = @(
  'lens-next-revit-navigation.v1',
  'LatestSupportedMajorVersion = 2026',
  'NavisworksToRevitTransform.Length != 16',
  'Revit element identities must be positive, unique and bounded',
  'The Revit internal target point must contain three finite coordinates',
  'VisualStateDigest'
  'TransformPoint'
  'EnsureDocumentMatch'
  'invalid homogeneous coordinate'
  'active Revit central model does not match'
)
foreach ($needle in $required) { if (-not $source.Contains($needle)) { throw "Missing Revit contract boundary: $needle" } }
if ($source -match 'fallback transform|assume shared coordinates') { throw 'The Revit navigation contract must not guess coordinate conversion.' }
Write-Output 'Lens Next Revit navigation contract behavior: PASS'
