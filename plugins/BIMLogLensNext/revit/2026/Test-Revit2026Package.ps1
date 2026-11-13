$ErrorActionPreference='Stop';$root=$PSScriptRoot
$project=Get-Content -LiteralPath (Join-Path $root 'BIMLogLensNext.Revit2026.csproj') -Raw;$build=Get-Content -LiteralPath (Join-Path $root 'Build-Revit2026Package.ps1') -Raw;$install=Get-Content -LiteralPath (Join-Path $root 'Install-Revit2026.ps1') -Raw;$uninstall=Get-Content -LiteralPath (Join-Path $root 'Uninstall-Revit2026.ps1') -Raw
if(-not$project.Contains('<TargetFramework>net10.0-windows</TargetFramework>')){throw 'Latest Revit 2026.5+ requires the .NET 10 adapter target.'}
foreach($needle in 'RevitAPI.dll','RevitAPIUI.dll','dotnet publish','Get-FileHash','Compress-Archive'){if(-not$build.Contains($needle)){throw "Build package missing $needle"}}
foreach($needle in '.rollback','Move-Item','BIMLogLensNext.Revit2026.addin','Restart Revit'){if(-not$install.Contains($needle)){throw "Installer missing $needle"}}
if(-not$uninstall.Contains('Restart Revit')){throw 'Uninstaller must explain restart completion.'}
Write-Output 'BIMLog Lens Revit 2026.5+ .NET 10 package lifecycle: PASS'
