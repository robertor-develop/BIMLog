param([Parameter(Mandatory = $true)][string]$EvidenceDirectory)

$ErrorActionPreference = "Stop"
$culture = [Globalization.CultureInfo]::InvariantCulture
$tolerance = 5.01e-11
$apiRows = Import-Csv -LiteralPath (Join-Path $EvidenceDirectory "api-values.csv")
[xml]$xml = Get-Content -LiteralPath (Join-Path $EvidenceDirectory "navisworks-export.xml") -Raw
$results = foreach ($api in $apiRows) {
    $view = @($xml.exchange.viewpoints.view | Where-Object { $_.name -eq $api.Name })
    if ($view.Count -ne 1) { throw "Expected exactly one XML view for $($api.Name)." }
    $focal = [double]::Parse($api.FocalDistance, $culture)
    $horizontal = [double]::Parse($api.HorizontalExtent, $culture)
    $vertical = [double]::Parse($api.VerticalExtent, $culture)
    $fieldScale = [Math]::Max($vertical, $focal)
    $calculatedFov = 2.0 * [Math]::Atan2($vertical / $fieldScale, 2.0 * ($focal / $fieldScale))
    $calculatedAspect = $horizontal / $vertical
    $calculatedHeight = $calculatedFov
    $xmlFocal = [double]::Parse([string]$view.viewpoint.focal, $culture)
    $xmlFovText = [string]$view.viewpoint.fov
    $xmlFov = if ([string]::IsNullOrEmpty($xmlFovText)) { $null } else { [double]::Parse($xmlFovText, $culture) }
    $xmlAspect = [double]::Parse([string]$view.viewpoint.camera.aspect, $culture)
    $xmlHeight = [double]::Parse([string]$view.viewpoint.camera.height, $culture)
    $result = [pscustomobject]@{
        Name = $api.Name
        API_Focal = $focal
        API_HorizontalExtent = $horizontal
        API_VerticalExtent = $vertical
        XML_Focal = $xmlFocal
        XML_Fov = if ($null -eq $xmlFov) { "MISSING" } else { $xmlFov }
        XML_Aspect = $xmlAspect
        XML_Height = $xmlHeight
        BIMLog_Focal = $focal
        BIMLog_Fov = $calculatedFov
        BIMLog_Aspect = $calculatedAspect
        BIMLog_Height = $calculatedHeight
        Delta_Focal = [Math]::Abs($xmlFocal - $focal)
        Delta_Fov = if ($null -eq $xmlFov) { "NOT_COMPARABLE" } else { [Math]::Abs($xmlFov - $calculatedFov) }
        Delta_Aspect = [Math]::Abs($xmlAspect - $calculatedAspect)
        Delta_Height = [Math]::Abs($xmlHeight - $calculatedHeight)
    }
    $result
}
$results | Export-Csv -LiteralPath (Join-Path $EvidenceDirectory "comparison-results.csv") -NoTypeInformation
"NUMERICAL_TOLERANCE=$($tolerance.ToString('R', $culture))"
$results | Format-Table -AutoSize
$failures = @($results | Where-Object {
    $_.Delta_Fov -eq "NOT_COMPARABLE" -or
    [double]$_.Delta_Focal -gt $tolerance -or
    ($_.Delta_Fov -ne "NOT_COMPARABLE" -and [double]$_.Delta_Fov -gt $tolerance) -or
    [double]$_.Delta_Aspect -gt $tolerance -or
    [double]$_.Delta_Height -gt $tolerance
})
if ($failures.Count -gt 0) {
    "BUILD17_PERSPECTIVE_COMPARISON=FAIL"
    exit 1
}
"BUILD17_PERSPECTIVE_COMPARISON=PASS"
