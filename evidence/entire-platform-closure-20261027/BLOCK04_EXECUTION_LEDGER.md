# Block 04 Execution Ledger

- Active task: execute the next authorized five-build block with continuous recovery, verification, push, publication, and authenticated acceptance.
- Active block: Stabilization Block 04, Builds 016-020.
- Starting local HEAD: `9c3ae7142bee32380eb7023dca953c97a102599b`.
- Starting remote HEAD: `9c3ae7142bee32380eb7023dca953c97a102599b`.
- Starting deployed commit: `6aae7cfe8c57f7d8f8893da3fe9414d6ab621e85`.
- Starting production version: `v1.05.N18-P37`.
- Starting database migration head: `schema-cc8c4bb93ef7f2f5b713649d`.
- Starting production identity: bound (`9bd6b698e4ebae6f5495c8272193a1146dbf2e445e269ce741a5fa2241283ed3`).
- Worktree at checkpoint: clean.
- Unpublished builds entering block: 5.
- Publication cadence: publication is mandatory after Build 020.
- Browser resources owned: none.

## Authorized builds

| Build | Scope | Accepted implementation commit | Current verification |
|---|---|---|---|
| 016 | Exact production schema inventory and source-contract comparison | `514809cbabe833d882c8f8fcfe7a99a2d47f2076` | PASS: exact source contract and mismatch classification, 307/396/4050/3/519/268 |
| 017 | Deterministic Windows disposable database fixture | `ddabf40305d0baf6c8ecdfc285aa00eb0ef530ff` | PASS: guard plus two recreate/prepare/check cycles on exact loopback fixture |
| 018 | Restored-database migration preview with loss detection | `3de38a070d30176ae10948dd6ad6f3324342a6a2` | PASS: zero-pending positive, changed-schema negative, exact disposable preview |
| 019 | Backup, restore, migration replay, startup serialization, restart | `2149302a6f68e24c14d507133c3df1cafec8f55c` | PASS: exact backup/restore/count hashes and two readiness/restart cycles |
| 020 | Proven publication database operator and release rehearsal | `be902808b59c264d31480f5d76424f8fdaff5cbe` | PASS: exact pair, mismatch negatives, schemaAction NONE, data copy OFF |

## Current checkpoint

- Authority: Constitution PASS; professional identity ALLOW; instruction authority ALLOW with exact durable-owner binding.
- Last completed action: Build 020 operator tests and exact source/restored publication rehearsal passed; stale Build 016/020 schema-total evidence was corrected to current truth.
- Tests completed: authority/bootstrap, public health identity, Builds 016-020 focused gates.
- Tests pending: production inventory comparison; ten-build prepublication regression; Living Brief reconciliation; push; publication; deployment verification; three authenticated production rounds.
- Build 020 rehearsal receipt SHA-256: `a80f9f9d5e47de4dbf5cfc4c1fad83394c9abc19ecd7cea0598c6069ed33cf01`.
- Build 019 backup SHA-256: `54d36aa73ed92f14a9ee1862439a8a5891aae692a000479032b965a28c8bfbe6` (1,418,246 bytes).
- Build 019 source/restored count manifest SHA-256: `17fd07501680a18399972e30d5657bca8d0c63318deac7b5759189c00edad62a`.
- Defects discovered: the first restored readiness run used a newly inherited broad-ACL proof directory and correctly failed its security assertion; Build 016/020 evidence still contained superseded 223/273/184 schema totals.
- Defects corrected: reran under the existing hardened F-rooted proof directory; both readiness/restart cycles passed; evidence and program scope now state the verified 307/396/268 contract.
- Push status: pending accepted block regression.
- Publication status: required after Build 020.
- Exact safe resume point: run the complete ten-build prepublication suite, reconcile Living Brief impact, commit and push the release candidate.
