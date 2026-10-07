param([string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
$taskName = 'BIMLog MAIN 04 Local Bridge'
$launcher = Join-Path $RepositoryRoot 'scripts\Start-BIMLogMain04Bridge.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" -RepositoryRoot `"$RepositoryRoot`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 3650) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'BIMLog-owned loopback bridge to the pinned Dedicated Agent MAIN 04 task.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output "Installed and started: $taskName"
