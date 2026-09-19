# Build 017 — Deterministic Windows artifact fixture

Result: `PASS`

- Added an explicit bounded recreation mode for the disposable `bimlog_rfi_test` fixture.
- Recreation requires all of: exact database name, loopback PostgreSQL, verified F-rooted cluster data directory, `--prepare --recreate`, and `BIMLOG_ALLOW_DISPOSABLE_FIXTURE_RECREATE=YES`.
- The operator terminates connections only to the exact disposable database and cannot interpolate another database name.
- A repeatability runner recreates, initializes, and checks the fixture twice.
- A guard test proves the fixed database identity, loopback/F-root custody, and explicit recreation authorization remain present.

No production database URL or provider database can satisfy the fixture identity checks.
