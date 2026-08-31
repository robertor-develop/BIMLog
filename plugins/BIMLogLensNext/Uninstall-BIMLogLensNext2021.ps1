[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
if(Get-Process -Name 'roamer' -ErrorAction SilentlyContinue){throw 'STOP: close Navisworks Manage 2021 before uninstalling.'}
$target='C:\ProgramData\Autodesk\ApplicationPlugins\BIMLogLensNext2021.bundle'
if(-not(Test-Path -LiteralPath $target)){Write-Host 'Lens Next 2021 is not installed.';exit 0}
$removed="$target.removed-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Move-Item -LiteralPath $target -Destination $removed
Write-Host "UNINSTALL PASS - recoverable copy: $removed" -ForegroundColor Green
Write-Host 'Original BIMLog Lens bundle was not changed.' -ForegroundColor Green
