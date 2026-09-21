[CmdletBinding()]
param([ValidateSet(2021,2025)][int[]]$ProductYear=@(2021,2025))
$ErrorActionPreference='Stop'
$pluginRoot=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$repositoryRoot=[IO.Path]::GetFullPath((Join-Path $pluginRoot '..\..')).TrimEnd('\')
$identityPath=Join-Path $repositoryRoot 'contracts\release-identity.json'
$identity=Get-Content -LiteralPath $identityPath -Raw|ConvertFrom-Json
$allowedRootFiles=@('.cs','.csproj','.props','.ps1','.bat','.txt','.xml','.json','.targets')
$sourceFiles=Get-ChildItem -LiteralPath $pluginRoot -Recurse -File|Where-Object{
  $relative=$_.FullName.Substring($pluginRoot.Length).TrimStart('\').Replace('\','/')
  $top=$relative.Split('/')[0]
  $isPulseBinary=$relative -match '^pulse/(2021|2025)/BIMLogPulse\1\.bundle/Contents/\1/BIMLogNavisPlugin\.(dll|pdb)$'
  ($allowedRootFiles -contains $_.Extension.ToLowerInvariant() -or $isPulseBinary) -and
    $top -notin @('.build','.dotnet-home','.nuget-packages','evidence','packaging') -and
    $relative -notmatch '(^|/)(bin|obj|package-[^/]+)(/|$)' -and
    $relative -notmatch '\.zip(?:\.sha256)?$'
}|Sort-Object FullName
if(-not $sourceFiles){throw 'STOP: no Lens Next source files were selected.'}
$digestLines=@("contracts/release-identity.json $((Get-FileHash -LiteralPath $identityPath -Algorithm SHA256).Hash)")
$digestLines+=foreach($file in $sourceFiles){
  $relative=$file.FullName.Substring($pluginRoot.Length).TrimStart('\').Replace('\','/')
  "$relative $((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash)"
}
$sha=[Security.Cryptography.SHA256]::Create()
try{$digest=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($digestLines -join "`n")))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
$results=@()
foreach($year in $ProductYear){
  $canonical="H:\BIMLogPlugin$year"
  if(-not(Test-Path -LiteralPath $canonical -PathType Container)){throw "STOP: canonical root is missing: $canonical"}
  $stage=Join-Path $canonical ("LensNext-Source-"+$digest.Substring(0,16))
  if(-not(Test-Path -LiteralPath $stage)){New-Item -ItemType Directory -Path $stage|Out-Null}
  foreach($file in $sourceFiles){
    $relative=$file.FullName.Substring($pluginRoot.Length).TrimStart('\')
    $destination=Join-Path $stage $relative
    $parent=Split-Path -Parent $destination
    if(-not(Test-Path -LiteralPath $parent)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
    if(Test-Path -LiteralPath $destination){
      if((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash){throw "STOP: immutable staged source differs: $destination"}
    }else{Copy-Item -LiteralPath $file.FullName -Destination $destination}
  }
  $contractTarget=Join-Path $stage 'contracts\release-identity.json'
  New-Item -ItemType Directory -Path (Split-Path -Parent $contractTarget) -Force|Out-Null
  if(Test-Path -LiteralPath $contractTarget){
    if((Get-FileHash -LiteralPath $contractTarget -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $identityPath -Algorithm SHA256).Hash){throw "STOP: immutable staged identity differs: $contractTarget"}
  }else{Copy-Item -LiteralPath $identityPath -Destination $contractTarget}
  $builder=Join-Path $stage "Build-Package-LensNext$year.ps1"
  & $builder -Version $identity.label|Out-Null
  if($LASTEXITCODE){throw "STOP: first $year package build failed."}
  $zip=Join-Path $stage "BIMLog-Lens-Next-Navisworks$year-$($identity.label).zip"
  $first=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
  & $builder -Version $identity.label|Out-Null
  if($LASTEXITCODE){throw "STOP: repeat $year package build failed."}
  $second=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
  if($first -ne $second){throw "STOP: $year package is not reproducible: $first != $second"}
  $results+=[ordered]@{productYear=$year;release=$identity.label;binaryVersion=$identity.binaryVersion;sourceDigest=$digest;stageRoot=$stage;zipPath=$zip;zipSha256=$second;deterministicRebuild=$true}
}
$results|ConvertTo-Json -Depth 5
