[CmdletBinding()]
param()
$ErrorActionPreference = 'Continue'
$desktop = [Environment]::GetFolderPath('Desktop')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$report = Join-Path $desktop "BIMLog-Lens-Next-Failure-$stamp.txt"
$bundle = 'C:\ProgramData\Autodesk\ApplicationPlugins\BIMLogLensNext2025.bundle'
$nativeLog = Join-Path $env:LOCALAPPDATA 'BIMLog\LensNext\logs\lens-next-native.log'
function Add-Line([string]$Text) { $Text | Out-File -LiteralPath $report -Append -Encoding utf8 }
function Add-Section([string]$Title) { Add-Line "`r`n===== $Title =====" }
"BIMLog Lens Next actionable failure report" | Out-File -LiteralPath $report -Encoding utf8
Add-Line "Generated: $(Get-Date -Format o)"
Add-Line "Computer: $env:COMPUTERNAME"
Add-Line "User: $env:USERNAME"
Add-Section 'Installed native plugin identity'
$nativeDll = Join-Path $bundle 'Contents\BIMLogLensNext.Native2025.dll'
foreach ($path in @((Join-Path $bundle 'PackageContents.xml'), $nativeDll, (Join-Path $bundle 'Contents\BIMLogLensNext.dll'))) {
  if (Test-Path -LiteralPath $path) {
    $item = Get-Item -LiteralPath $path
    Add-Line "Path=$path"
    Add-Line "Bytes=$($item.Length)"
    Add-Line "FileVersion=$($item.VersionInfo.FileVersion)"
    Add-Line "SHA256=$((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash)"
  } else { Add-Line "MISSING=$path" }
}
Add-Section 'Navisworks process and loaded BIMLog modules'
$processes = @(Get-Process -Name roamer -ErrorAction SilentlyContinue)
if ($processes.Count -eq 0) { Add-Line 'NAVISWORKS_NOT_RUNNING' }
foreach ($process in $processes) {
  Add-Line "ProcessId=$($process.Id) StartTime=$($process.StartTime.ToString('o'))"
  try {
    $process.Modules | Where-Object { $_.FileName -match 'BIMLog|Navisworks.Interop.ComApi' } | ForEach-Object {
      Add-Line "LoadedModule=$($_.FileName) Version=$($_.FileVersionInfo.FileVersion)"
    }
  } catch { Add-Line "ModuleInventoryError=$($_.Exception.GetType().FullName): $($_.Exception.Message)" }
}
Add-Section 'Complete Lens Next native runtime log'
if (Test-Path -LiteralPath $nativeLog) { Get-Content -LiteralPath $nativeLog | Out-File -LiteralPath $report -Append -Encoding utf8 }
else { Add-Line "MISSING=$nativeLog" }
Add-Section 'Recent application and .NET failures'
$since = (Get-Date).AddHours(-8)
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since} -ErrorAction SilentlyContinue |
  Where-Object { $_.ProviderName -match 'Application Error|\.NET Runtime' -and $_.Message -match 'BIMLog|Navisworks|roamer' } |
  Select-Object TimeCreated,ProviderName,Id,LevelDisplayName,Message |
  Format-List | Out-File -LiteralPath $report -Append -Encoding utf8
Add-Section 'End marker'
Add-Line 'END OF BIMLOG LENS NEXT FAILURE REPORT'
Write-Host "DIAGNOSTIC LOG CREATED: $report" -ForegroundColor Green
