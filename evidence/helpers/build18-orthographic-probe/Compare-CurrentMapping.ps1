param([Parameter(Mandatory = $true)][string]$OutputDirectory)
$ErrorActionPreference = "Stop"
$api = Import-Csv -LiteralPath (Join-Path $OutputDirectory "api-values.csv")
[xml]$xml = Get-Content -LiteralPath (Join-Path $OutputDirectory "navisworks-export.xml") -Raw
$views = @{}; foreach ($view in $xml.SelectNodes('//view')) { $views[$view.GetAttribute('name')] = $view }
$results = foreach ($row in $api) {
    $f = [double]::Parse($row.FocalDistance, [Globalization.CultureInfo]::InvariantCulture)
    $h = [double]::Parse($row.HorizontalExtent, [Globalization.CultureInfo]::InvariantCulture)
    $v = [double]::Parse($row.VerticalExtent, [Globalization.CultureInfo]::InvariantCulture)
    $calculatedFov = 2.0 * [Math]::Atan2($v, 2.0 * $f)
    $calculatedAspect = $h / $v
    $viewpoint = $views[$row.Name].SelectSingleNode('./viewpoint')
    $camera = $viewpoint.SelectSingleNode('./camera')
    $xmlFocal = [double]::Parse($viewpoint.GetAttribute('focal'), [Globalization.CultureInfo]::InvariantCulture)
    $xmlAspect = [double]::Parse($camera.GetAttribute('aspect'), [Globalization.CultureInfo]::InvariantCulture)
    $xmlHeight = [double]::Parse($camera.GetAttribute('height'), [Globalization.CultureInfo]::InvariantCulture)
    $fovPresent = $viewpoint.HasAttribute('fov')
    $xmlFov = if ($fovPresent) { [double]::Parse($viewpoint.GetAttribute('fov'), [Globalization.CultureInfo]::InvariantCulture) } else { $null }
    [pscustomobject]@{
        Name=$row.Name; ApiFocal=$row.FocalDistance; ApiHorizontal=$row.HorizontalExtent; ApiVertical=$row.VerticalExtent
        XmlFocal=$viewpoint.GetAttribute('focal'); XmlFovPresent=$fovPresent; XmlFov=$viewpoint.GetAttribute('fov'); XmlAspect=$camera.GetAttribute('aspect'); XmlHeight=$camera.GetAttribute('height')
        BimlogFocal=$f.ToString('R',[Globalization.CultureInfo]::InvariantCulture); BimlogFovPresent=$true; BimlogFov=$calculatedFov.ToString('R',[Globalization.CultureInfo]::InvariantCulture); BimlogAspect=$calculatedAspect.ToString('R',[Globalization.CultureInfo]::InvariantCulture); BimlogHeight=$v.ToString('R',[Globalization.CultureInfo]::InvariantCulture)
        DeltaFocal=[Math]::Abs($xmlFocal-$f).ToString('R',[Globalization.CultureInfo]::InvariantCulture); DeltaFov=if($fovPresent){[Math]::Abs($xmlFov-$calculatedFov).ToString('R',[Globalization.CultureInfo]::InvariantCulture)}else{'NOT_COMPARABLE'}; DeltaAspect=[Math]::Abs($xmlAspect-$calculatedAspect).ToString('R',[Globalization.CultureInfo]::InvariantCulture); DeltaHeight=[Math]::Abs($xmlHeight-$v).ToString('R',[Globalization.CultureInfo]::InvariantCulture)
    }
}
$results | Export-Csv -LiteralPath (Join-Path $OutputDirectory "comparison-results.csv") -NoTypeInformation -Encoding UTF8
$results | Format-Table -AutoSize
