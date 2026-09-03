[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Gate {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "GATE_START=$Name"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Regression gate failed: $Name (exit $LASTEXITCODE)"
    }
    Write-Host "GATE_PASS=$Name"
}

Push-Location $repositoryRoot
try {
    Invoke-Gate "CORE_NATIVE_CONTRACTS" {
        dotnet run --project "plugins/BIMLogLensNext/tests/BIMLogLensNext.Tests.csproj" --configuration Release
    }

    Invoke-Gate "NAVISWORKS_2021_ADAPTER_CONTRACTS" {
        dotnet run --project "plugins/BIMLogLensNext/native/tests/2021/BIMLogLensNext.Native2021.Tests.csproj" --configuration Release
    }

    Invoke-Gate "PLATFORM_ATOMIC_CREATE_SOURCE_CONTRACT" {
        pnpm --filter "@workspace/api-server" exec tsx "src/lib/lens-next-create.behavior.ts"
    }

    Invoke-Gate "CREATE_CAPTURE_UI_SOURCE_CONTRACT" {
        pnpm --filter "@workspace/api-server" exec tsx "../bimlog/src/features/lens-next/lens-next-build6-create.behavior.ts"
    }

    Invoke-Gate "OPEN_WORKING_VIEW_SOURCE_CONTRACT" {
        pnpm --filter "@workspace/api-server" exec tsx "../bimlog/src/features/lens-next/lens-next-build4-platform-reconstruction.behavior.ts"
        if ($LASTEXITCODE -ne 0) { return }
        pnpm --filter "@workspace/api-server" exec tsx "../bimlog/src/features/lens-next/lens-next-working-view.behavior.ts"
    }

    Write-Host "AUTOMATED_PROOF=PASS"
    Write-Host "MANUAL_PROOF_REQUIRED=YES"
    Write-Host "REGRESSION_GATE_RESULT=PASS"
}
finally {
    Pop-Location
}
