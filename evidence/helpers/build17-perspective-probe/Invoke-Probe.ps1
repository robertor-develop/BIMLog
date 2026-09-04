param([Parameter(Mandatory = $true)][string]$OutputDirectory)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
dotnet build (Join-Path $root "Build17PerspectiveProbe.csproj") -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Add-Type -Path "C:\Program Files\Autodesk\Navisworks Manage 2021\Autodesk.Navisworks.Automation.dll"
$application = New-Object Autodesk.Navisworks.Api.Automation.NavisworksApplication
try {
    $application.DisableProgress()
    $application.AddPluginAssembly((Join-Path $root "bin\Release\net48\Build17PerspectiveProbe.dll"))
    $status = $application.ExecuteAddInPlugin("Build17PerspectiveProbe.BIMLog", @([IO.Path]::GetFullPath($OutputDirectory)))
    if ($status -ne 0) { throw "Probe plugin returned status $status." }
}
finally {
    $application.Dispose()
}
