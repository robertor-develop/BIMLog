param(
    [string]$ModelPath = 'F:\BIMLog\Worktrees\bimlog-lens-next-build25e-manual-range-proof-20260905\evidence\helpers\build25e-range-proof\controlled-range-box.nwd',
    [string]$EvidencePath = 'F:\BIMLog\Evidence\lens-next-build25-xml-import-accepted-20260905\build26-camera-api-roundtrip.txt'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
dotnet build (Join-Path $root 'Build26ACameraProbe.csproj') -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Add-Type -Path 'C:\Program Files\Autodesk\Navisworks Manage 2021\Autodesk.Navisworks.Automation.dll'
$application = New-Object Autodesk.Navisworks.Api.Automation.NavisworksApplication
try {
    $application.DisableProgress()
    $application.OpenFile([IO.Path]::GetFullPath($ModelPath))
    $application.AddPluginAssembly((Join-Path $root 'bin\Release\net48\Build26ACameraProbe.dll'))
    $status = $application.ExecuteAddInPlugin('Build26AInternalCameraRoundtrip.BIMLog', @([IO.Path]::GetFullPath($EvidencePath)))
    if ($status -ne 0) { throw "Internal camera roundtrip returned $status." }
}
finally { $application.Dispose() }
Get-Content -LiteralPath $EvidencePath -Raw
