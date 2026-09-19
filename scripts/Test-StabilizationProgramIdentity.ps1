[CmdletBinding()]
param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ExpectedBranch = 'codex/bimlog-stabilization-program-20260919',
    [string]$ExpectedBase = '07d024ef3de739abb436da58fe29797af5304b8a',
    [string]$ExpectedRemoteUrl = 'https://github.com/robertor-develop/BIMLog.git',
    [string]$ExpectedRemoteBranch = 'codex/bimlog-stabilization-program-20260919',
    [switch]$AllowMissingRemoteBranch,
    [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = & git -c "safe.directory=$($ProjectRoot -replace '\\','/')" -C $ProjectRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }
    return @($output)
}

$actualRoot = (Invoke-Git rev-parse --show-toplevel | Select-Object -Last 1).Trim()
$actualBranch = (Invoke-Git branch --show-current | Select-Object -Last 1).Trim()
$localHead = (Invoke-Git rev-parse HEAD | Select-Object -Last 1).Trim()
$localTree = (Invoke-Git rev-parse 'HEAD^{tree}' | Select-Object -Last 1).Trim()
$remoteUrl = (Invoke-Git remote get-url origin | Select-Object -Last 1).Trim()
$status = @((Invoke-Git status --porcelain=v1)) | Where-Object { $_ -ne '' }

if ($actualBranch -ne $ExpectedBranch) { throw "Branch mismatch: expected $ExpectedBranch, actual $actualBranch" }
if ($remoteUrl -ne $ExpectedRemoteUrl) { throw "Remote mismatch: expected $ExpectedRemoteUrl, actual $remoteUrl" }
Invoke-Git merge-base --is-ancestor $ExpectedBase HEAD | Out-Null
if (-not $AllowDirty -and $status.Count -ne 0) { throw "Worktree is dirty: $($status.Count) entries" }

$remoteLines = @(Invoke-Git ls-remote --heads origin "refs/heads/$ExpectedRemoteBranch")
$remoteHead = $null
if ($remoteLines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($remoteLines[0])) {
    $remoteHead = ($remoteLines[0] -split '\s+')[0]
}

if (-not $remoteHead) {
    if (-not $AllowMissingRemoteBranch) { throw "Remote branch does not exist: $ExpectedRemoteBranch" }
} elseif ($remoteHead -ne $localHead) {
    throw "Local/remote mismatch: local $localHead, remote $remoteHead"
}

[pscustomobject]@{
    Result = 'PASS'
    ProjectRoot = $actualRoot
    Branch = $actualBranch
    Base = $ExpectedBase
    LocalHead = $localHead
    LocalTree = $localTree
    RemoteUrl = $remoteUrl
    RemoteBranch = $ExpectedRemoteBranch
    RemoteHead = if ($remoteHead) { $remoteHead } else { 'MISSING_ALLOWED' }
    Clean = ($status.Count -eq 0)
} | ConvertTo-Json -Depth 4
