$ErrorActionPreference='Stop'
$target=Join-Path $env:LOCALAPPDATA 'BIMLog\LensNext\Revit2026';$manifest=Join-Path $env:APPDATA 'Autodesk\Revit\Addins\2026\BIMLogLensNext.Revit2026.addin'
if(Test-Path -LiteralPath $manifest){Remove-Item -LiteralPath $manifest -Force};if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force}
Write-Output 'Uninstalled BIMLog Lens for Revit 2026.5+ (.NET 10). Restart Revit to complete removal.'
