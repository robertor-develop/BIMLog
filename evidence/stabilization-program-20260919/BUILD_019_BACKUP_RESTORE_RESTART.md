# Build 019 — Backup, restore, startup serialization, and restart proof

Result: `PASS`

- Added a bounded PostgreSQL custom-format backup/restore rehearsal operator.
- Source and restore targets are fixed to `bimlog_rfi_test` and `bimlog_rfi_restore_test` on the same verified loopback F-rooted test cluster.
- The receipt binds backup SHA-256/size, source contract SHA-256, exact restored schema, and all-table source/restored row-count manifests.
- Restore cleanup can affect only the fixed disposable restore database.
- The restored database is retained only when explicitly requested for application readiness/restart proof.
- Startup serialization and two consecutive exact-artifact readiness runs are required before Build 020 publication rehearsal.
- Generated runtime cleanup retries only bounded Windows `EBUSY`/`ENOTEMPTY`/`EPERM` races; other failures remain fatal.

No production database or customer data is used.
