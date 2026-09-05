# Build 25H Navisworks numeric compatibility proof

## Failure trace

The rejected value was `viewpoint/camera/position/pos3f@z` for controlled
viewpoint `VP-160`. It originated only in the integrated acceptance fixture at
`plugins/BIMLogLensNext/tests/Program.cs` (the `Build24IntegratedFixtures`
method), where the position was explicitly assigned `Z = 1e100d`. It was not
captured BIMLog data and was not produced by exporter conversion or camera
math.

## Target contract

The installed Autodesk Navisworks Manage 2021 schema
`C:\Program Files\Autodesk\Navisworks Manage 2021\schemas\nw-exchange-12.0.xsd`
declares every dynamic numeric camera and clipping-plane attribute emitted by
the BIMLog exporter as `xs:float`. The target is a finite IEEE-754 binary32
value: inclusive finite range approximately
`-3.4028234663852886E+38` through `3.4028234663852886E+38`, including zero.

XML Schema float lexical forms include ordinary decimal and scientific
notation. BIMLog retains deterministic invariant `"R"` formatting, which uses
only accepted decimal/scientific finite forms. `NaN`, infinities, values that
overflow binary32, and non-zero values that underflow to binary32 zero are
rejected. No value is clamped, defaulted, normalized, or rewritten.

The representability guard is shared by position, rotation, up-vector,
focal/FOV/aspect/height, and clipping-plane normal/distance serialization.
Hard-coded range-sentinel values are already finite binary32 values.

## Controlled fixture correction

Only the unrealistic controlled `VP-160` position Z fixture changed, from
`1E+100` to `1250.75`. The corrected XML differs from the Build 25F artifact
only at that attribute. Camera formulas, all other camera values, sectioning,
range sentinel, ordering, identities, and the schema envelope are unchanged.

The corrected artifact validates against the installed Autodesk XSD and
contains no `1E+100` value.
