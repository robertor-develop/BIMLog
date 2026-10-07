param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$SecretPath = 'F:\BIMLog\Private\bimlog-main04-bridge-token.dpapi',
  [int]$Port = 8791
)

$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction Stop).Source
$codex = 'C:\Users\soporte\AppData\Local\OpenAI\Codex\bin\f544b3844e0f14e9\codex.exe'
$rollout = 'C:\Users\soporte\.codex\sessions\2026\10\05\rollout-2026-10-05T01-42-21-01a10a95-a2e5-73d3-a471-6738addc7e42.jsonl'
if (-not (Test-Path -LiteralPath $SecretPath)) { throw "Missing protected bridge token: $SecretPath" }
if (-not (Test-Path -LiteralPath $codex)) { throw "Missing Codex executable: $codex" }
if (-not (Test-Path -LiteralPath $rollout)) { throw "Missing MAIN 04 rollout: $rollout" }

$secure = Get-Content -LiteralPath $SecretPath -Raw | ConvertTo-SecureString
$credential = [pscredential]::new('bimlog-main04', $secure)
$env:BIMLOG_MAIN04_BRIDGE_TOKEN = $credential.GetNetworkCredential().Password
$env:BIMLOG_MAIN04_LOCAL_PORT = [string]$Port
$env:BIMLOG_CODEX_EXECUTABLE = $codex
$env:BIMLOG_MAIN04_ROLLOUT_PATH = $rollout
try {
  & $node (Join-Path $RepositoryRoot 'scripts\bimlog-main04-local-bridge.mjs')
} finally {
  Remove-Item Env:BIMLOG_MAIN04_BRIDGE_TOKEN -ErrorAction SilentlyContinue
}
