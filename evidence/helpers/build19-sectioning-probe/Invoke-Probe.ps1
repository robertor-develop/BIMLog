param([Parameter(Mandatory = $true)][string]$OutputDirectory)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
dotnet build (Join-Path $root "Build19SectioningProbe.csproj") -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Add-Type -Path "C:\Program Files\Autodesk\Navisworks Manage 2021\Autodesk.Navisworks.Automation.dll"
$application = New-Object Autodesk.Navisworks.Api.Automation.NavisworksApplication
try {
    $application.DisableProgress()
    $application.AddPluginAssembly((Join-Path $root "bin\Release\net48\Build19SectioningProbe.dll"))
    $status = $application.ExecuteAddInPlugin("Build19SectioningProbeV3.BIMLog", @([IO.Path]::GetFullPath($OutputDirectory)))
    if ($status -ne 0) { throw "Probe plugin returned status $status." }
}
finally { $application.Dispose() }
