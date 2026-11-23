param([Parameter(Mandatory=$true)][string]$Version,[string]$RevitInstallDir='C:\Program Files\Autodesk\Revit 2026')
$ErrorActionPreference='Stop'
$root=$PSScriptRoot;$project=Join-Path $root 'BIMLogLensNext.Revit2026.csproj'
if($Version -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$'){throw 'Version must use vMAJOR.MINOR.PATCH.'}
foreach($dll in 'RevitAPI.dll','RevitAPIUI.dll'){if(-not(Test-Path -LiteralPath (Join-Path $RevitInstallDir $dll))){throw "Official $dll was not found at $RevitInstallDir. Package creation stopped."}}
$stage=Join-Path $root ".package\$Version";$output=Join-Path $root "BIMLog-Lens-Revit2026-$Version.zip"
if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force};New-Item -ItemType Directory -Path $stage|Out-Null
dotnet publish $project -c Release -p:Platform=x64 -p:RevitInstallDir=$RevitInstallDir -o (Join-Path $stage 'BIMLogLensNext')
if($LASTEXITCODE-ne 0){throw 'Official Revit 2026.5+ .NET 10 adapter compilation failed.'}
Copy-Item -LiteralPath (Join-Path $root 'BIMLogLensNext.Revit2026.addin') -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'Install-Revit2026.ps1') -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'Uninstall-Revit2026.ps1') -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'INSTALL-BIMLOG-LENS-REVIT-2026.bat') -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'UNINSTALL-BIMLOG-LENS-REVIT-2026.bat') -Destination $stage
if(Test-Path -LiteralPath $output){Remove-Item -LiteralPath $output -Force};Compress-Archive -LiteralPath (Join-Path $stage '*') -DestinationPath $output
[pscustomobject]@{Version=$Version;Path=$output;Bytes=(Get-Item $output).Length;Sha256=(Get-FileHash $output -Algorithm SHA256).Hash}|ConvertTo-Json
