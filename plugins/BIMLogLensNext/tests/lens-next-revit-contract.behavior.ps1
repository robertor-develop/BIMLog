$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $root 'src\LensNextRevitNavigationContracts.cs') -Raw
$navigator = Get-Content -LiteralPath (Join-Path $root 'src\LensNextRevitNavigator.cs') -Raw
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
  'LensNextOpenInRevitRequest'
  'LensNextOpenInRevitReceipt'
  'request is expired or exceeds the bounded lifetime'
  'cannot claim success without activating a view and showing the governed point'
)
foreach ($needle in $required) { if (-not $source.Contains($needle)) { throw "Missing Revit contract boundary: $needle" } }
if ($source -match 'fallback transform|assume shared coordinates') { throw 'The Revit navigation contract must not guess coordinate conversion.' }
$navigatorRequired = @('ILensNextRevitHost','EnsureDocumentMatch','ActivateCoordinationView','ShowPoint','SelectElements','ValidateReceipt','"blocked"','"opened"')
foreach ($needle in $navigatorRequired) { if (-not $navigator.Contains($needle)) { throw "Missing Revit navigator boundary: $needle" } }
Write-Output 'Lens Next Revit navigation contract behavior: PASS'
