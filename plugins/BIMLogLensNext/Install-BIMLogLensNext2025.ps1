[CmdletBinding()]
param([switch]$PackageOnly,[string]$SimulationRoot,[string]$RollbackRoot)
& (Join-Path $PSScriptRoot 'Install-BIMLogLensNext.ps1') -Year 2025 -PackageOnly:$PackageOnly -SimulationRoot $SimulationRoot -RollbackRoot $RollbackRoot
exit $LASTEXITCODE
