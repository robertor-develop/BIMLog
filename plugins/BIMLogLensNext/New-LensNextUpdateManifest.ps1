param(
    [Parameter(Mandatory=$true)][string]$PackagePath,
    [Parameter(Mandatory=$true)][string]$PackageUrl,
    [Parameter(Mandatory=$true)][string]$Version,
    [string]$SigningKeyPath = 'F:\BIMLog\Secure\lens-next-update-signing-key.dpapi',
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [ValidateSet('stable','beta')][string]$Channel = 'stable',
    [int[]]$NavisworksYears = @(2021, 2025),
    [string]$MinimumBimLogVersion = '1.0.0',
    [string]$ReleaseNotesUrl = 'https://bimlog.app/releases',
    [switch]$Mandatory
)
$ErrorActionPreference = 'Stop'
$package = Get-Item -LiteralPath $PackagePath
if (-not $PackageUrl.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) { throw 'Package URL must use HTTPS.' }
$digest = (Get-FileHash -LiteralPath $package.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$years = @($NavisworksYears | Sort-Object -Unique)
$payload = @('lens-next-update.v1',$Channel,$Version,$MinimumBimLogVersion,$PackageUrl,$digest,[string]$package.Length,($years -join ','),($(if($Mandatory){'true'}else{'false'})),$ReleaseNotesUrl) -join "`n"
$rsa = New-Object Security.Cryptography.RSACryptoServiceProvider
try {
    $protected = [IO.File]::ReadAllBytes([IO.Path]::GetFullPath($SigningKeyPath))
    $privateBytes = [Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $rsa.FromXmlString([Text.Encoding]::UTF8.GetString($privateBytes))
    $signature = [Convert]::ToBase64String($rsa.SignData([Text.Encoding]::UTF8.GetBytes($payload),[Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256')))
} finally { $rsa.Dispose() }
$manifest = [ordered]@{ contractVersion='lens-next-update.v1'; channel=$Channel; version=$Version; minimumBimLogVersion=$MinimumBimLogVersion; packageUrl=$PackageUrl; packageSha256=$digest; packageSize=$package.Length; signature=$signature; releaseNotesUrl=$ReleaseNotesUrl; mandatory=[bool]$Mandatory; navisworksYears=$years }
$json = $manifest | ConvertTo-Json -Depth 4
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),$json,(New-Object Text.UTF8Encoding($false)))
