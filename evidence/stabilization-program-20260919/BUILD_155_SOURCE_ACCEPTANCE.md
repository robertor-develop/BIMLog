# Build 155 source acceptance

Date: 2026-09-20

## Scope

Builds 151–155 complete post-120 Block 31, the RFI frontend decomposition block.

- Build 151 isolates RFI list, filter, sorting, summary, and governed export-query state.
- Build 152 isolates create-form reference, attachment, package, image-review, capture, and upload lifecycle state.
- Build 153 isolates the canonical permission-aware action and status-transition presentation matrix.
- Build 154 binds list/query composition, editor state, cross-role transitions, meeting return links, existing-RFI links, and Lens prefill links into the permanent pre-push gate.
- Build 155 reconciles the accepted source, runs the complete clean-tree gate, and pushes the exact five-build head.

## Acceptance

- Focused Block 31 regression: `POST120_BLOCK31=PASS`.
- RFI page reduced below 4,000 lines while preserving the same route and public component exports.
- Frontend TypeScript: PASS for Builds 151, 152, and 153.
- Complete clean-tree pre-push gate: required before push.

## Boundaries

- No database, schema, customer data, Native, installer, package, bridge protocol, report renderer, provider configuration, or production state changes are included.
- Focused Navisworks smoke is not retriggered because Native and installers are unchanged.
- This is a push-only five-build boundary. Publication and authenticated Chrome smoke remain scheduled after Build 160, within the ten-build publication ceiling.

## Next block

Builds 156–160 decompose the RFI backend. Build 160 is the next push, publication, and authenticated live acceptance boundary.
