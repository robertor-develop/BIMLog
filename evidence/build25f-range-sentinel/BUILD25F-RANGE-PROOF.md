# Build 25F planes-mode range proof

## Proven policy

For every inspected genuine Navisworks Manage 2021 export whose `clipplaneset`
uses `mode="planes"`, Navisworks emits the same empty-box range sentinel:

- minimum: `(1, 1, 1)`
- maximum: `(0, 0, 0)`

This remains true for an empty document, a controlled non-empty model, enabled
and disabled clipping, linked and unlinked clipping, and single and multiple
authoritative clipping planes. Document bounds are therefore not the source of
the planes-mode `range` value, and no capture extension is required.

## Genuine export evidence

| Evidence | Document | Enabled | Linked | Authoritative planes | XML planes | Min | Max |
|---|---|---:|---:|---:|---:|---|---|
| Build 16 camera probe | empty | 0 | 0 | 0 | 6 | 1,1,1 | 0,0,0 |
| Build 17/17A perspective probes | empty | 0 | 0 | 0 | 6 | 1,1,1 | 0,0,0 |
| Build 18 orthographic probes | empty | 0 | 0 | 0 | 6 | 1,1,1 | 0,0,0 |
| Build 19 single-plane probe | empty | 1 | 0 | 1 | 6 | 1,1,1 | 0,0,0 |
| Build 19 multiple-plane probe | empty | 1 | 1 | multiple | 6 | 1,1,1 | 0,0,0 |
| Build 25E manual range export | controlled non-empty | 0 | 0 | 0 | 6 | 1,1,1 | 0,0,0 |

Build 25E genuine export identity: 4020 bytes; SHA-256
`54F24D84A79C299A3F432E96809603C56703A7336B12F5D17FD3DBCABE4A43B3`.

## Corrected integrated artifact

The corrected three-view artifact validates against the installed Autodesk
Navisworks 2021 `nw-exchange-12.0.xsd`. It contains two `range` elements, one
for each view carrying sectioning. Removing only those two elements yields an
XML document semantically identical to the Build 25B canonical artifact; view
ordering, names, GUIDs, camera values, projection/scale values, and clipping
plane values are unchanged.
