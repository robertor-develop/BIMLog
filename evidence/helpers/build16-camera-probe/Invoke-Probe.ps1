param([Parameter(Mandatory = $true)][string]$OutputDirectory)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "Build16CameraProbe.csproj"
dotnet build $project -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$automationAssembly = "C:\Program Files\Autodesk\Navisworks Manage 2021\Autodesk.Navisworks.Automation.dll"
Add-Type -Path $automationAssembly
$application = New-Object Autodesk.Navisworks.Api.Automation.NavisworksApplication
try {
    $application.DisableProgress()
    $pluginAssembly = Join-Path $root "bin\Release\net48\Build16CameraProbe.dll"
    $application.AddPluginAssembly($pluginAssembly)
    $status = $application.ExecuteAddInPlugin("Build16CameraProbe.BIMLog", @([IO.Path]::GetFullPath($OutputDirectory)))
    if ($status -ne 0) { throw "Probe plugin returned status $status." }
}
finally {
    $application.Dispose()
}
