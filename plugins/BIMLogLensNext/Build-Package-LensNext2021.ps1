[CmdletBinding()]
param([string]$Version = 'v1.05.N03-P01')
$ErrorActionPreference = 'Stop'
$binaryVersion = '1.5.3.1'
if ($Version -ne 'v1.05.N03-P01') { throw 'STOP: stale or unexpected release requested.' }
$year = 2021
$sourceRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$canonicalRoot = $sourceRoot
function Assert-CanonicalPath([string]$Path) {
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not ($resolved.Equals($canonicalRoot,[StringComparison]::OrdinalIgnoreCase) -or $resolved.StartsWith($canonicalRoot+'\',[StringComparison]::OrdinalIgnoreCase))) { throw "STOP: write escaped canonical root: $resolved" }
  $cursor = $resolved
  while ($cursor.Length -ge $canonicalRoot.Length) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "STOP: reparse point: $cursor" }
    }
    if ($cursor.Equals($canonicalRoot,[StringComparison]::OrdinalIgnoreCase)) { break }
    $cursor = Split-Path -Parent $cursor
  }
  $resolved
}
Assert-CanonicalPath $sourceRoot | Out-Null
$buildRoot = Assert-CanonicalPath (Join-Path $sourceRoot '.build')
$packageRoot = Assert-CanonicalPath (Join-Path $sourceRoot "package-$Version-$year")
$bundleName = "BIMLogLensNext$year.bundle"
$bundleRoot = Assert-CanonicalPath (Join-Path $packageRoot $bundleName)
$contentsRoot = Assert-CanonicalPath (Join-Path $bundleRoot 'Contents')
$evidenceRoot = Assert-CanonicalPath (Join-Path $sourceRoot 'evidence')
$zipPath = Assert-CanonicalPath (Join-Path $sourceRoot "BIMLog-Lens-Next-Navisworks$year-$Version.zip")
$shaPath = "$zipPath.sha256"
function Get-RelativePath([string]$BasePath,[string]$ChildPath) {
  $baseUri=[Uri]::new(([IO.Path]::GetFullPath($BasePath).TrimEnd('\')+'\'))
  $childUri=[Uri]::new([IO.Path]::GetFullPath($ChildPath))
  [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($childUri).ToString()).Replace('/','\')
}
$env:DOTNET_CLI_HOME=Assert-CanonicalPath (Join-Path $sourceRoot '.dotnet-home')
$env:NUGET_PACKAGES=Assert-CanonicalPath (Join-Path $sourceRoot '.nuget-packages')
New-Item -ItemType Directory -Force -Path $env:DOTNET_CLI_HOME,$env:NUGET_PACKAGES,$evidenceRoot | Out-Null
$nativeProject=Join-Path $sourceRoot "native\$year\BIMLogLensNext.Native$year.csproj"
$packageContents=Join-Path $sourceRoot "native\$year\PackageContents.xml"
$packageXml=[xml](Get-Content -LiteralPath $packageContents -Raw)
$component=$packageXml.ApplicationPackage.Components.ComponentEntry
$requirements=$packageXml.ApplicationPackage.Components.RuntimeRequirements
if($component.AppType -ne 'ManagedPlugin'){throw 'STOP: PackageContents.xml must declare AppType=ManagedPlugin.'}
if($component.ModuleName -ne './Contents/BIMLogLensNext.Native2021.dll'){throw 'STOP: PackageContents.xml has the wrong native module.'}
if($requirements.Platform -ne 'NAVMAN' -or $requirements.SeriesMin -ne 'Nw18' -or $requirements.SeriesMax -ne 'Nw18'){throw 'STOP: PackageContents.xml does not target Navisworks Manage 2021 exactly.'}
$coreTests=Join-Path $sourceRoot 'tests\BIMLogLensNext.Tests.csproj'
$nativeTests=Join-Path $sourceRoot "native\tests\$year\BIMLogLensNext.Native$year.Tests.csproj"
foreach($project in @($nativeProject,$coreTests,$nativeTests)){ if(-not(Test-Path -LiteralPath $project -PathType Leaf)){throw "STOP: missing $project"}; & dotnet restore $project --ignore-failed-sources; if($LASTEXITCODE){throw "Restore failed: $project"} }
foreach($project in @($nativeProject,$coreTests,$nativeTests)){ & dotnet build $project -c Release --no-restore; if($LASTEXITCODE){throw "Build failed: $project"} }
$coreTestExe=Join-Path $buildRoot 'bin\BIMLogLensNext.Tests\Release\net48\BIMLogLensNext.Tests.exe'
$nativeTestExe=Join-Path $buildRoot "bin\BIMLogLensNext.Native$year.Tests\Release\net48\BIMLogLensNext.Native$year.Tests.exe"
foreach($testExe in @($coreTestExe,$nativeTestExe)){ if(-not(Test-Path -LiteralPath $testExe -PathType Leaf)){throw "STOP: missing $testExe"}; & $testExe; if($LASTEXITCODE){throw "Tests failed: $testExe"} }
foreach($target in @($packageRoot,$zipPath,$shaPath)){if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force}}
New-Item -ItemType Directory -Force -Path $contentsRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRoot "native\$year\PackageContents.xml") -Destination (Join-Path $bundleRoot 'PackageContents.xml') -Force
$coreOutput=Join-Path $buildRoot 'bin\BIMLogLensNext\Release\net48'
$nativeOutput=Join-Path $buildRoot "bin\BIMLogLensNext.Native$year\Release\net48"
foreach($name in @('BIMLogLensNext.dll','BIMLogLensNext.pdb')){Copy-Item -LiteralPath (Join-Path $coreOutput $name) -Destination (Join-Path $contentsRoot $name) -Force}
foreach($name in @("BIMLogLensNext.Native$year.dll","BIMLogLensNext.Native$year.pdb",'Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','Microsoft.Web.WebView2.Wpf.dll')){Copy-Item -LiteralPath (Join-Path $nativeOutput $name) -Destination (Join-Path $contentsRoot $name) -Force}
Copy-Item -LiteralPath (Join-Path $nativeOutput 'runtimes') -Destination $contentsRoot -Recurse -Force
foreach($name in @('INSTALL-BIMLOG-LENS-NEXT-2021.bat','UNINSTALL-BIMLOG-LENS-NEXT-2021.bat','Install-BIMLogLensNext2021.ps1','Uninstall-BIMLogLensNext2021.ps1','README-ROBERTO-RUBEN.txt','FIELD-ACCEPTANCE-CHECKLIST.txt','COLLECT-LENS-NEXT-FAILURE-DETAILS.bat','Collect-LensNextFailureDetails.ps1')){Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination $packageRoot -Force}
$manifestFiles=Get-ChildItem -LiteralPath $packageRoot -Recurse -File|Sort-Object FullName|ForEach-Object{[ordered]@{path=(Get-RelativePath $packageRoot $_.FullName).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}}
$manifest=[ordered]@{schemaVersion='bimlog-lens-next-package-v1';product='BIMLog Lens Next';productYear=$year;release=$Version;binaryVersion=$binaryVersion;installBundle=$bundleName;installTarget="C:\ProgramData\Autodesk\ApplicationPlugins\$bundleName";originalLensPreserved=$true;files=$manifestFiles}
[IO.File]::WriteAllText((Join-Path $packageRoot 'manifest.json'),($manifest|ConvertTo-Json -Depth 8)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
$packagedXml=[xml](Get-Content -LiteralPath (Join-Path $bundleRoot 'PackageContents.xml') -Raw)
if($packagedXml.ApplicationPackage.AppVersion -ne $binaryVersion){throw "STOP: packaged Autodesk AppVersion does not match $binaryVersion."}
$packagedNative=Join-Path $contentsRoot "BIMLogLensNext.Native$year.dll"
if((Get-Item -LiteralPath $packagedNative).VersionInfo.FileVersion -ne $binaryVersion){throw "STOP: packaged native DLL version does not match $binaryVersion."}
$expectedRelease=$Version
foreach($textFile in (Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Where-Object Extension -in @('.ps1','.bat','.txt','.xml','.json'))){
  $text=Get-Content -LiteralPath $textFile.FullName -Raw
  foreach($match in [regex]::Matches($text,'v1\.(?:0\.\d+|05\.N\d{2,}-P\d{2,})')){if($match.Value -ne $expectedRelease){throw "STOP: stale release identity $($match.Value) in $($textFile.FullName)."}}
}
& (Join-Path $packageRoot 'Install-BIMLogLensNext2021.ps1') -PackageOnly
if($LASTEXITCODE){throw 'STOP: packaged installer package-only acceptance failed.'}
Add-Type -AssemblyName System.IO.Compression
$stream=[IO.File]::Open($zipPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try{$archive=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$true);try{foreach($file in (Get-ChildItem -LiteralPath $packageRoot -Recurse -File|Sort-Object FullName)){$name=(Get-RelativePath $packageRoot $file.FullName).Replace('\','/');$entry=$archive.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal);$entry.LastWriteTime=[DateTimeOffset]::new(2000,1,1,0,0,0,[TimeSpan]::Zero);$input=[IO.File]::OpenRead($file.FullName);$output=$entry.Open();try{$input.CopyTo($output)}finally{$output.Dispose();$input.Dispose()}}}finally{$archive.Dispose()}}finally{$stream.Dispose()}
$zipHash=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
[IO.File]::WriteAllText($shaPath,"$zipHash  $(Split-Path -Leaf $zipPath)$([Environment]::NewLine)",[Text.UTF8Encoding]::new($false))
$nativeDll=$packagedNative
$receipt=[ordered]@{schemaVersion='bimlog-lens-next-build-receipt-v1';status='BUILD_PACKAGE_PASS_NO_INSTALL';productYear=$year;release=$Version;binaryVersion=$binaryVersion;sourceRoot=$sourceRoot;packageRoot=$packageRoot;zipPath=$zipPath;zipBytes=(Get-Item -LiteralPath $zipPath).Length;zipSha256=$zipHash;coreDllSha256=(Get-FileHash -LiteralPath (Join-Path $contentsRoot 'BIMLogLensNext.dll') -Algorithm SHA256).Hash;nativeDllSha256=(Get-FileHash -LiteralPath $nativeDll -Algorithm SHA256).Hash;nativeDllFileVersion=(Get-Item -LiteralPath $nativeDll).VersionInfo.FileVersion;tests=[ordered]@{core='passed';native2021='passed';packagedInstallerPackageOnly='passed';releaseIdentityConsistency='passed'};installPerformed=$false;fieldAcceptance='pending Roberto Navisworks Manage 2021'}
[IO.File]::WriteAllText((Join-Path $evidenceRoot 'build-package-receipt-2021.json'),($receipt|ConvertTo-Json -Depth 8)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
$receipt|ConvertTo-Json -Depth 8
