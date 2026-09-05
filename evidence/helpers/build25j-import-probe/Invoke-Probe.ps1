param(
    [Parameter(Mandatory = $true)][string]$XmlPath,
    [Parameter(Mandatory = $true)][string]$EvidencePath
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$actualHash = (Get-FileHash -LiteralPath $XmlPath -Algorithm SHA256).Hash
$allowedHashes = @(
    "4AEF4159BB77FC88E5659ED12CA94B8BA4669CB58B03B9DEC827CB17437593CA",
    "BED08C7F2725F7992A831596BD1F09AC35CE6139780DAE90656DB3E565D0D5F5",
    "E8D6EC4CB6F9726220DC68A156E9435A257374F37AD89234C663F6AB60CC2A99"
)
if ($actualHash -notin $allowedHashes) {
    throw "Target XML SHA-256 mismatch: $actualHash"
}
dotnet build (Join-Path $root "Build25JImportProbe.csproj") -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Add-Type -Path "C:\Program Files\Autodesk\Navisworks Manage 2021\Autodesk.Navisworks.Automation.dll"
$application = New-Object Autodesk.Navisworks.Api.Automation.NavisworksApplication
try {
    $application.DisableProgress()
    $application.AddPluginAssembly((Join-Path $root "bin\Release\net48\Build25JImportProbe.dll"))
    $probeParameter = [IO.Path]::GetFullPath($XmlPath) + "|" + [IO.Path]::GetFullPath($EvidencePath) + "|--headless"
    $status = $application.ExecuteAddInPlugin("Build25JGenuineXmlImportProbe.BIMLog", @($probeParameter))
    if ($status -ne 0) { throw "Probe plugin returned status $status." }
}
finally { $application.Dispose() }
Get-Content -LiteralPath $EvidencePath -Raw
