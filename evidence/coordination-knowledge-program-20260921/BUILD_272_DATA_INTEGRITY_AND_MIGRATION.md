# Build 272 — Data-integrity and migration audit

Status: `PASS_SOURCE_CANDIDATE`

Exact source effect:

- Coordination Knowledge startup schema version: `3`
- Additive tables: `16`
- Additive indexes: `9`
- Immutable-history triggers: `7`
- Destructive statements: `0`
- Existing table, column or index removal: `0`
- Production database execution in this build: `NONE`

The executable audit runs the exact schema twice against the governed loopback UTF-8
`bimlog_rfi_test` fixture, compares canonical project, Lens viewpoint and knowledge revision
counts before and after, checks declared table inventory, checks five identity/revision families
for orphans, and proves simulated partial migration rollback and client release.

The test fixture is disposable, loopback-only and physically rooted below
`F:\BIMLog\TestProof`. No production or customer database is contacted. Production application
of the additive schema remains a Build 275 zero-drop preview and controlled publication action.
