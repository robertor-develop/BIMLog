[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
if(Get-Process -Name 'roamer' -ErrorAction SilentlyContinue){throw 'STOP: close Navisworks Manage 2025 before uninstalling.'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=[Security.Principal.WindowsPrincipal]::new($identity)
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'))
  $process=Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  exit $process.ExitCode
}
$target='C:\ProgramData\Autodesk\ApplicationPlugins\BIMLogLensNext2025.bundle'
if(-not(Test-Path -LiteralPath $target)){Write-Host 'Lens Next 2025 is not installed.';exit 0}
$removed="$target.removed-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Move-Item -LiteralPath $target -Destination $removed
Write-Host "UNINSTALL PASS - recoverable copy: $removed" -ForegroundColor Green
Write-Host 'Original BIMLog Lens bundle was not changed.' -ForegroundColor Green
