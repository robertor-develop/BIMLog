param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$SecretPath = 'F:\BIMLog\Private\bimlog-main04-bridge-token.dpapi',
  [int]$Port = 8791
)

$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction Stop).Source
$codexRoot = 'C:\Users\soporte\AppData\Local\OpenAI\Codex\bin'
$codex = Get-ChildItem -LiteralPath $codexRoot -Filter 'codex.exe' -File -Recurse -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$rollout = 'C:\Users\soporte\.codex\sessions\2026\10\05\rollout-2026-10-05T01-42-21-01a10a95-a2e5-73d3-a471-6738addc7e42.jsonl'
if (-not (Test-Path -LiteralPath $SecretPath)) { throw "Missing protected bridge token: $SecretPath" }
if (-not $codex -or -not (Test-Path -LiteralPath $codex)) { throw "Missing Codex executable beneath: $codexRoot" }
if (-not (Test-Path -LiteralPath $rollout)) { throw "Missing MAIN 04 rollout: $rollout" }

$protectedToken = (Get-Content -LiteralPath $SecretPath -Raw).Trim()
if ($protectedToken.StartsWith('DPAPI_LOCAL_MACHINE_V1:')) {
  Add-Type -AssemblyName System.Security
  $ciphertext = [Convert]::FromBase64String($protectedToken.Substring('DPAPI_LOCAL_MACHINE_V1:'.Length))
  $entropy = [Text.Encoding]::UTF8.GetBytes('BIMLog MAIN04 bridge v1')
  $plaintext = [Security.Cryptography.ProtectedData]::Unprotect(
    $ciphertext,
    $entropy,
    [Security.Cryptography.DataProtectionScope]::LocalMachine
  )
  try {
    $env:BIMLOG_MAIN04_BRIDGE_TOKEN = [Text.Encoding]::UTF8.GetString($plaintext)
  } finally {
    [Array]::Clear($plaintext, 0, $plaintext.Length)
    [Array]::Clear($ciphertext, 0, $ciphertext.Length)
    [Array]::Clear($entropy, 0, $entropy.Length)
  }
} else {
  $secure = $protectedToken | ConvertTo-SecureString
  $credential = [pscredential]::new('bimlog-main04', $secure)
  $env:BIMLOG_MAIN04_BRIDGE_TOKEN = $credential.GetNetworkCredential().Password
}
$env:BIMLOG_MAIN04_LOCAL_PORT = [string]$Port
$env:BIMLOG_CODEX_EXECUTABLE = $codex
$env:BIMLOG_MAIN04_ROLLOUT_PATH = $rollout
try {
  & $node (Join-Path $RepositoryRoot 'scripts\bimlog-main04-local-bridge.mjs')
} finally {
  Remove-Item Env:BIMLOG_MAIN04_BRIDGE_TOKEN -ErrorAction SilentlyContinue
}
