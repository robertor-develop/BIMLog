$ErrorActionPreference='Stop';$root=$PSScriptRoot
$build=Get-Content -LiteralPath (Join-Path $root 'Build-Revit2026Package.ps1') -Raw;$install=Get-Content -LiteralPath (Join-Path $root 'Install-Revit2026.ps1') -Raw;$uninstall=Get-Content -LiteralPath (Join-Path $root 'Uninstall-Revit2026.ps1') -Raw
foreach($needle in 'RevitAPI.dll','RevitAPIUI.dll','dotnet publish','Get-FileHash','Compress-Archive'){if(-not$build.Contains($needle)){throw "Build package missing $needle"}}
foreach($needle in '.rollback','Move-Item','BIMLogLensNext.Revit2026.addin','Restart Revit'){if(-not$install.Contains($needle)){throw "Installer missing $needle"}}
if(-not$uninstall.Contains('Restart Revit')){throw 'Uninstaller must explain restart completion.'}
Write-Output 'BIMLog Lens Revit 2026 package lifecycle: PASS'
