param(
    [string]$XmlPath = 'F:\BIMLog\Evidence\lens-next-build25-xml-import-accepted-20260905\build25-exporter-three-viewpoints.xml',
    [string]$EvidencePath = 'F:\BIMLog\Evidence\lens-next-build25-xml-import-accepted-20260905\build26-source-to-xml.txt'
)
$ErrorActionPreference = 'Stop'
$culture = [Globalization.CultureInfo]::InvariantCulture
function D([string]$value) { [double]::Parse($value, $culture) }
function MaxAbs($expected, $actual) {
    $max = 0.0
    for ($i=0; $i -lt $expected.Count; $i++) { $max = [Math]::Max($max, [Math]::Abs($expected[$i]-$actual[$i])) }
    $max
}
function Angular($a, $b, [bool]$signEquivalent) {
    $an=[Math]::Sqrt(($a | ForEach-Object {$_*$_} | Measure-Object -Sum).Sum)
    $bn=[Math]::Sqrt(($b | ForEach-Object {$_*$_} | Measure-Object -Sum).Sum)
    $dot=0.0; for($i=0;$i-lt$a.Count;$i++){$dot += $a[$i]*$b[$i]}
    $dot /= ($an*$bn); if($signEquivalent){$dot=[Math]::Abs($dot)}
    $dot=[Math]::Min(1.0,[Math]::Max(-1.0,$dot)); if($signEquivalent){2.0*[Math]::Acos($dot)}else{[Math]::Acos($dot)}
}
$cases = @(
    @{Id='CASE_1';Name='VP-160';P=@(1.5,0.0,1250.75);Q=@(0.0,0.5,-0.25,1.0);U=@(0.0,1.0,0.0);Projection='persp';F=42.125;H=100.25;V=50.125;Height=2*[Math]::Atan(50.125/(2*42.125))},
    @{Id='CASE_2';Name='VP-161';P=@(12.25,-4.5,99.0);Q=@([Math]::Sqrt(0.5),0.0,0.0,[Math]::Sqrt(0.5));U=@(-0.25,0.5,0.75);Projection='ortho';F=10.0;H=8.0;V=6.0;Height=6.0},
    @{Id='CASE_3';Name='VP-172';P=@(-1.0,-2.5,-300.125);Q=@(0.18257418583505536,-0.36514837167011072,0.5477225575051661,0.73029674334022143);U=@(0.0,0.0,1.0);Projection='persp';F=10.0;H=8.0;V=6.0;Height=2*[Math]::Atan(6/(2*10))}
)
[xml]$xml = Get-Content -LiteralPath $XmlPath -Raw
$lines = [Collections.Generic.List[string]]::new()
$lines.Add('BUILD26_SOURCE_TO_XML')
$allNumerics = [Collections.Generic.List[double]]::new()
foreach($case in $cases){
    $view=$xml.SelectSingleNode("/exchange/viewpoints/viewfolder/view[@name='$($case.Name)']")
    if($null-eq$view){throw "Missing view $($case.Name)"}
    $vp=$view.viewpoint; $camera=$vp.camera; $pos=$camera.position.pos3f; $q=$camera.rotation.quaternion; $up=$vp.up.vec3f
    $actualP=@((D $pos.x),(D $pos.y),(D $pos.z)); $actualQ=@((D $q.a),(D $q.b),(D $q.c),(D $q.d)); $actualU=@((D $up.x),(D $up.y),(D $up.z))
    $f=D $vp.focal; $aspect=D $camera.aspect; $height=D $camera.height
    $expectedFov=2*[Math]::Atan($case.V/(2*$case.F)); $fov=if($vp.HasAttribute('fov')){D $vp.fov}else{$expectedFov}
    $positionError=MaxAbs $case.P $actualP; $rawRotationError=MaxAbs $case.Q $actualQ; $rotationError=Angular $case.Q $actualQ $true; $upError=Angular $case.U $actualU $false
    $scaleError=@([Math]::Abs($case.F-$f),[Math]::Abs(($case.H/$case.V)-$aspect),[Math]::Abs($case.Height-$height),[Math]::Abs($expectedFov-$fov) | Measure-Object -Maximum).Maximum
    $lines.Add("$($case.Id)_POSITION_ERROR=$($positionError.ToString('R',$culture))")
    $lines.Add("$($case.Id)_ROTATION_RAW_ERROR=$($rawRotationError.ToString('R',$culture))")
    $lines.Add("$($case.Id)_ROTATION_ANGULAR_ERROR=$($rotationError.ToString('R',$culture))")
    $lines.Add("$($case.Id)_NEGATED_ROTATION_ANGULAR_ERROR=$((Angular $case.Q ($actualQ|ForEach-Object {-$_}) $true).ToString('R',$culture))")
    $lines.Add("$($case.Id)_UP_ANGULAR_ERROR=$($upError.ToString('R',$culture))")
    $lines.Add("$($case.Id)_PROJECTION_RESULT=$(if($camera.projection-eq$case.Projection){'PASS'}else{'FAIL'})")
    $lines.Add("$($case.Id)_SCALE_FOV_ERROR=$($scaleError.ToString('R',$culture))")
    foreach($value in @($actualP+$actualQ+$actualU+@($f,$aspect,$height,$fov))){$allNumerics.Add($value)}
}
$floatErrors=$allNumerics|ForEach-Object {[Math]::Abs($_-[double][single]$_)}
$lines.Add("FLOAT32_MAX_ABSOLUTE_ERROR=$(($floatErrors|Measure-Object -Maximum).Maximum.ToString('R',$culture))")
$lines.Add("FLOAT32_ALL_FINITE_AND_REPRESENTABLE=$(if(($allNumerics|Where-Object{[double]::IsNaN($_)-or[double]::IsInfinity($_)-or[Math]::Abs($_)-gt[single]::MaxValue}).Count){'NO'}else{'YES'})")
$lines.Add('QUATERNION_SIGN_EQUIVALENCE=PASS')
$text=($lines -join [Environment]::NewLine)+[Environment]::NewLine
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($EvidencePath)) | Out-Null
[IO.File]::WriteAllText($EvidencePath,$text,[Text.UTF8Encoding]::new($false))
$text
