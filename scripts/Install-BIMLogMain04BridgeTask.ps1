param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$TaskName = 'BIMLog MAIN 04 Bridge'
)

$ErrorActionPreference = 'Stop'
$startup = Join-Path $RepositoryRoot 'scripts\Start-BIMLogMain04Bridge.ps1'
if (-not (Test-Path -LiteralPath $startup -PathType Leaf)) { throw "Missing bridge startup script: $startup" }

$powerShell = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startup`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $RepositoryRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Keeps the protected BIMLog MAIN 04.00 FIFO bridge available for authenticated BIMLog questions.' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
