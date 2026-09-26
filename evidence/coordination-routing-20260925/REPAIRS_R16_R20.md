# SharePoint repair block R16–R20

Baseline: 45e22afcce78aef6672671b35cffb82b3cc74625 (published).
This block does not consume original Resource/Earnings builds76–80. Lens Next is frozen.

1. R16: active operational credential leases separated from pending-validation leases. Real encryption/lease code feeds the Graph identity adapter in a synthetic transport test; pending, disabled and revoked credentials cannot enter operational transport.
2. R17: canonical project destination read/create, exact company authority, active connector selection, immutable replay/conflict rules and audit. Isolated real PostgreSQL proves create, repeat, reopen and one audit record. No schema changes.
3. R18: authenticated GET/POST destination routes, server-derived scope and project-administrator write boundary; regenerate route graph and include regression tests.
4. R19: destination UI connected before Wizard import; existing connection selector, exact Microsoft identifiers, review/cancel, save/reopen, missing-connection guidance and bounded malformed-response handling. No credential enrollment or rotation.
5. R20: lock current actor/membership for transaction-time authority; real PostgreSQL ordinary-role and cross-company denial; bind response tests to release suite and reconcile state.

## Evidence and limits

- Focused lease, Graph identity/upload, destination and full folder publication block06 tests pass.
- Isolated PostgreSQL destination save/retry/conflict/audit, role denial, cross-company denial, job queue/lease/retry/settlement pass. All fixture data is rolled back; provider transport is synthetic.
- API/frontend typecheck and mojibake pass at intermediate checkpoints; final exact-head gate remains required.
- Chrome imports actual production component from F:/BIMLog/TestProof/sharepoint-destination-harness.tsx; synthetic responses are confined to that external harness. Spanish review/cancel sends zero POST; save/reopen sends exactly one POST and retains identifiers. English/Spanish missing-connection, denied and failed-load states verified.
- Effective CSS390 measurement: innerWidth390, scrollWidth390. No component console warnings/errors observed. Screenshot capture was unreliable (CDP timeouts/stitched image); final visual QA remains unverified, not PASS.
- Existing test-account live Headquarters card opens synthetic project57 Analytics. This is not Ruben account proof.
- Read-only production diagnostics: Ruben has nine active memberships (eight project_admin, one drafter). His exact failing screen is not yet established.
- Canonical BIMTECH company31 has no registered connector credentials, SharePoint mappings or current Wizard imports. No secrets queried or changed. Actual provider delivery cannot be claimed until an authorized company connection/destination exists and file upload/readback passes.

## Remaining

Full five-build exact-head gate and push; publication at the next ten-build boundary; final visual QA and authenticated deployment smoke; Ruben entry reproduction; Microsoft company connection enrollment/discovery and real tenant delivery. Existing mapping replacement is intentionally not supported by this bounded create flow. Do not report the whole SharePoint gap closed.
