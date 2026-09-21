[CmdletBinding()]
param([switch]$PackageOnly,[string]$SimulationRoot,[string]$LegacyDirectPluginRoot,[string]$RollbackRoot)
& (Join-Path $PSScriptRoot 'Install-BIMLogLensNext.ps1') -Year 2025 -PackageOnly:$PackageOnly -SimulationRoot $SimulationRoot -LegacyDirectPluginRoot $LegacyDirectPluginRoot -RollbackRoot $RollbackRoot
exit $LASTEXITCODE
