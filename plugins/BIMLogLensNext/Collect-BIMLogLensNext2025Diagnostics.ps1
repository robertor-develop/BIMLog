[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
$target = 'C:\ProgramData\Autodesk\ApplicationPlugins\BIMLogLensNext2025.bundle'
$desktop = [Environment]::GetFolderPath('Desktop')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$report = Join-Path $desktop "BIMLog-Lens-Next-2025-Diagnostics-$stamp.txt"
$since = (Get-Date).AddDays(-3)

function Write-Section([string]$Title) {
    "`r`n===== $Title =====" | Out-File -LiteralPath $report -Append -Encoding utf8
}

"BIMLog Lens Next 2025 read-only diagnostic report" | Out-File -LiteralPath $report -Encoding utf8
"Generated: $(Get-Date -Format o)" | Out-File -LiteralPath $report -Append -Encoding utf8
"Computer: $env:COMPUTERNAME" | Out-File -LiteralPath $report -Append -Encoding utf8
"User: $env:USERNAME" | Out-File -LiteralPath $report -Append -Encoding utf8

Write-Section 'Windows and Navisworks processes'
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8
Get-Process -Name roamer -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,Path,StartTime | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8

Write-Section 'Installed bundle inventory and hashes'
if (Test-Path -LiteralPath $target) {
    "Installed bundle: $target" | Out-File -LiteralPath $report -Append -Encoding utf8
    Get-ChildItem -LiteralPath $target -Recurse -File | Sort-Object FullName | ForEach-Object {
        [pscustomobject]@{
            RelativePath = $_.FullName.Substring($target.Length).TrimStart('\')
            Bytes = $_.Length
            SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    } | Format-Table -AutoSize | Out-File -LiteralPath $report -Append -Encoding utf8
} else {
    'MISSING: installed bundle was not found.' | Out-File -LiteralPath $report -Append -Encoding utf8
}

Write-Section 'Installed PackageContents.xml'
$manifest = Join-Path $target 'PackageContents.xml'
if (Test-Path -LiteralPath $manifest) { Get-Content -LiteralPath $manifest -Raw | Out-File -LiteralPath $report -Append -Encoding utf8 } else { 'MISSING' | Out-File -LiteralPath $report -Append -Encoding utf8 }

Write-Section 'Windows download-block markers'
$files = @(
    $manifest,
    (Join-Path $target 'Contents\BIMLogLensNext.dll'),
    (Join-Path $target 'Contents\BIMLogLensNext.Native2025.dll')
)
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) { "MISSING: $file" | Out-File -LiteralPath $report -Append -Encoding utf8; continue }
    "FILE: $file" | Out-File -LiteralPath $report -Append -Encoding utf8
    $zone = Get-Item -LiteralPath $file -Stream Zone.Identifier -ErrorAction SilentlyContinue
    if ($zone) {
        'WINDOWS_BLOCK_MARKER_PRESENT' | Out-File -LiteralPath $report -Append -Encoding utf8
        Get-Content -LiteralPath $file -Stream Zone.Identifier -ErrorAction SilentlyContinue | Out-File -LiteralPath $report -Append -Encoding utf8
    } else {
        'No Zone.Identifier stream found.' | Out-File -LiteralPath $report -Append -Encoding utf8
    }
    Get-AuthenticodeSignature -LiteralPath $file | Select-Object Status,StatusMessage,SignerCertificate | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8
}

Write-Section 'Installed bundle permissions'
if (Test-Path -LiteralPath $target) { (Get-Acl -LiteralPath $target) | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8 }

Write-Section 'Recent Code Integrity events'
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-CodeIntegrity/Operational'; StartTime=$since} -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match 'BIMLog|Navisworks|roamer|Native2025' } |
    Select-Object TimeCreated,Id,LevelDisplayName,Message | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8

Write-Section 'Recent Windows Defender events'
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; StartTime=$since} -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match 'BIMLog|Navisworks|roamer|Native2025' } |
    Select-Object TimeCreated,Id,LevelDisplayName,Message | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8

Write-Section 'Recent Application errors involving Navisworks or BIMLog'
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since} -ErrorAction SilentlyContinue |
    Where-Object { $_.ProviderName -match 'Application Error|\.NET Runtime|SideBySide' -and $_.Message -match 'BIMLog|Navisworks|roamer|Native2025' } |
    Select-Object TimeCreated,ProviderName,Id,LevelDisplayName,Message | Format-List | Out-File -LiteralPath $report -Append -Encoding utf8

Write-Section 'Recent Autodesk Navisworks logs'
$logRoots = @(
    (Join-Path $env:APPDATA 'Autodesk\Navisworks Manage 2025'),
    (Join-Path $env:LOCALAPPDATA 'Autodesk\Navisworks Manage 2025'),
    (Join-Path $env:TEMP 'Navisworks')
)
foreach ($logRoot in $logRoots) {
    if (-not (Test-Path -LiteralPath $logRoot)) { continue }
    Get-ChildItem -LiteralPath $logRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $since -and ($_.Extension -in '.log','.txt','.xml') } |
        Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize | Out-File -LiteralPath $report -Append -Encoding utf8
}

Write-Section 'Conclusion marker'
'END OF READ-ONLY DIAGNOSTIC REPORT' | Out-File -LiteralPath $report -Append -Encoding utf8
Write-Host "DIAGNOSTICS PASS: $report" -ForegroundColor Green
