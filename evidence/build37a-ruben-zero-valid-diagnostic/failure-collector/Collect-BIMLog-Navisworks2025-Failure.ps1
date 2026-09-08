[CmdletBinding()]
param(
  [string]$FailedXmlPath = "",
  [string]$OutputDirectory = ([Environment]::GetFolderPath("Desktop"))
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$work = Join-Path ([IO.Path]::GetTempPath()) "BIMLog-Navisworks2025-Failure-$timestamp"
$output = Join-Path $OutputDirectory "BIMLog-Navisworks2025-Failure-$timestamp.zip"
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $work -Force | Out-Null

function Save-Text([string]$Name, [scriptblock]$Action) {
  try { (& $Action 2>&1 | Out-String -Width 4096) | Set-Content -LiteralPath (Join-Path $work $Name) -Encoding UTF8 }
  catch { $_ | Out-String | Set-Content -LiteralPath (Join-Path $work $Name) -Encoding UTF8 }
}

Save-Text "system.txt" {
  "Collected: $(Get-Date -Format o)"
  "Machine: $env:COMPUTERNAME"
  Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,LastBootUpTime
}
Save-Text "navisworks-processes.txt" {
  Get-Process -Name Roamer -ErrorAction SilentlyContinue |
    Select-Object Id,ProcessName,StartTime,CPU,WorkingSet64,MainWindowTitle,MainWindowHandle,Path
}
Save-Text "port-8766.txt" {
  Get-NetTCPConnection -LocalPort 8766 -ErrorAction SilentlyContinue |
    Select-Object State,LocalAddress,LocalPort,RemoteAddress,RemotePort,OwningProcess
  netsh http show servicestate view=requestq verbose=yes
}
Save-Text "bridge-status.txt" {
  try { Invoke-RestMethod -Uri "http://127.0.0.1:8766/status" -TimeoutSec 5 | ConvertTo-Json -Depth 10 }
  catch { "Bridge status unavailable: $($_.Exception.Message)" }
}

$bundleRoots = @(
  "$env:APPDATA\Autodesk\ApplicationPlugins",
  "$env:ProgramData\Autodesk\ApplicationPlugins"
)
Save-Text "bimlog-bundle-inventory.txt" {
  foreach ($root in $bundleRoots) {
    "ROOT: $root"
    if (Test-Path -LiteralPath $root) {
      Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "BIMLog|Lens" } |
        Select-Object FullName,Length,LastWriteTime,@{n="SHA256";e={(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}}
    }
  }
}

Save-Text "application-events.txt" {
  $start = (Get-Date).AddHours(-4)
  Get-WinEvent -FilterHashtable @{LogName="Application";StartTime=$start} -ErrorAction SilentlyContinue |
    Where-Object { $_.ProviderName -match "Navisworks|Roamer|\.NET Runtime|Application Error|BIMLog|Lens" -or $_.Message -match "Navisworks|Roamer|BIMLog|Lens Next" } |
    Select-Object -First 300 TimeCreated,ProviderName,Id,LevelDisplayName,Message
}

$logRoots = @(
  "$env:LOCALAPPDATA\Autodesk\Navisworks Manage 2025",
  "$env:APPDATA\Autodesk\Navisworks Manage 2025",
  "$env:ProgramData\Autodesk\Navisworks Manage 2025",
  "$env:LOCALAPPDATA\BIMLog",
  "$env:ProgramData\BIMLog"
)
$logTarget = Join-Path $work "recent-logs"
New-Item -ItemType Directory -Path $logTarget -Force | Out-Null
$logIndex = 0
foreach ($root in $logRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge (Get-Date).AddDays(-2) -and $_.Extension -in ".log",".txt",".json",".xml" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 20 |
    ForEach-Object {
      $logIndex++
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $logTarget ("{0:D3}-{1}" -f $logIndex,$_.Name)) -Force
    }
}

if ($FailedXmlPath) {
  try {
    $resolved = (Resolve-Path -LiteralPath $FailedXmlPath -ErrorAction Stop).Path
    if ([IO.Path]::GetExtension($resolved) -ne ".xml") { throw "FailedXmlPath must be an XML file." }
    Copy-Item -LiteralPath $resolved -Destination (Join-Path $work "failed-BIMLog-Viewpoints.xml") -Force
    Save-Text "failed-xml-identity.txt" { Get-Item -LiteralPath $resolved | Select-Object FullName,Length,LastWriteTime; Get-FileHash -LiteralPath $resolved -Algorithm SHA256 }
  } catch { Save-Text "failed-xml-copy-error.txt" { $_ } }
}

Compress-Archive -Path (Join-Path $work "*") -DestinationPath $output -CompressionLevel Optimal -Force
Remove-Item -LiteralPath $work -Recurse -Force
Write-Host "Created: $output"
