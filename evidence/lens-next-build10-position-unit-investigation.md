# Lens Next Build 10 camera-position unit investigation

Date: 2026-09-03
Baseline: Build 09 commit `420b7ba614adaf9043e2a843a740c41156b78dd9`

## Decision

`POSITION_UNIT_POLICY=UNRESOLVED`

No coordinate conversion and no XML `units` attribute may be added. The native
Navisworks document unit is authoritative for a viewpoint, but that value is not
stored in the current BIMLog Visual Package. Consequently, the export layer cannot
prove the source unit of an arbitrary persisted camera position or select its exact
matching XML token.

## Evidence chain

1. The frozen capture implementation in
   `plugins/BIMLogLensNext/native/AutodeskVisualStateAdapter.cs` reads
   `Document.CurrentViewpoint.ToViewpoint().Position` and copies `Point3D.X/Y/Z`
   directly into `LensNextPointState`. It performs no scale or axis conversion.
2. The frozen restore implementation constructs
   `new Point3D(camera.Position.X, camera.Position.Y, camera.Position.Z)` and assigns
   it to a writable `Viewpoint`, followed by
   `DocumentCurrentViewpoint.CopyFrom(Viewpoint)`. It performs no scale or axis
   conversion. This is the field-proven BIMLog-to-Navisworks round trip.
3. Installed Autodesk Navisworks 2021 API documentation states that
   `Viewpoint.Position` is the camera position and that `Document.Units` applies to
   all geometry, properties, transforms, and viewpoints. Reflection confirms the
   property type is `Autodesk.Navisworks.Api.Units`, with the linear-unit values
   Meters, Centimeters, Millimeters, Feet, Inches, Yards, Kilometers, Miles,
   Micrometers, Mils, and Microinches.
4. The installed Autodesk `nw-exchange-12.0.xsd` defines optional root attribute
   `exchange@units` using `modelunitsType`, with tokens `m`, `cm`, `mm`, `ft`, `in`,
   `yrd`, `km`, `mi`, `um`, `mils`, and `uin`. It defines `pos3f@x/@y/@z` as
   `xs:float` lexical values.
5. An existing Navisworks-produced XML artifact adjacent to its source NWD declares
   `units="ft"`, schema `nw-exchange-12.0.xsd`, and camera positions in
   `view/viewpoint/camera/position/pos3f`. This proves `ft` for that artifact only;
   it does not prove that every BIMLog package is feet.
6. The Build 03 contract and current Visual Package contain camera doubles but no
   `Document.Units`, linear-unit token, or scale. Coordinate magnitude, filename,
   project geography, and the one feet-based artifact are not valid substitutes.

## Bound hashes

- Autodesk API DLL:
  `C6DFF483062BAD5D6EA56067D2F6258C89D705177B1BBEDB68FC66735E6CE075`
- Autodesk API XML documentation:
  `BE24A21216A6822E9AE10D4923ECBD5F4EE0FEAC3CC251EC063EF619674C949A`
- Installed `nw-exchange-12.0.xsd`:
  `47F8111547A4ACD92D22757E409C9D567B20E34358F2807C1ECEA7249627B78F`
- Existing source NWD:
  `AC3E387A947C91C06F044D65CFB8E52A68FA90550CC80678B983D486E57567B8`
- Existing Navisworks-generated XML:
  `6385F6BFB9141866995A0E437DCC10A6E8A5F28E4E25624F98FED3E0D032AB03`

## Conversion and XML-token conclusion

`CONVERSION_REQUIRED=UNRESOLVED`. Within a live Navisworks document, the native
camera value and its `Document.Units` belong to the same document coordinate
representation. The current persisted package preserves the numeric value but loses
the unit label needed to interpret it later. No deterministic source-to-target
conversion formula can therefore be selected from current package data.

`XML_UNITS_TOKEN_PROVEN=NO` for the general BIMLog export. The schema's allowed token
vocabulary is proven, and `ft` is proven for the inspected artifact, but the exact
token corresponding to an arbitrary persisted BIMLog camera is not.

## Numeric precision

Build 09's `.NET "R" + InvariantCulture` policy remains correct for lossless,
deterministic serialization of the stored IEEE-754 double into XML text:

- the `R` format round-trips representative positive, negative, zero, large,
  fractional, and subnormal doubles back to the identical value;
- `InvariantCulture` prevents locale-dependent decimal commas;
- no unit conversion, rounding policy, axis swizzle, negation, or clamping occurs;
- identical input produces byte-identical XML.

The Autodesk XSD types `pos3f` coordinates as `xs:float`, while its exporter emits
decimal coordinates with ten fractional digits. The installed evidence does not prove
whether the Navisworks importer retains double precision internally. Keeping `R` avoids
introducing loss before import; it does not claim a lossless Navisworks XML import.

## Frozen behavior confirmation

Build 09 X/Y/Z serialization is unchanged. No production/native capture or restore
code, Platform code, database/schema, Saved Viewpoint behavior, unit conversion, axis
conversion, XML unit token, rotation, up vector, projection, focal/FOV data, or
sectioning was added or modified.
