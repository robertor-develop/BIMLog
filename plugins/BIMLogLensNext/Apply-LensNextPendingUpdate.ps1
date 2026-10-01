param(
    [Parameter(Mandatory=$true)][string]$PlanPath,
    [int]$WaitForProcessId = 0
)
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
if ($plan.ContractVersion -ne 'lens-next-pending-update.v1') { throw 'Unsupported Lens Next update plan.' }
if ($WaitForProcessId -gt 0) {
    try { Wait-Process -Id $WaitForProcessId -Timeout 300 -ErrorAction Stop } catch { throw 'Navisworks must be closed before Lens Next can update.' }
}
$installRoot = [IO.Path]::GetFullPath([string]$plan.InstallRoot)
$backupRoot = [IO.Path]::GetFullPath([string]$plan.BackupRoot)
$packagePath = [IO.Path]::GetFullPath([string]$plan.PackagePath)
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw 'Verified staged package is missing.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot ("$($plan.NavisworksYear)-$stamp")
$expanded = Join-Path ([IO.Path]::GetDirectoryName($packagePath)) 'expanded'
if (Test-Path -LiteralPath $expanded) { Remove-Item -LiteralPath $expanded -Recurse -Force }
Expand-Archive -LiteralPath $packagePath -DestinationPath $expanded
$payload = Join-Path $expanded "BIMLogLensNext$($plan.NavisworksYear).bundle\Contents"
if (-not (Test-Path -LiteralPath $payload -PathType Container)) {
    $payload = Get-ChildItem -LiteralPath $expanded -Directory -Recurse | Where-Object { $_.FullName.EndsWith("BIMLogLensNext$($plan.NavisworksYear).bundle\Contents",[StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1 -ExpandProperty FullName
}
if (-not (Test-Path -LiteralPath $payload -PathType Container)) { throw 'Package does not contain the required Navisworks payload.' }
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
if (Test-Path -LiteralPath $installRoot) { Copy-Item -LiteralPath $installRoot -Destination $backup -Recurse -Force }
try {
    $parent = [IO.Path]::GetDirectoryName($installRoot)
    $incoming = Join-Path $parent ('.BIMLogLensNext-incoming-' + $stamp)
    Copy-Item -LiteralPath $payload -Destination $incoming -Recurse -Force
    if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
    Move-Item -LiteralPath $incoming -Destination $installRoot
    Set-Content -LiteralPath ($PlanPath + '.installed') -Value $plan.Version -Encoding UTF8
} catch {
    if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
    if (Test-Path -LiteralPath $backup) { Copy-Item -LiteralPath $backup -Destination $installRoot -Recurse -Force }
    throw
}
