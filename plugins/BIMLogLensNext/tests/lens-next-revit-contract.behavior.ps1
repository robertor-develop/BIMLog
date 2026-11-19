$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $root 'src\LensNextRevitNavigationContracts.cs') -Raw
$navigator = Get-Content -LiteralPath (Join-Path $root 'src\LensNextRevitNavigator.cs') -Raw
$adapter = Get-Content -LiteralPath (Join-Path $root 'revit\2026\AutodeskRevit2026Host.cs') -Raw
$project = Get-Content -LiteralPath (Join-Path $root 'revit\2026\BIMLogLensNext.Revit2026.csproj') -Raw
$manifest = Get-Content -LiteralPath (Join-Path $root 'revit\2026\BIMLogLensNext.Revit2026.addin') -Raw
$security = Get-Content -LiteralPath (Join-Path $root 'src\LensNextRevitBridgeSecurity.cs') -Raw
$revitBridge = Get-Content -LiteralPath (Join-Path $root 'revit\2026\LensNextRevitBridgeHost.cs') -Raw
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
$adapterRequired = @('Autodesk.Revit.DB','Autodesk.Revit.UI','WorksharingCentralGUID','Document.GetDocumentVersion','ZoomAndCenterRectangle','SetElementIds','ShowElements')
foreach ($needle in $adapterRequired) { if (-not $adapter.Contains($needle)) { throw "Missing official Revit 2026 adapter behavior: $needle" } }
if (-not $project.Contains('net10.0-windows') -or -not $project.Contains('RevitAPI.dll') -or -not $project.Contains('RevitAPIUI.dll') -or -not $project.Contains('will not compile against a fake SDK')) { throw 'Revit 2026.5+ project must hard-gate on the official Autodesk API.' }
if (-not $manifest.Contains('BIMLogLensNext.Revit2026.LensNextRevitApplication') -or -not $manifest.Contains('<UseRevitContext>False</UseRevitContext>')) { throw 'Revit 2026 manifest registration or dependency isolation is missing.' }
$securityRequired = @('explicit BIMLog origin','MaximumSessionMinutes = 30','RandomNumberGenerator.Create','FixedTimeEquals','replayed request identity','MaximumAcceptedRequests')
foreach ($needle in $securityRequired) { if (-not $security.Contains($needle)) { throw "Missing secure Revit bridge behavior: $needle" } }
$bridgeRequired = @('http://127.0.0.1:8876/','ExternalEvent','/v1/session','/v1/model-binding','/v1/open-request','ValidateMutation','revit-2026-binding.json','EnsureDocumentMatch','LensNextRevitNavigator','WaitAsync(TimeSpan.FromSeconds(30))')
foreach ($needle in $bridgeRequired) { if (-not $revitBridge.Contains($needle)) { throw "Missing operational Revit bridge behavior: $needle" } }
Write-Output 'Lens Next Revit navigation contract behavior: PASS'
